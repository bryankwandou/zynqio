import { NextResponse } from 'next/server';
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { kv } from '@vercel/kv';

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const historyKeys = await kv.keys(`user:${session.user.id}:history:*`);
    const history = [];
    
    for (const key of historyKeys) {
      const data = await kv.get(key);
      if (data) history.push(data);
    }

    // Sort by date descending
    return NextResponse.json(history.sort((a: any, b: any) => 
      new RegExp(b.date).test(a.date) ? -1 : 1
    ));
  } catch (error) {
    console.error('History fetch error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { quizId, title, score, accuracy, rank, totalPlayers, date } = body;

    const historyId = Math.random().toString(36).substring(2, 9);
    const key = `user:${session.user.id}:history:${historyId}`;
    
    const historyItem = {
      id: historyId,
      quizId,
      title,
      score,
      accuracy,
      rank,
      totalPlayers,
      date: date || new Date().toISOString()
    };

    await kv.set(key, historyItem);
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('History save error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
