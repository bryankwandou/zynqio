import { NextResponse } from "next/server";
import { getRoomState, setRoomState } from "@/lib/kv";

function sanitizeName(name: string) {
  return name.replace(/[<>\"'&]/g, "").trim().slice(0, 500);
}

function makeUniqueName(existingNames: string[], candidate: string) {
  const normalized = candidate.toLowerCase();
  if (!existingNames.some((name) => name.toLowerCase() === normalized)) return candidate;

  let counter = 2;
  let next = `${candidate} (${counter})`;
  while (existingNames.some((name) => name.toLowerCase() === next.toLowerCase())) {
    counter += 1;
    next = `${candidate} (${counter})`;
  }
  return next;
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { roomCode, playerName, userId } = body;

    if (!roomCode || !playerName) {
      return NextResponse.json({ error: "Missing room code or player name" }, { status: 400 });
    }

    const normalizedRoomCode = String(roomCode).toUpperCase();
    if (!/^[A-Z0-9]{6}$/.test(normalizedRoomCode)) {
      return NextResponse.json({ error: "Invalid room code format" }, { status: 400 });
    }

    const room = await getRoomState(normalizedRoomCode);
    if (!room) {
      return NextResponse.json({ error: "Room not found" }, { status: 404 });
    }

    if (room.status !== "waiting") {
      return NextResponse.json({ error: `Room is ${room.status}` }, { status: 409 });
    }

    const maxPlayers = room.settings?.maxPlayers || 60;
    if ((room.players?.length || 0) >= maxPlayers) {
      return NextResponse.json({ error: "Room is full" }, { status: 409 });
    }

    const cleaned = sanitizeName(String(playerName));
    if (!cleaned) {
      return NextResponse.json({ error: "Player name cannot be empty" }, { status: 400 });
    }

    const names = (room.players || []).map((p: any) => p.name || "");
    const uniqueName = makeUniqueName(names, cleaned);

    const playerId = `player_${Math.random().toString(36).slice(2, 10)}`;
    const playerToken = `${normalizedRoomCode}.${playerId}.${Math.random().toString(36).slice(2, 14)}`;

    const newPlayer = {
      id: playerId,
      userId: userId || undefined,
      name: uniqueName,
      joinedAt: Date.now(),
      score: 0,
      totalAnswered: 0,
      totalCorrect: 0,
      accuracy: 0,
      token: playerToken,
    };

    room.players = [...(room.players || []), newPlayer];
    await setRoomState(normalizedRoomCode, room);

    return NextResponse.json({
      success: true,
      player: {
        id: playerId,
        name: uniqueName,
        token: playerToken,
      },
      room: {
        roomCode: normalizedRoomCode,
        playerCount: room.players.length,
      },
    });
  } catch (error) {
    console.error("Join room error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
