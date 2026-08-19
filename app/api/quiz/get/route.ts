import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { getQuizForOwner, getQuizForPlayers, getQuizMeta } from '@/lib/quiz';

/**
 * GET /api/quiz/get?quizId=...
 *
 * Bentuk lama endpoint ini menerima hostId dan quizId dari querystring
 * tanpa pemeriksaan apa pun, lalu mengembalikan gumpalan kuis apa adanya —
 * termasuk correctAnswer setiap soal. Peserta yang sedang bermain cukup
 * membuka alamat ini di tab lain untuk melihat seluruh kunci jawaban.
 * Kuis bertanda private pun terbaca oleh siapa saja yang tahu kedua id itu.
 *
 * Sekarang ada dua jalan yang terpisah tegas:
 *   - pemilik kuis menerima bentuk lengkap;
 *   - selain itu, hanya kuis publik, dan tanpa kunci jawaban.
 */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const quizId = searchParams.get('quizId');

  if (!quizId) {
    return NextResponse.json({ error: 'Parameter quizId wajib diisi.' }, { status: 400 });
  }

  try {
    const session = await getServerSession(authOptions);
    const userId = (session?.user as { id?: string } | undefined)?.id;

    if (userId) {
      const owned = await getQuizForOwner(quizId, userId);
      if (owned) {
        return NextResponse.json({ ...owned.quiz, questions: owned.questions, isOwner: true });
      }
    }

    const meta = await getQuizMeta(quizId);

    // Kuis pribadi menjawab sama persis dengan kuis yang tidak ada.
    // Membedakan keduanya akan memberi tahu penebak bahwa id-nya benar.
    if (!meta || meta.visibility === 'private') {
      return NextResponse.json({ error: 'Kuis tidak ditemukan.' }, { status: 404 });
    }

    const visible = await getQuizForPlayers(quizId);
    if (!visible) {
      return NextResponse.json({ error: 'Kuis tidak ditemukan.' }, { status: 404 });
    }

    return NextResponse.json({ ...visible.quiz, questions: visible.questions, isOwner: false });
  } catch (error) {
    console.error('Gagal mengambil kuis:', error);
    return NextResponse.json({ error: 'Terjadi kesalahan di server.' }, { status: 500 });
  }
}
