import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { redis, listPublicQuizzes } from '@/lib/kv';

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    const publicQuizzes = await listPublicQuizzes();

    if (!session || !(session.user as any)?.id || publicQuizzes.length === 0) {
      return NextResponse.json(publicQuizzes.slice(0, 10));
    }

    // Rule-based recommendation (Section 13.3)
    let historyKeys: string[] = [];
    try {
      historyKeys = await (redis as any).keys(`user:${(session.user as any).id}:history:*`);
    } catch {
      historyKeys = [];
    }

    const categories: Record<string, number> = {};

    for (const key of historyKeys) {
      const item = await redis.get<any>(key);
      if (item?.category) {
        categories[item.category] = (categories[item.category] || 0) + 1;
      }
    }

    const topCategories = Object.entries(categories)
      .sort((a, b) => b[1] - a[1])
      .map((e) => e[0]);

    if (topCategories.length === 0) {
      return NextResponse.json(publicQuizzes.slice(0, 10));
    }

    const recommended = publicQuizzes
      .filter((q) => topCategories.includes(q.category || 'General'))
      .sort((a, b) => (b.plays || 0) - (a.plays || 0));

    return NextResponse.json(recommended.slice(0, 10));
  } catch (error) {
    console.error('Recommendation error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
