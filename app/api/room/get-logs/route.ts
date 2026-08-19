import { NextResponse } from 'next/server';
import { handle, requireUser } from '@/lib/api-guard';
import { assertHost, normalizeRoomCode, getEvents } from '@/lib/room';

export const dynamic = 'force-dynamic';

/**
 * GET /api/room/get-logs?roomCode=...&after=...
 *
 * Jejak kejadian sebuah ruangan memuat pergerakan tiap peserta. Versi
 * lama membukanya tanpa pemeriksaan apa pun, jadi peserta bisa membaca
 * kapan lawannya menjawab dan benar atau tidak. Sekarang hanya host.
 */
export const GET = handle(async (req) => {
  const user = await requireUser();
  const { searchParams } = new URL(req.url);

  const code = normalizeRoomCode(searchParams.get('roomCode'));
  await assertHost(code, user.id);

  const after = Number(searchParams.get('after') ?? 0);
  const events = await getEvents(code, Number.isFinite(after) ? after : 0);

  return NextResponse.json({ events }, { headers: { 'Cache-Control': 'no-store' } });
});
