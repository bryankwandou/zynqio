"use client";

/**
 * lib/bahasa.tsx — pengalih bahasa Indonesia/Inggris.
 *
 * Aplikasi ini dipakai guru Indonesia, jadi bahasa Indonesia yang jadi
 * bawaan — bukan Inggris dengan Indonesia sebagai terjemahan. Urutan itu
 * penting: kamus di bawah ditulis dengan bahasa Indonesia lebih dulu,
 * dan versi Inggrisnya menyusul.
 *
 * Tidak memakai next-intl atau i18next. Keduanya membawa pemuat berkas,
 * penyusun jamak, dan pemformat tanggal yang tidak satu pun dibutuhkan
 * di sini — aplikasi ini punya kurang dari seratus frasa antarmuka.
 * Satu objek dan satu konteks sudah cukup, dan tidak menambah satu pun
 * kilobyte ke bundel.
 *
 * Pilihan bahasa disimpan di localStorage supaya bertahan antar
 * kunjungan, dan atribut lang pada elemen html ikut diperbarui supaya
 * pembaca layar mengucapkannya dengan lafal yang benar. Tanpa itu,
 * pembaca layar berbahasa Inggris akan membaca "Kuis langsung" dengan
 * fonem Inggris dan hasilnya tidak bisa dipahami.
 */

import { createContext, useContext, useEffect, useState, useCallback } from "react";

export type Bahasa = "id" | "en";

/**
 * Kamus antarmuka.
 *
 * Kuncinya memakai bahasa Indonesia yang dipendekkan, bukan nomor atau
 * jalur bersarang, supaya baris pemakaiannya masih terbaca tanpa harus
 * membuka berkas ini.
 */
const KAMUS = {
  masuk:            { id: "Masuk",            en: "Sign in" },
  daftar:           { id: "Daftar",           en: "Sign up" },
  jelajahi:         { id: "Jelajahi",         en: "Explore" },
  jelajahiKuis:     { id: "Jelajahi kuis",    en: "Explore quizzes" },
  gabung:           { id: "Gabung",           en: "Join" },
  kodeRuangan:      { id: "KODE",             en: "CODE" },

  judulUtama:       { id: "Kuis langsung untuk satu kelas penuh",
                      en: "Live quizzes for a whole classroom" },
  penjelasan:       { id: "Tampilkan soal di proyektor, murid menjawab dari ponsel masing-masing, dan peringkatnya bergerak seketika. Tidak perlu memasang apa pun.",
                      en: "Put the questions on the projector, students answer from their own phones, and the ranking moves as they go. Nothing to install." },
  soalSiap:         { id: "soal siap dibawakan", en: "questions ready to run" },
  soalSiapPakai:    { id: "soal siap pakai",  en: "ready-made questions" },
  kuisMapel:        { id: "kuis dari 16 mata pelajaran", en: "quizzes across 16 subjects" },
  ragamPermainan:   { id: "ragam permainan",  en: "ways to play" },

  tanpaAkun:        { id: "Murid tidak perlu punya akun untuk ikut.",
                      en: "Students do not need an account to join." },
  buatAkun:         { id: "Buat akun pengajar", en: "Create a teacher account" },
  enamCara:         { id: "Enam cara membawakannya", en: "Six ways to run it" },

  klasik:           { id: "Klasik",           en: "Classic" },
  klasikKet:        { id: "Poin dari benar dan cepatnya menjawab",
                      en: "Points for being right, and for being quick" },
  aduCepat:         { id: "Adu cepat",        en: "Fastest finger" },
  aduCepatKet:      { id: "Penjawab tercepat mengambil seluruh poin soal",
                      en: "The quickest answer takes every point on offer" },
  buruHarta:        { id: "Buru harta",       en: "Treasure hunt" },
  buruHartaKet:     { id: "Peti berisi poin muncul di sela soal",
                      en: "Point-bearing chests appear between questions" },
  sisaSatu:         { id: "Sisa satu",        en: "Last one standing" },
  sisaSatuKet:      { id: "Salah sekali, gugur dari babak",
                      en: "One wrong answer and you are out of the round" },
  beregu:           { id: "Beregu",           en: "Teams" },
  bereguKet:        { id: "Skor dijumlahkan per kelompok",
                      en: "Scores add up per group" },
  bertahan:         { id: "Bertahan",         en: "Survival" },
  bertahanKet:      { id: "Skor kembali nol setiap kali salah",
                      en: "The score returns to zero on every mistake" },

  ruangTakAda:      { id: "Ruangan tidak ditemukan. Periksa lagi kodenya.",
                      en: "No room with that code. Check it once more." },
  ruangGagalPeriksa:{ id: "Gagal memeriksa status ruangan. Coba lagi sebentar lagi.",
                      en: "Could not check the room just now. Try again shortly." },
  ruangSelesai:     { id: "Permainan di ruangan ini sudah selesai.",
                      en: "The game in this room has already finished." },
  ruangSudahMulai:  { id: "Permainan sudah dimulai, jadi ruangannya tertutup.",
                      en: "The game has started, so the room is closed." },
  sambunganBermasalah:{ id: "Sambungan bermasalah. Periksa jaringan Anda lalu coba lagi.",
                      en: "Something went wrong with the connection. Check your network and try again." },

  keTerang:         { id: "Beralih ke tampilan terang", en: "Switch to the light theme" },
  keGelap:          { id: "Beralih ke tampilan gelap",  en: "Switch to the dark theme" },
  gantiBahasa:      { id: "Ganti ke bahasa Inggris",    en: "Ganti ke bahasa Indonesia" },
  labelKode:        { id: "Kode ruangan, enam karakter", en: "Room code, six characters" },
} as const;

