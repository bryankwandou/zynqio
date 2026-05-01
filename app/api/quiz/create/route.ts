import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { saveQuizData } from "@/lib/kv";

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { title, description, category, tags, visibility = "private", allowCopy = false } = body;

    if (!title || title.trim().length === 0) {
      return NextResponse.json({ error: "Title is required" }, { status: 400 });
    }

    const userId = (session.user as any).id || "admin";
    const quizId = Math.random().toString(36).substring(2, 11);
    const now = new Date().toISOString();

    const quiz = {
      id: quizId,
      userId,
      title: title.trim(),
      description: description?.trim() || "",
      category: category || "General",
      tags: Array.isArray(tags) ? tags : [],
      questions: [],
      visibility,
      allowCopy,
      questionCount: 0,
      createdAt: now,
      updatedAt: now,
      isPublished: false,
      author: session.user.name || "Anonymous",
      plays: 0,
      rating: 0,
    };

    await saveQuizData(userId, quizId, quiz);

    return NextResponse.json(
      {
        success: true,
        quiz: {
          id: quizId,
          title: quiz.title,
          createdAt: now,
          questions: 0,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("[API] Create quiz error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
