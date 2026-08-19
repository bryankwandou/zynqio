import { redirect } from "next/navigation";

/**
 * /j/[roomCode] — jalan pintas untuk kode ruangan.
 *
 * params ditulis sebagai Promise karena sejak Next 15 memang itu yang
 * dikirim. Halaman ini sebelumnya memperlakukannya sebagai objek biasa,
 * sehingga params.roomCode bernilai undefined dan pemanggilan
 * .toUpperCase() di atasnya melempar galat. Turbopack melewatkan ini;
 * pemeriksa tipe pada build webpack yang memunculkannya.
 */
export default async function ShortLink({
  params,
}: {
  params: Promise<{ roomCode: string }>;
}) {
  const { roomCode } = await params;
  redirect(`/join/${roomCode.toUpperCase()}`);
}
