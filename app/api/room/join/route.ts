import { NextResponse } from "next/server";
import { getRoomState, setRoomState } from "@/lib/kv";
import { pusherServer } from "@/lib/pusher";
import { rateLimit, getIP } from "@/lib/rate-limit";

function sanitizeName(name: string) {
  return name.replace(/[<>"'&]/g, "").trim().slice(0, 500);
}

function makeUniqueName(existingNames: string[], candidate: string) {
  const normalized = candidate.toLowerCase();
  if (!existingNames.some((n) => n.toLowerCase() === normalized)) return candidate;
  let counter = 2;
  let next = `${candidate} (${counter})`;
  while (existingNames.some((n) => n.toLowerCase() === next.toLowerCase())) {
    counter++;
    next = `${candidate} (${counter})`;
  }
  return next;
}

export async function POST(req: Request) {
  try {
    // Rate limit: 5 join attempts per minute per IP
    const ip = getIP(req);
    const allowed = await rateLimit(ip, "join", 5, 60);
    if (!allowed) {
      return NextResponse.json({ error: "Too many join attempts. Please wait." }, { status: 429 });
    }

    const body = await req.json();
    const { roomCode, playerName, nickname, userId, avatarId, sessionToken } = body;
    const incomingName = playerName ?? nickname;

    if (!roomCode || !incomingName) {
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
      // Allow rejoin if game is playing and player already has a session
      if (room.status === "playing" && sessionToken) {
        const existing = (room.players || []).find((p: any) => p.token === sessionToken);
        if (existing) {
          return NextResponse.json({
            success: true,
            player: { id: existing.id, name: existing.name, token: existing.token },
            room: { roomCode: normalizedRoomCode, playerCount: room.players.length },
            reconnected: true,
          });
        }
      }
      return NextResponse.json({ error: `Room is ${room.status}` }, { status: 409 });
    }

    const maxPlayers = room.settings?.maxPlayers || 300;
    if ((room.players?.length || 0) >= maxPlayers) {
      return NextResponse.json({ error: "Room is full" }, { status: 409 });
    }

    const cleaned = sanitizeName(String(incomingName));
    if (!cleaned) {
      return NextResponse.json({ error: "Player name cannot be empty" }, { status: 400 });
    }

    // If player sends a sessionToken that matches an existing player → reconnect
    if (sessionToken) {
      const existing = (room.players || []).find((p: any) => p.token === sessionToken);
      if (existing) {
        return NextResponse.json({
          success: true,
          player: { id: existing.id, name: existing.name, token: existing.token },
          room: { roomCode: normalizedRoomCode, playerCount: room.players.length },
          reconnected: true,
        });
      }
    }

    // Check if kicked
    if ((room.kickedPlayers || []).includes(cleaned.toLowerCase())) {
      return NextResponse.json({ error: "You have been removed from this room." }, { status: 403 });
    }

    // Deduplicate name
    const existingNames = (room.players || []).map((p: any) => p.name || "");
    const uniqueName = makeUniqueName(existingNames, cleaned);

    const playerId = `player_${Math.random().toString(36).slice(2, 10)}`;
    const playerToken = `${normalizedRoomCode}.${playerId}.${Math.random().toString(36).slice(2, 14)}`;

    const newPlayer = {
      id: playerId,
      userId: userId || undefined,
      name: uniqueName,
      avatarId: avatarId || "fox",
      joinedAt: Date.now(),
      score: 0,
      totalAnswered: 0,
      totalCorrect: 0,
      accuracy: 0,
      streak: 0,
      token: playerToken,
    };

    room.players = [...(room.players || []), newPlayer];
    room.updatedAt = Date.now();
    await setRoomState(normalizedRoomCode, room);

    try {
      await pusherServer.trigger(`room-${normalizedRoomCode}`, "player_joined", {
        playerCount: room.players.length,
        player: { id: newPlayer.id, name: newPlayer.name, avatarId: newPlayer.avatarId },
      });
    } catch (e) {
      console.error("[Pusher] Join trigger error:", e);
    }

    return NextResponse.json({
      success: true,
      player: { id: playerId, name: uniqueName, token: playerToken, avatarId: newPlayer.avatarId },
      room: { roomCode: normalizedRoomCode, playerCount: room.players.length },
    });
  } catch (error) {
    console.error("Join room error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