export type KunciTeks = keyof typeof KAMUS;

const Konteks = createContext<{
  bahasa: Bahasa;
  ganti: () => void;
  t: (k: KunciTeks) => string;
}>({ bahasa: "id", ganti: () => {}, t: (k) => KAMUS[k].id });

const PENYIMPANAN = "zynqio-bahasa";

export function PenyediaBahasa({ children }: { children: React.ReactNode }) {
  // Bawaannya Indonesia, dan sengaja tidak menebak dari navigator.language.
  // Guru Indonesia yang perangkatnya berbahasa Inggris tetap ingin
  // antarmuka Indonesia; menebak dari sistem justru menyalahi harapan itu.
  const [bahasa, setBahasa] = useState<Bahasa>("id");

  useEffect(() => {
    try {
      const disimpan = localStorage.getItem(PENYIMPANAN);
      if (disimpan === "en" || disimpan === "id") setBahasa(disimpan);
    } catch {
      // Peramban yang memblokir penyimpanan situs tetap dapat bahasa
      // bawaan. Tidak ada yang perlu dilaporkan ke orangnya.
    }
  }, []);

  useEffect(() => {
    document.documentElement.lang = bahasa;
  }, [bahasa]);

  const ganti = useCallback(() => {
    setBahasa((b) => {
      const baru: Bahasa = b === "id" ? "en" : "id";
      try {
        localStorage.setItem(PENYIMPANAN, baru);
      } catch {}
      return baru;
    });
  }, []);

  const t = useCallback((k: KunciTeks) => KAMUS[k][bahasa], [bahasa]);

  return <Konteks.Provider value={{ bahasa, ganti, t }}>{children}</Konteks.Provider>;
}

export function useBahasa() {
  return useContext(Konteks);
}

/**
 * Tombol pengalih.
 *
 * Menampilkan bahasa yang sedang aktif, bukan bahasa tujuan. Tombol
 * bertuliskan "EN" saat sedang berbahasa Inggris memberi tahu keadaan
 * sekarang; kalau ia menampilkan tujuannya, orang harus menebak apakah
 * label itu keadaan atau perintah.
 *
 * aria-label menyebutkan tujuannya, karena di situ perintahnya memang
 * yang perlu diucapkan.
 */
export function TombolBahasa({ className }: { className?: string }) {
  const { bahasa, ganti, t } = useBahasa();
  return (
    <button
      type="button"
      onClick={ganti}
      aria-label={t("gantiBahasa")}
      className={className ?? "zy-btn zy-btn-quiet"}
      style={{
        fontFamily: "var(--font-space-mono), monospace",
        fontWeight: "var(--fw-bold)",
        fontSize: "var(--fs-xs)",
        letterSpacing: "0.08em",
        minWidth: 40,
      }}
    >
      {bahasa === "id" ? "ID" : "EN"}
    </button>
  );
}
