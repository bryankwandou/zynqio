import { NextResponse } from 'next/server';
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { kv } from '@vercel/kv';
import { listPublicQuizzes } from '@/lib/kv';

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    const publicQuizzes = await listPublicQuizzes();
    
    if (!session || !(session.user as any)?.id || publicQuizzes.length === 0) {
      // Return top 10 general public quizzes if no session or no data
      return NextResponse.json(publicQuizzes.slice(0, 10));
    }

    // Rule-based recommendation (Section 13.3)
    const historyKeys = await kv.keys(`user:${(session.user as any).id}:history:*`);
    const categories: Record<string, number> = {};
    
    for (const key of historyKeys) {
      const item: any = await kv.get(key);
      if (item?.category) {
        categories[item.category] = (categories[item.category] || 0) + 1;
      }
    }

    // Sort categories by frequency
    const topCategories = Object.entries(categories)
      .sort((a, b) => b[1] - a[1])
      .map(e => e[0]);

    if (topCategories.length === 0) {
      return NextResponse.json(publicQuizzes.slice(0, 10));
    }

    // Filter public quizzes by top categories
    const recommended = publicQuizzes
      .filter(q => topCategories.includes(q.category || 'General'))
      .sort((a, b) => (b.plays || 0) - (a.plays || 0));

    return NextResponse.json(recommended.slice(0, 10));
  } catch (error) {
    console.error('Recommendation error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
