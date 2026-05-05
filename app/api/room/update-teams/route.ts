import { NextResponse } from "next/server";
import { getRoomState, setRoomState } from "@/lib/kv";
import { pusherServer } from "@/lib/pusher";

export async function POST(req: Request) {
  try {
    const { roomCode, teams } = await req.json();

    if (!roomCode || !teams) {
      return NextResponse.json({ error: "Missing data" }, { status: 400 });
    }

    const roomState: any = await getRoomState(roomCode);

    if (!roomState) {
      return NextResponse.json({ error: "Room not found" }, { status: 404 });
    }

    // Update players with their teams
    const updatedPlayers = roomState.players.map((p: any) => {
      let playerTeam = null;
      for (const teamName in teams) {
        if (teams[teamName].find((tp: any) => tp.id === p.id)) {
          playerTeam = teamName;
          break;
        }
      }
      return { ...p, team: playerTeam };
    });

    roomState.players = updatedPlayers;
    roomState.teams = teams; // Store team structure for host

    await setRoomState(roomCode, roomState);
    
    // Trigger Pusher event
    try {
      await pusherServer.trigger(`room-${roomCode}`, 'teams_updated', {
        teams: roomState.teams,
        players: roomState.players
      });
    } catch (e) {
      console.error("[Pusher] Teams-updated trigger error:", e);
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Update teams error", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
