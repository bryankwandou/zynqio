import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { getRoomState, setRoomState } from "@/lib/kv";

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { roomCode, playerId } = await req.json();
    if (!roomCode || !playerId) {
      return NextResponse.json({ error: "Missing params" }, { status: 400 });
    }

    const room = await getRoomState(roomCode);
    if (!room) return NextResponse.json({ error: "Room not found" }, { status: 404 });

    const userId = (session.user as any)?.id;
    if (room.hostId !== userId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    room.players = (room.players || []).filter(
      (p: any) => p.id !== playerId && p.name !== playerId
    );
    room.kickedPlayers = [...(room.kickedPlayers || []), playerId];
    await setRoomState(roomCode, room);

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
