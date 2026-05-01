import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { getRoomState, setRoomState } from "@/lib/kv";

function generateRoomCode() {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

async function generateUniqueRoomCode(maxAttempts = 20) {
  for (let i = 0; i < maxAttempts; i++) {
    const candidate = generateRoomCode();
    const existing = await getRoomState(candidate);
    if (!existing) return candidate;
  }
  throw new Error("Failed to generate unique room code");
}

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { quizId, hostId, settings } = body;

    if (!quizId) {
      return NextResponse.json({ error: "Missing quiz ID" }, { status: 400 });
    }

    const roomCode = await generateUniqueRoomCode();
    const sessionId = `session_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;

    const initialState = {
      roomCode,
      sessionId,
      quizId,
      hostId: hostId || (session.user as any)?.id || "admin",
      status: "waiting",
      players: [],
      gameMode: settings?.gameMode || "classic",
      settings: {
        timer: settings?.timer ?? 30,
        oneAttemptOnly: settings?.oneAttemptOnly ?? true,
        showAnswerAfterQuestion: settings?.showAnswerAfterQuestion ?? false,
        showLeaderboardBetweenQuestions: settings?.showLeaderboardBetweenQuestions ?? true,
        enablePowerUps: settings?.enablePowerUps ?? false,
      },
      currentQuestionIndex: 0,
      createdAt: new Date().toISOString(),
    };

    await setRoomState(roomCode, initialState);

    return NextResponse.json({ roomCode, sessionId });
  } catch (error) {
    console.error("Error creating room:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
