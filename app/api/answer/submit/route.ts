import { NextResponse } from 'next/server';
import { getQuizData, getRoomState, setRoomState, redis, setAnswerOnce } from '@/lib/kv';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const {
      playerId,
      questionId,
      selectedAnswer,
      roomCode,
      quizId,
      hostId,
      sessionId,
    } = body;

    // CORE ANTI-CHEAT — Server timestamp only (Section 8.3)
    const serverTimestamp = Date.now();

    // Enforce 1x attempt only via SETNX (Section 9.4)
    if (sessionId && playerId && questionId) {
      const isFirstAttempt = await setAnswerOnce(sessionId, playerId, questionId, {
        answer: selectedAnswer,
        timestamp: serverTimestamp,
      });
      if (!isFirstAttempt) {
        return NextResponse.json({ error: 'Already answered this question.' }, { status: 429 });
      }
    }

    // Rate limiting: 1-second cooldown per player
    const cooldownKey = `cooldown:${roomCode}:${playerId}`;
    try {
      const onCooldown = await redis.get<boolean>(cooldownKey);
      if (onCooldown) {
        return NextResponse.json({ error: 'Rate limit exceeded. Please wait.' }, { status: 429 });
      }
      await redis.set(cooldownKey, true, { ex: 1 });
    } catch {
      // Non-fatal — continue without rate limiting if redis fails
    }

    const quiz = await getQuizData(hostId || 'admin', quizId);

    if (!quiz) {
      return NextResponse.json({ error: 'Quiz not found' }, { status: 404 });
    }

    const question = quiz.questions?.find((q: any) => q.id === questionId);

    if (!question) {
      return NextResponse.json({ error: 'Question not found' }, { status: 404 });
    }

    // Fetch Room State for scoring context
    const room = await getRoomState(roomCode);
    const gameMode = room?.gameMode || 'classic';
    const globalTimer = room?.settings?.timer || 30;

    // Track unique answer count for this question (non-fatal)
    try {
      await (redis as any).sadd(`room:${roomCode}:q:${questionId}:answers`, playerId);
    } catch {
      // ignore — not critical
    }

    // ─── SCORING (Section 7.2) ─────────────────────────────────────────────
    let isCorrect = false;

    if (question.type === 'MCQ' || question.type === 'TF') {
      isCorrect = question.correctAnswer === selectedAnswer;
    } else if (question.type === 'FIB') {
      const validAnswers = (question.correctAnswer as string)
        ?.split(';')
        .map((a: string) => a.trim().toLowerCase()) || [];
      isCorrect = validAnswers.includes((selectedAnswer || '').trim().toLowerCase());
    } else if (question.type === 'MSQ') {
      // All correct choices must be selected, no extra incorrect ones
      const correctSet = new Set(
        (question.correctAnswer as string)?.split(';').map((a: string) => a.trim()) || []
      );
      const selectedSet = new Set(
        Array.isArray(selectedAnswer)
          ? selectedAnswer
          : (selectedAnswer as string)?.split(';').map((a: string) => a.trim()) || []
      );
      isCorrect =
        correctSet.size === selectedSet.size &&
        [...correctSet].every((v) => selectedSet.has(v));
    }

    const pointsValue = question.points || 1;
    const accuracyPoints = isCorrect ? pointsValue : 0;

    let speedBonus = 0;
    let baseScore = 0;

    if (isCorrect) {
      baseScore = 600 * pointsValue;

      const speedMultiplier = gameMode === 'speed_rush' ? 1.5 : 1.0;
      const questionStart = room?.questionStartTimestamp || serverTimestamp;
      const elapsedSeconds = (serverTimestamp - questionStart) / 1000;
      const tTotal = globalTimer || 30;
      const tRemaining = Math.max(0, tTotal - elapsedSeconds);

      speedBonus = Math.floor(400 * pointsValue * (tRemaining / tTotal) * speedMultiplier);
    } else if (gameMode === 'speed_rush') {
      baseScore = -100; // Speed Rush penalty
    }

    const sessionScore = baseScore + speedBonus;

    // Update player state in room
    if (room?.players) {
      const playerIndex = room.players.findIndex((p: any) => p.id === playerId);
      if (playerIndex >= 0) {
        const player = room.players[playerIndex];
        player.totalAnswered = (player.totalAnswered || 0) + 1;
        if (isCorrect) player.totalCorrect = (player.totalCorrect || 0) + 1;

        if (gameMode === 'survival') {
          if (isCorrect) {
            player.streak = (player.streak || 0) + 1;
            player.score = (player.score || 0) + sessionScore;
          } else {
            player.streak = 0;
            player.score = 0;
          }
        } else if (gameMode === 'battle_royale') {
          if (!isCorrect && player.activePowerup !== 'shield') {
            player.lives = Math.max(0, (player.lives ?? 3) - 1);
          }
          player.score = (player.score || 0) + sessionScore;
        } else {
          player.score = (player.score || 0) + sessionScore;
        }

        player.accuracy = Math.round(
          ((player.totalCorrect || 0) / (player.totalAnswered || 1)) * 100
        );
        room.players[playerIndex] = player;

        // Persist updated room state (non-fatal)
        try {
          await setRoomState(roomCode, room);
        } catch (e) {
          console.error('Failed to update room state:', e);
        }
      }
    }

    // DO NOT return the correct answer to client (Section 8.3)
    return NextResponse.json({
      correct: isCorrect,
      sessionScore,
      accuracyPoints,
      speedBonus,
      gameMode,
    });
  } catch (error) {
    console.error('Scoring error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
