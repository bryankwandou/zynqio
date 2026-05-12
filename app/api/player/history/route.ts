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

    // Fast path: sorted-set index (score = timestamp, descending = newest first)
    let historyIds: string[] = [];
    try {
      // zrange with REV option: newest first. Upstash supports ZRANGE ... REV
      historyIds = await (redis as any).zrange(
        `user:${userId}:history_index`,
        0,
        49, // cap at 50 most recent
        { rev: true }
      );
    } catch {
      historyIds = [];
    }

    // Fallback: keys() scan for data saved before index was introduced
    if (historyIds.length === 0) {
      try {
        const rawKeys: string[] = await (redis as any).keys(`user:${userId}:history:*`);
        historyIds = rawKeys.map((k: string) => k.split(':').pop()!).filter(Boolean);
      } catch {
        historyIds = [];
      }
    }

    if (historyIds.length === 0) {
      return NextResponse.json([]);
    }

    // Batch fetch all history items in parallel (no sequential round-trips)
    const historyData = await Promise.all(
      historyIds.map((id) => redis.get<any>(`user:${userId}:history:${id}`))
    );

    const history = historyData
      .filter(Boolean)
      .sort((a: any, b: any) => {
        const dateA = new Date(a.date || 0).getTime();
        const dateB = new Date(b.date || 0).getTime();
        return dateB - dateA;
      });

    return NextResponse.json(history);
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
    const timestamp = date ? new Date(date).getTime() : Date.now();

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

    // Store item + add to sorted-set index in parallel
    await Promise.all([
      redis.set(key, historyItem),
      (redis as any).zadd(`user:${userId}:history_index`, {
        score: timestamp,
        member: historyId,
      }),
    ]);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('History save error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
