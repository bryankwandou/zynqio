/**
 * lib/api-guard.ts — penjaga yang dipakai bersama oleh route API.
 *
 * Dibuat terpisah dengan sengaja. Ketika tiap route menuliskan
 * pemeriksaannya sendiri, yang terjadi persis seperti pada versi
 * sebelumnya: sebagian route memeriksa, sebagian lupa, dan yang lupa
 * tidak terlihat sampai ada yang memanfaatkannya. Route baru sekarang
 * memanggil satu fungsi yang sama, sehingga lupa memeriksa berarti
 * tidak bisa membaca sesi sama sekali.
 */

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from './auth';
import { RoomError } from './room';

export interface Actor {
  id: string;
  email?: string | null;
  name?: string | null;
}

/** Mengembalikan pengguna yang sedang masuk, atau melempar RoomError 401. */
export async function requireUser(): Promise<Actor> {
  const session = await getServerSession(authOptions);
  const id = (session?.user as { id?: string } | undefined)?.id;

  if (!id) throw new RoomError('Perlu masuk terlebih dahulu.', 401);

  return { id, email: session?.user?.email, name: session?.user?.name };
}

/** Membaca badan permintaan JSON tanpa membiarkan isi cacat menjadi galat 500. */
export async function readJson<T = Record<string, unknown>>(req: Request): Promise<T> {
  try {
    const body = await req.json();
    if (body === null || typeof body !== 'object') {
      throw new RoomError('Badan permintaan harus berupa objek JSON.', 400);
    }
    return body as T;
  } catch (err) {
    if (err instanceof RoomError) throw err;
    throw new RoomError('Badan permintaan bukan JSON yang sah.', 400);
  }
}

/**
 * Membungkus penangan route.
 *
 * RoomError diterjemahkan menjadi kode status yang sesuai. Galat lain
 * dicatat di server dan dibalas dengan pesan umum — pesan galat asli
 * kerap memuat nama tabel, kolom, atau berkas, dan itu tidak perlu
 * sampai ke luar.
 */
/**
 * Bentuk konteks route pada Next.js 16: params tiba sebagai Promise,
 * bukan objek biasa seperti pada versi sebelumnya.
 */
export type RouteContext<P = Record<string, string>> = { params: Promise<P> };

export function handle<P = Record<string, string>>(
  fn: (req: Request, ctx: RouteContext<P>) => Promise<Response>
) {
  return async (req: Request, ctx: RouteContext<P>) => {
    try {
      return await fn(req, ctx);
    } catch (err) {
      if (err instanceof RoomError) {
        return NextResponse.json({ error: err.message }, { status: err.status });
      }
      console.error(`[${req.method} ${new URL(req.url).pathname}]`, err);
      return NextResponse.json({ error: 'Terjadi kesalahan di server.' }, { status: 500 });
    }
  };
}
