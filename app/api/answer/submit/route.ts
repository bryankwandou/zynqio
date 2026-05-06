import { NextResponse } from "next/server";
import { getQuizData, getRoomState, setRoomState, redis, setAnswerOnce } from "@/lib/kv";
import { validateAnswer, calculateScore } from "@/lib/scoring";
import { pusherServer } from "@/lib/pusher";
import { rateLimit, getIP } from "@/lib/rate-limit";

export async function POST(req: Request) {
  try {
    // Rate limit: 30 answer submits per minute per IP
    const ip = getIP(req);
    const allowed = await rateLimit(ip, "answer", 30, 60);
    if (!allowed) {
      return NextResponse.json({ error: "Too many requests. Slow down." }, { status: 429 });
    }

    const body = await req.json();
    const {
      playerId,
      questionId,
      questionIndex,
      selectedAnswer,
      roomCode,
      sessionId,
    } = body;

    let { quizId, hostId } = body;

    const serverTimestamp = Date.now();

    // Get room state first so we can use quizId/hostId as fallbacks
    const room = await getRoomState(roomCode);
    if (!quizId && room?.quizId) quizId = room.quizId;
    if (!hostId && room?.hostId) hostId = room.hostId;

    if (!quizId) {
      return NextResponse.json({ error: "Quiz ID not found" }, { status: 400 });
    }

    if (sessionId && playerId && questionId) {
      const isFirstAttempt = await setAnswerOnce(sessionId, playerId, questionId, {
        answer: selectedAnswer,
        timestamp: serverTimestamp,
      });
      if (!isFirstAttempt) {
        return NextResponse.json({ error: "Already answered this question." }, { status: 429 });
      }
    }

    const cooldownKey = `cooldown:${roomCode}:${playerId}`;
    try {
      const onCooldown = await redis.get<boolean>(cooldownKey);
      if (onCooldown) {
        return NextResponse.json({ error: "Rate limit exceeded. Please wait." }, { status: 429 });
      }
      await redis.set(cooldownKey, true, { ex: 1 });
    } catch {
      // Non-fatal
    }

    const quiz = await getQuizData(hostId || "admin", quizId);
    if (!quiz) {
      return NextResponse.json({ error: "Quiz not found" }, { status: 404 });
    }

    // Find by id first; fall back to player's own index, then host's index
    let question = quiz.questions?.find((q: any) => q.id === questionId);
    if (!question) {
      // Prefer player-sent index (correct for Wayground Classic where each player is at different Q)
      const fallbackIndex = questionIndex ?? room?.currentQuestionIndex;
      if (fallbackIndex != null) question = quiz.questions?.[Number(fallbackIndex)];
    }
    if (!question) {
      return NextResponse.json({ error: "Question not found" }, { status: 404 });
    }

    const gameMode = room?.gameMode || "classic";
    const globalTimer = room?.settings?.timer || 30;

    try {
      await (redis as any).sadd(`room:${roomCode}:q:${questionId}:answers`, playerId);
    } catch {
      // Non-fatal
    }

    const isCorrect = validateAnswer(question, selectedAnswer);

    const questionStart = room?.questionStartTimestamp || serverTimestamp;
    const elapsedSeconds = (serverTimestamp - questionStart) / 1000;
    const totalTime = globalTimer || 30;
    const timeLeft = Math.max(0, totalTime - elapsedSeconds);

    const currentPlayerStreak = room?.players?.find(
      (p: any) => p.id === playerId || p.name === playerId
    )?.streak || 0;

    const scoring = calculateScore({
      isCorrect,
      gameMode: gameMode as any,
      timeLeft,
      totalTime,
      pointsWeight: question.points || 1,
      streak: currentPlayerStreak,
    });

    const { totalScore: sessionScore, accuracyPoints } = scoring;
    const speedBonus = scoring.speedBonus;

    if (room?.players) {
      // playerId may be UUID (p.id) or player name (p.name) — support both
      const playerIndex = room.players.findIndex(
        (p: any) => p.id === playerId || p.name === playerId
      );
      if (playerIndex >= 0) {
        const player = room.players[playerIndex];
        player.totalAnswered = (player.totalAnswered || 0) + 1;
        if (isCorrect) player.totalCorrect = (player.totalCorrect || 0) + 1;

        if (gameMode === "survival") {
          if (isCorrect) {
            player.streak = (player.streak || 0) + 1;
            player.score = (player.score || 0) + sessionScore;
          } else {
            player.streak = 0;
            player.score = 0;
          }
        } else if (gameMode === "battle_royale") {
          if (!isCorrect && player.activePowerup !== "shield") {
            player.lives = Math.max(0, (player.lives ?? 3) - 1);
          }
          player.score = (player.score || 0) + sessionScore;
        } else if (gameMode === "wayground_classic") {
          if (isCorrect) {
            player.streak = (player.streak || 0) + 1;
          } else {
            player.streak = 0;
          }
          player.score = (player.score || 0) + sessionScore;
        } else {
          player.score = (player.score || 0) + sessionScore;
        }

        player.accuracy = Math.round(
          ((player.totalCorrect || 0) / (player.totalAnswered || 1)) * 100
        );
        room.players[playerIndex] = player;

        // Track per-question answer stats for analytics
        if (!room.answerStats) room.answerStats = {};
        if (!room.answerStats[questionId]) {
          room.answerStats[questionId] = { total: 0, correct: 0, byAnswer: {} };
        }
        room.answerStats[questionId].total++;
        if (isCorrect) room.answerStats[questionId].correct++;
        const ansKey = String(selectedAnswer ?? "null");
        room.answerStats[questionId].byAnswer[ansKey] =
          (room.answerStats[questionId].byAnswer[ansKey] || 0) + 1;

        room.updatedAt = Date.now();
        try {
          await setRoomState(roomCode, room);
        } catch (error) {
          console.error("Failed to update room state:", error);
        }
      }
    }

    // Trigger Pusher event for real-time leaderboard update
    try {
      await pusherServer.trigger(`room-${roomCode}`, 'answer_submitted', {
        playerId,
        isCorrect,
        sessionScore,
        totalScore: room?.players?.find((p: any) => p.id === playerId || p.name === playerId)?.score || 0,
        answersCount: await (redis as any).scard(`room:${roomCode}:q:${questionId}:answers`)
      });
    } catch (e) {
      console.error("[Pusher] Trigger error:", e);
    }

    return NextResponse.json({
      correct: quiz.hideAnswer ? null : isCorrect,
      sessionScore,
      accuracyPoints,
      speedBonus,
      gameMode,
    });
  } catch (error) {
    console.error("Scoring error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
