import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { getQuizData, saveQuizData } from "@/lib/kv";

export async function PUT(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { quizId, questionId, updates } = body;

    if (!quizId || !questionId) {
      return NextResponse.json({ error: "Quiz ID and Question ID required" }, { status: 400 });
    }

    const userId = (session.user as any).id || "admin";
    const quiz = await getQuizData(userId, quizId);

    if (!quiz) {
      return NextResponse.json({ error: "Quiz not found" }, { status: 404 });
    }

    const questionIndex = quiz.questions.findIndex((q: any) => q.id === questionId);
    if (questionIndex === -1) {
      return NextResponse.json({ error: "Question not found" }, { status: 404 });
    }

    quiz.questions[questionIndex] = {
      ...quiz.questions[questionIndex],
      ...updates,
    };
    quiz.updatedAt = new Date().toISOString();

    await saveQuizData(userId, quizId, quiz);

    return NextResponse.json({
      success: true,
      question: quiz.questions[questionIndex],
    });
  } catch (error) {
    console.error("[API] Update question error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const quizId = searchParams.get("quizId");
    const questionId = searchParams.get("questionId");

    if (!quizId || !questionId) {
      return NextResponse.json({ error: "Quiz ID and Question ID required" }, { status: 400 });
    }

    const userId = (session.user as any).id || "admin";
    const quiz = await getQuizData(userId, quizId);

    if (!quiz) {
      return NextResponse.json({ error: "Quiz not found" }, { status: 404 });
    }

    quiz.questions = quiz.questions.filter((q: any) => q.id !== questionId);
    quiz.questionCount = quiz.questions.length;
    quiz.updatedAt = new Date().toISOString();

    await saveQuizData(userId, quizId, quiz);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[API] Delete question error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
