import { NextResponse } from "next/server";
import { getRoomState, redis } from "@/lib/kv";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const roomCode = searchParams.get("code");
  const since = searchParams.get("since");

  if (!roomCode) {
    return NextResponse.json({ error: "Missing room code" }, { status: 400 });
  }

  try {
    const state = await getRoomState(roomCode);
    if (!state) {
      return NextResponse.json({ error: "Room not found" }, { status: 404 });
    }

    // ETag / updatedAt versioning — return 304 if client is up-to-date
    const updatedAt = state.updatedAt || 0;
    if (since && Number(since) >= updatedAt) {
      return new NextResponse(null, { status: 304 });
    }

    // Attach live answer count when game is active
    if (state.status === "playing") {
      const qId = state.currentQuestionId || `q${state.currentQuestionIndex + 1}`;
      try {
        const answersCount = await (redis as any).scard(`room:${roomCode}:q:${qId}:answers`);
        state.answersCount = answersCount || 0;
      } catch {
        state.answersCount = 0;
      }
    }

    const headers = new Headers({
      "Cache-Control": "no-store",
      ETag: String(updatedAt),
    });

    return NextResponse.json(state, { headers });
  } catch (error) {
    console.error("Error fetching room state:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
