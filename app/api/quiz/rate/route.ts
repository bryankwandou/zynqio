import { NextResponse } from "next/server";
import { kv } from "@vercel/kv";
import { getServerSession } from "next-auth/next";

export async function POST(req: Request) {
  try {
    const { quizId, rating, review, sessionId } = await req.json();

    if (!quizId || !rating) {
      return NextResponse.json({ error: "Missing data" }, { status: 400 });
    }

    // 1. Save individual review
    const reviewId = Math.random().toString(36).substring(7);
    const reviewData = {
      id: reviewId,
      rating,
      review,
      timestamp: Date.now(),
    };

    await kv.lpush(`quiz:${quizId}:reviews`, JSON.stringify(reviewData));

    // 2. Update aggregate rating
    const ratingKey = `quiz:${quizId}:rating_stats`;
    const stats = (await kv.get(ratingKey) as { total: number, count: number }) || { total: 0, count: 0 };
    
    stats.total += rating;
    stats.count += 1;
    
    await kv.set(ratingKey, stats);

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Rating error", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
