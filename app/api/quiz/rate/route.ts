import { NextResponse } from "next/server";
import { redis, updateQuizRating } from "@/lib/kv";

async function resolveHostId(quizId: string, providedHostId?: string | null) {
  if (providedHostId) return providedHostId;

  try {
    const publicRefs: string[] = await (redis as any).smembers("public_quizzes");
    const matched = publicRefs.find((ref) => ref.endsWith(`:${quizId}`));
    if (!matched) return null;

    const [hostId] = matched.split(":");
    return hostId || null;
  } catch (error) {
    console.error("Host lookup failed:", error);
    return null;
  }
}

export async function POST(req: Request) {
  try {
    const { quizId, rating, review, hostId } = await req.json();

    const numericRating = Number(rating);
    if (!quizId || Number.isNaN(numericRating)) {
      return NextResponse.json({ error: "Missing data" }, { status: 400 });
    }
    if (numericRating < 1 || numericRating > 5) {
      return NextResponse.json({ error: "Rating must be between 1 and 5" }, { status: 400 });
    }

    const resolvedHostId = await resolveHostId(quizId, hostId);
    if (!resolvedHostId) {
      return NextResponse.json({ error: "Quiz owner not found" }, { status: 404 });
    }

    await updateQuizRating(resolvedHostId, quizId, numericRating, review);

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Rating error", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
