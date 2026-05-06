import { NextResponse } from "next/server";
import { getRoomState, setRoomState } from "@/lib/kv";
import { pusherServer } from "@/lib/pusher";

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
    await setRoomState(roomCode, room);

    try {
      await pusherServer.trigger(`room-${roomCode}`, "game_ended", { status: "ended" });
    } catch {}

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
