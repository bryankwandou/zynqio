/**
 * lib/player-session.ts — sesi peserta di sisi peramban.
 *
 * Dibuat satu tempat karena sebelumnya tiap halaman membaca dan menulis
 * localStorage dengan nama kunci masing-masing, dan beberapa di antaranya
 * tidak cocok satu sama lain. Peserta yang berpindah halaman kadang
 * kehilangan identitasnya di tengah permainan tanpa sebab yang terlihat.
 *
 * Semua fungsi di sini aman dipanggil saat render di server: kalau
 * window tidak ada, hasilnya null, bukan galat.
 */

const KEY_TOKEN = 'zynqio.player.token';
const KEY_ROOM = 'zynqio.player.room';
const KEY_NAME = 'zynqio.player.name';
const KEY_ID = 'zynqio.player.id';
const KEY_AVATAR = 'zynqio.player.avatar';

/** Nama kunci lama, dibersihkan sekali saat sesi baru disimpan. */
const LEGACY_KEYS = [
  'zynqio_nickname',
  'zynqio_session_token',
  'zynqio_player_id',
  'zynqio_room_code',
  'zynqio_avatar',
];

export interface PlayerSession {
  token: string;
  roomCode: string;
  name: string;
  id: string;
  avatarId: string;
}

function available(): boolean {
  return typeof window !== 'undefined' && !!window.localStorage;
}

export function saveSession(session: PlayerSession): void {
  if (!available()) return;
  try {
    localStorage.setItem(KEY_TOKEN, session.token);
    localStorage.setItem(KEY_ROOM, session.roomCode.toUpperCase());
    localStorage.setItem(KEY_NAME, session.name);
    localStorage.setItem(KEY_ID, session.id);
    localStorage.setItem(KEY_AVATAR, session.avatarId);
    LEGACY_KEYS.forEach((k) => localStorage.removeItem(k));
  } catch {
    // Penyimpanan bisa penuh atau diblokir mode penyamaran. Permainan
    // tetap bisa berjalan dalam satu halaman tanpa ini.
  }
}

/** Sesi untuk ruangan tertentu, atau null bila tidak cocok. */
export function readSession(roomCode: string): PlayerSession | null {
  if (!available()) return null;
  try {
    const token = localStorage.getItem(KEY_TOKEN);
    const room = localStorage.getItem(KEY_ROOM);
    if (!token || !room || room !== roomCode.toUpperCase()) return null;

    return {
      token,
      roomCode: room,
      name: localStorage.getItem(KEY_NAME) ?? '',
      id: localStorage.getItem(KEY_ID) ?? '',
      avatarId: localStorage.getItem(KEY_AVATAR) ?? 'fox',
    };
  } catch {
    return null;
  }
}

/**
 * Nama peserta tanpa menyebut ruangan.
 *
 * Dipakai halaman hasil, yang dialamatkan dengan sessionId dan karena itu
 * tidak tahu kode ruangannya. Hanya untuk menyapa dan menyorot baris
 * peserta di papan peringkat — bukan untuk menentukan hak apa pun.
 */
export function readAnySessionName(): string {
  if (!available()) return '';
  try {
    return localStorage.getItem(KEY_NAME) ?? '';
  } catch {
    return '';
  }
}

export function clearSession(): void {
  if (!available()) return;
  try {
    [KEY_TOKEN, KEY_ROOM, KEY_NAME, KEY_ID, KEY_AVATAR, ...LEGACY_KEYS].forEach((k) =>
      localStorage.removeItem(k)
    );
  } catch {
    // tidak apa-apa
  }
}

/**
 * Menanyakan ke server apakah sesi ini masih berlaku.
 * Jawaban null berarti tokennya tidak dikenal, sudah dikeluarkan, atau
 * ruangannya sudah tidak ada — pemanggil sebaiknya membersihkan sesinya.
 */
export async function verifySession(
  roomCode: string,
  token: string
): Promise<{ id: string; name: string; avatarId: string; score: number } | null> {
  try {
    const res = await fetch('/api/room/me', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ roomCode, playerToken: token }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.player ?? null;
  } catch {
    return null;
  }
}
