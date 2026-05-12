import { NextResponse } from "next/server";
import { getRoomState, redis } from "@/lib/kv";
import { pusherServer } from "@/lib/pusher";

const RESULTS_TTL_SECONDS = 7 * 24 * 60 * 60; // 7 days

export async function POST(req: Request) {
  try {
    const { roomCode } = await req.json();
    if (!roomCode) {
      return NextResponse.json({ error: "Missing roomCode" }, { status: 400 });
    }

    const room = await getRoomState(roomCode);
    if (!room) {
      return NextResponse.json({ error: "Room not found" }, { status: 404 });
    }

    room.status = "ended";
    room.updatedAt = Date.now();
    room.endedAt = Date.now();

    // Persist with 7-day TTL so results remain accessible after the game
    await (redis as any).set(`room:${roomCode}`, JSON.stringify(room), { ex: RESULTS_TTL_SECONDS });

    try {
      await pusherServer.trigger(`room-${roomCode}`, "game_ended", { status: "ended" });
    } catch {}

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
