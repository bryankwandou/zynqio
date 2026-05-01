import { NextResponse } from "next/server";
import { listPublicQuizzes } from "@/lib/kv";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const category = searchParams.get("category")?.trim();
    const query = searchParams.get("q")?.trim().toLowerCase();

    const quizzes = await listPublicQuizzes();
    const filtered = quizzes
      .filter((quiz) => {
        if (category && quiz.category !== category) return false;

        if (query) {
          const inTitle = (quiz.title || "").toLowerCase().includes(query);
          const inAuthor = (quiz.author || "").toLowerCase().includes(query);
          if (!inTitle && !inAuthor) return false;
        }

        return true;
      })
      .sort((a, b) => (b.plays || 0) - (a.plays || 0));

    return NextResponse.json(filtered);
  } catch (err) {
    console.error("Explore error", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
