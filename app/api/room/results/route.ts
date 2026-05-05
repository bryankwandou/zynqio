import { NextResponse } from 'next/server';
import { getRoomState, getQuizData } from '@/lib/kv';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const roomCode = searchParams.get('code');

    if (!roomCode) {
      return NextResponse.json({ error: 'Missing room code' }, { status: 400 });
    }

    const state = await getRoomState(roomCode);
    if (!state) {
      return NextResponse.json({ error: 'Room not found' }, { status: 404 });
    }

    // Sort players by score
    const leaderboard = (state.players || [])
      .sort((a: any, b: any) => (b.score || 0) - (a.score || 0))
      .map((p: any, i: number) => ({
        rank: i + 1,
        name: p.name,
        avatarId: p.avatarId || "fox",
        score: p.score || 0,
        accuracy: p.accuracy || 0,
        totalCorrect: p.totalCorrect || 0,
        totalAnswered: p.totalAnswered || 0,
        gold: p.gold || 0,
        lives: p.lives ?? 3,
        team: p.team,
      }));

    // Calculate Team Scores (Section 10.6)
    const teamScores: Record<string, { totalAccuracy: number, count: number }> = {};
    if (state.gameMode === 'team') {
      leaderboard.forEach((p: any) => {
        if (p.team) {
          if (!teamScores[p.team]) teamScores[p.team] = { totalAccuracy: 0, count: 0 };
          teamScores[p.team].totalAccuracy += p.accuracy;
          teamScores[p.team].count += 1;
        }
      });
    }

    const teamLeaderboard = Object.entries(teamScores).map(([name, data]) => ({
      name,
      avgAccuracy: Math.round(data.totalAccuracy / data.count)
    })).sort((a, b) => b.avgAccuracy - a.avgAccuracy);

    const quiz = await getQuizData(state.hostId || '1', state.quizId);
    
    // Calculate Detailed Analytics (Section 12.2)
    const questions = quiz?.questions || [];
    const questionStats = questions.map((q: any) => {
      // In a real app, we'd pull from answer logs in KV
      // For this implementation, we can derive it if we tracked answers in room state
      // Let's assume we have `state.answerStats[q.id]` = { correct: number, total: number }
      const stats = state.answerStats?.[q.id] || { correct: 0, total: 0 };
      const accuracyRate = stats.total > 0 ? Math.round((stats.correct / stats.total) * 100) : 0;
      
      return {
        id: q.id,
        text: q.text,
        accuracy: accuracyRate,
        difficulty: 1 - (accuracyRate / 100),
        difficultyLabel: accuracyRate < 40 ? "Sangat Sulit" : accuracyRate < 70 ? "Sulit" : "Mudah"
      };
    });

    const performanceMatrix = leaderboard.map((p: any) => {
      const playerAnswers = state.playerAnswers?.[p.name] || {}; // name as key for MVP
      return {
        name: p.name,
        team: p.team,
        answers: questions.map((q: any) => ({
          questionId: q.id,
          isCorrect: playerAnswers[q.id]?.correct || false
        }))
      };
    });

    // Calculate stats
    const totalPlayers = leaderboard.length;
    const avgAccuracy = totalPlayers > 0 
      ? Math.round(leaderboard.reduce((acc: any, p: any) => acc + (p.accuracy || 0), 0) / totalPlayers) 
      : 0;

    return NextResponse.json({
      leaderboard,
      teamLeaderboard,
      gameMode: state.gameMode,
      stats: {
        totalPlayers,
        avgAccuracy,
        hardestQuestion: [...questionStats].sort((a: any, b: any) => a.accuracy - b.accuracy)[0]?.text || 'N/A',
      },
      questions: questionStats,
      matrix: performanceMatrix,
      quizId: state.quizId,
      hostId: state.hostId,
      quizTitle: quiz?.title || state.quizTitle || "Quiz Session",
      roomCode,
      settings: state.settings || {},
    });
  } catch (error) {
    console.error('Error fetching results:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
