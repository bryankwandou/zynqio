import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { getQuizData, saveQuizData } from "@/lib/kv";

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { quizId, question } = body;

    if (!quizId || !question) {
      return NextResponse.json({ error: "Quiz ID and question required" }, { status: 400 });
    }

    const userId = (session.user as any).id || "admin";
    const quiz = await getQuizData(userId, quizId);

    if (!quiz) {
      return NextResponse.json({ error: "Quiz not found" }, { status: 404 });
    }

    const questionId = Math.random().toString(36).substring(2, 11);
    const newQuestion = {
      id: questionId,
      type: question.type || "MCQ",
      text: question.text || "",
      options: question.options || [],
      correctAnswer: question.correctAnswer,
      points: question.points || 1,
      timeOverride: question.timeOverride,
    };

    quiz.questions.push(newQuestion);
    quiz.questionCount = quiz.questions.length;
    quiz.updatedAt = new Date().toISOString();

    await saveQuizData(userId, quizId, quiz);

    return NextResponse.json(
      {
        success: true,
        question: newQuestion,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("[API] Add question error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
