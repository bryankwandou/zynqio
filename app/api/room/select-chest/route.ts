import { NextResponse } from "next/server";
import { getRoomState, setRoomState, redis } from "@/lib/kv";

export async function POST(req: Request) {
  try {
    const { roomCode, playerId, chestIndex } = await req.json();

    if (!roomCode || !playerId) {
      return NextResponse.json({ error: "Missing data" }, { status: 400 });
    }

    const roomState: any = await getRoomState(roomCode);

    if (!roomState) {
      return NextResponse.json({ error: "Room not found" }, { status: 404 });
    }

    const playerIndex = roomState.players.findIndex((p: any) => p.id === playerId);
    if (playerIndex === -1) {
      return NextResponse.json({ error: "Player not found" }, { status: 404 });
    }

    // Gold Quest Outcomes (Section 10.4)
    const outcomes = [
      { type: 'gold', amount: 500, label: '+500 Gold!' },
      { type: 'gold', amount: 200, label: '+200 Gold!' },
      { type: 'steal', amount: 100, label: 'Steal 100 Gold!' },
      { type: 'jackpot', amount: 1000, label: 'JACKPOT +1000!' },
      { type: 'gold', amount: -100, label: '-100 Gold... Oh no!' }
    ];

    const outcome = outcomes[Math.floor(Math.random() * outcomes.length)];
    let notification = `${roomState.players[playerIndex].name} opened a chest: ${outcome.label}`;

    if (outcome.type === 'steal') {
      // Find a victim (random player excluding self)
      const otherPlayers = roomState.players.filter((p: any) => p.id !== playerId);
      if (otherPlayers.length > 0) {
        const victim = otherPlayers[Math.floor(Math.random() * otherPlayers.length)];
        const victimIndex = roomState.players.findIndex((p: any) => p.id === victim.id);
        
        roomState.players[victimIndex].gold = Math.max(0, (roomState.players[victimIndex].gold || 0) - 100);
        roomState.players[playerIndex].gold = (roomState.players[playerIndex].gold || 0) + 100;
        notification = `${roomState.players[playerIndex].name} stole 100 gold from ${victim.name}!`;
      } else {
        // Fallback if no one else
        roomState.players[playerIndex].gold = (roomState.players[playerIndex].gold || 0) + 100;
      }
    } else {
      roomState.players[playerIndex].gold = Math.max(0, (roomState.players[playerIndex].gold || 0) + outcome.amount);
    }

    // Log the event for realtime signaling
    const logKey = `room:${roomCode}:logs`;
    const logEntry = {
      event: 'steal',
      playerId: roomState.players[playerIndex].name,
      label: outcome.label,
      timestamp: Date.now()
    };
    try {
      await (redis as any).rpush(logKey, JSON.stringify(logEntry));
    } catch {
      const existing: string[] = (await redis.get<string[]>(logKey)) || [];
      existing.push(JSON.stringify(logEntry));
      await redis.set(logKey, existing, { ex: 86400 });
    }

    await setRoomState(roomCode, roomState);

    return NextResponse.json({ success: true, outcome });
  } catch (err) {
    console.error("Chest selection error", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
