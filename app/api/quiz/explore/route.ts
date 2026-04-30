import { NextResponse } from "next/server";
import { kv } from "@vercel/kv";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const category = searchParams.get('category');
    const query = searchParams.get('q')?.toLowerCase();

    // In a real app, you'd maintain a 'public_quizzes' index.
    // For this 100% KV autonomous setup, we'll fetch from a dedicated index.
    const quizIds = await kv.zrange('public_quizzes', 0, -1, { rev: true });
    
    const quizzes = [];
    for (const id of quizIds) {
      // Assuming quiz keys are structured as quiz:{userId}:{quizId}
      // We might need a better index if we don't know the userId.
      // Let's assume we have a flat index for public quizzes: public_quiz_data:{quizId}
      const quizData: any = await kv.get(`public_quiz_data:${id}`);
      if (quizData) {
        // Apply filters
        if (category && quizData.category !== category) continue;
        if (query && !quizData.title.toLowerCase().includes(query)) continue;
        
        quizzes.push(quizData);
      }
    }

    return NextResponse.json(quizzes);
  } catch (err) {
    console.error("Explore error", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
