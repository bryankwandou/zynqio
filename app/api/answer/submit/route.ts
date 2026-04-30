import { NextResponse } from 'next/server';
import { getQuizData, getRoomState } from '@/lib/kv';
import { kv } from '@vercel/kv';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { playerId, questionId, selectedAnswer, clientTimestamp, roomCode, quizId, hostId } = body;

    // SANGAT PENTING — INI CORE ANTI-CHEAT (Section 8.3)
    // 1. Server receives request and immediately records serverTimestamp
    const serverTimestamp = Date.now();

    // 2. Client is never sent the correct answer. We look it up here.
    // In a real implementation, we would validate session token here to enforce rate limiting
    // and 1x attempt logic per question using Upstash SETNX.
    
    // For MVP zero-config, we load the quiz data to check the answer
    // (We mock user ID as 'admin' if hostId isn't provided, since we fallback to local db)
    const quiz = await getQuizData(hostId || '1', quizId);
    
    if (!quiz) {
      return NextResponse.json({ error: 'Quiz not found' }, { status: 404 });
    }

    const question = quiz.questions?.find((q: any) => q.id === questionId);
    
    if (!question) {
      return NextResponse.json({ error: 'Question not found' }, { status: 404 });
    }

    // 3. Fetch Room State for Game Mode logic
    // Rate Limiting (Section 9.4)
    const cooldownKey = `cooldown:${roomCode}:${playerId}`;
    const onCooldown = await kv.get(cooldownKey);
    if (onCooldown) {
      return NextResponse.json({ error: "Rate limit exceeded. Please wait." }, { status: 429 });
    }
    await kv.set(cooldownKey, true, { ex: 1 }); // 1 second cooldown

    const room = await getRoomState(roomCode);
    const gameMode = room?.gameMode || 'classic';
    const globalTimer = room?.settings?.timer || 30;

    // Track unique answer for this question
    if (process.env.KV_REST_API_URL) {
      await kv.sadd(`room:${roomCode}:q:${questionId}:answers`, playerId);
    }

    // 4. Scoring calculation
    let isCorrect = false;
    
    if (question.type === 'MCQ' || question.type === 'TF') {
      isCorrect = question.correctAnswer === selectedAnswer;
    } else if (question.type === 'FIB') {
      const validAnswers = (question.correctAnswer as string)?.split(';').map((a: string) => a.trim().toLowerCase()) || [];
      isCorrect = validAnswers.includes(selectedAnswer.trim().toLowerCase());
    }

    // Accuracy Points
    const pointsValue = question.points || 1;
    const accuracyPoints = isCorrect ? pointsValue : 0;

    // Session Score logic
    let speedBonus = 0;
    let baseScore = 0;
    
    if (isCorrect) {
      baseScore = 600 * pointsValue;
      
      // Speed Rush Mode: 1.5x speed bonus (Section 10.3)
      const multiplier = gameMode === 'speed_rush' ? 1.5 : 1.0;
      
      // Real Speed Bonus Calculation (Section 7.2)
      const questionStart = room.questionStartTimestamp || serverTimestamp;
      const elapsedSeconds = (serverTimestamp - questionStart) / 1000;
      const tTotal = globalTimer || 30;
      const tRemaining = Math.max(0, tTotal - elapsedSeconds);
      
      speedBonus = Math.floor(400 * pointsValue * (tRemaining / tTotal) * multiplier); 
    } else if (gameMode === 'speed_rush') {
      // Speed Rush Penalty: -100 points
      baseScore = -100;
    }

    const sessionScore = baseScore + speedBonus;

    // Survival Mode Logic (Section 10.7)
    let player = room.players?.find((p: any) => p.id === playerId);
    if (player) {
      player.totalAnswered = (player.totalAnswered || 0) + 1;
      if (isCorrect) player.totalCorrect = (player.totalCorrect || 0) + 1;

      if (room.gameMode === 'survival') {
        if (isCorrect) {
          player.streak = (player.streak || 0) + 1;
          player.score = (player.score || 0) + sessionScore;
        } else {
          // RESET progress (Section 10.7)
          player.streak = 0;
          player.score = 0; 
          player.gold = 0; 
        }
      } else if (room.gameMode === 'battle_royale') {
        if (!isCorrect && player.activePowerup !== 'shield') {
          player.lives = Math.max(0, (player.lives ?? 3) - 1);
        }
        player.score = (player.score || 0) + sessionScore;
      } else {
        player.score = (player.score || 0) + sessionScore;
      }

      player.accuracy = Math.round(((player.totalCorrect || 0) / (player.totalAnswered || 1)) * 100);
      await kv.set(`room:${roomCode}`, room);
    }
    
    return NextResponse.json({
      correct: isCorrect,
      sessionScore,
      accuracyPoints,
      speedBonus,
      gameMode
    });

  } catch (error) {
    console.error('Scoring error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
