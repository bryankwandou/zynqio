import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { redis } from '@/lib/kv';

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !(session.user as any)?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = (session.user as any).id;
    let historyKeys: string[] = [];
    try {
      historyKeys = await (redis as any).keys(`user:${userId}:history:*`);
    } catch {
      historyKeys = [];
    }

    const history = [];
    for (const key of historyKeys) {
      const data = await redis.get<any>(key);
      if (data) history.push(data);
    }

    return NextResponse.json(
      history.sort((a: any, b: any) => {
        const dateA = new Date(a.date || 0).getTime();
        const dateB = new Date(b.date || 0).getTime();
        return dateB - dateA;
      })
    );
  } catch (error) {
    console.error('History fetch error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !(session.user as any)?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { quizId, title, score, accuracy, rank, totalPlayers, date } = body;

    const userId = (session.user as any).id;
    const historyId = Math.random().toString(36).substring(2, 9);
    const key = `user:${userId}:history:${historyId}`;

    const historyItem = {
      id: historyId,
      quizId,
      title,
      score,
      accuracy,
      rank,
      totalPlayers,
      date: date || new Date().toISOString(),
    };

    await redis.set(key, historyItem);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('History save error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
