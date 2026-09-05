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
  kuisMapel:        { id: "kuis dari {n} mata pelajaran", en: "quizzes across {n} subjects" },
  soalSiapKosong:   { id: "Bank soal siap dibawakan", en: "Question bank ready to run" },
  ragamPermainan:   { id: "ragam permainan",  en: "ways to play" },

  tanpaAkun:        { id: "Murid tidak perlu punya akun untuk ikut.",
                      en: "Students do not need an account to join." },
  buatAkun:         { id: "Buat akun pengajar", en: "Create a teacher account" },
  enamCara:         { id: "Enam cara membawakannya", en: "Six ways to run it" },

  klasik:           { id: "Klasik",           en: "Classic" },
  klasikKet:        { id: "Poin dari benar dan cepatnya menjawab",
                      en: "Points for being right, and for being quick" },
  aduCepat:         { id: "Adu cepat",        en: "Fastest finger" },
  aduCepatKet:      { id: "Makin cepat makin besar poinnya; salah dikurangi 100",
                      en: "The quicker the answer, the more it scores; wrong answers cost 100" },
  buruHarta:        { id: "Buru harta",       en: "Treasure hunt" },
  buruHartaKet:     { id: "Peti berisi poin muncul di sela soal",
                      en: "Point-bearing chests appear between questions" },
  sisaSatu:         { id: "Sisa satu",        en: "Last one standing" },
  sisaSatuKet:      { id: "Satu jawaban salah menghapus skor dari awal",
                      en: "One wrong answer wipes the score back to zero" },
  beregu:           { id: "Beregu",           en: "Teams" },
  bereguKet:        { id: "Skor dijumlahkan per kelompok",
                      en: "Scores add up per group" },
  gugur:            { id: "Gugur",            en: "Knockout" },
  gugurKet:         { id: "Satu jawaban salah mengurangi nyawa",
                      en: "Every wrong answer costs a life" },

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
// ── Halaman masuk dan daftar ──────────────────────────────────────
  masukSub:         { id: "Lanjutkan ke ruang kerja Anda",
                      en: "Continue to your workspace" },
  daftarJudul:      { id: "Buat akun",                en: "Create an account" },
  daftarSub:        { id: "Mulai susun kuis untuk kelas Anda",
                      en: "Start building quizzes for your class" },
  masukGoogle:      { id: "Masuk dengan Google",      en: "Sign in with Google" },
  segera:           { id: "Segera",                   en: "Soon" },
  atau:             { id: "ATAU",                     en: "OR" },

  labelEmail:       { id: "Email",                    en: "Email" },
  labelSandi:       { id: "Kata sandi",               en: "Password" },
  labelSandiBaru:   { id: "Kata sandi baru",          en: "New password" },
  labelSandiUlang:  { id: "Ulangi kata sandi",        en: "Repeat the password" },
  labelNama:        { id: "Nama tampilan",            en: "Display name" },
  isiEmail:         { id: "nama@sekolah.sch.id",      en: "name@school.edu" },
  isiNama:          { id: "Nama yang dilihat peserta", en: "The name students will see" },
  minKarakter:      { id: "Minimal {n} karakter.",    en: "At least {n} characters." },

  lupaSandiTanya:   { id: "Lupa kata sandi?",         en: "Forgotten your password?" },
  sedangMasuk:      { id: "Sedang masuk",             en: "Signing in" },
  sedangMendaftar:  { id: "Sedang mendaftar",         en: "Creating the account" },
  belumPunyaAkun:   { id: "Belum punya akun?",        en: "No account yet?" },
  buatSekarang:     { id: "Buat sekarang",            en: "Create one now" },
  sudahPunyaAkun:   { id: "Sudah punya akun?",        en: "Already have an account?" },
  masukDiSini:      { id: "Masuk di sini",            en: "Sign in here" },

  // Pesan galat. Sengaja tidak membedakan email keliru dari sandi
  // keliru, dalam kedua bahasa, supaya tidak memberi tahu orang asing
  // bahwa sebuah email terdaftar di sini.
  galatKredensial:  { id: "Email atau kata sandi tidak cocok.",
                      en: "That email and password do not match." },
  galatMasuk:       { id: "Proses masuk gagal. Coba lagi sebentar lagi.",
                      en: "Signing in failed. Try again in a moment." },
  galatDaftar:      { id: "Pendaftaran gagal. Coba lagi sebentar lagi.",
                      en: "Creating the account failed. Try again in a moment." },
  // Pendaftaran sengaja membalas sama untuk email baru dan email yang
  // sudah terdaftar, supaya halaman ini tidak bisa dipakai memeriksa
  // siapa punya akun di sini. Tetapi kalimat lamanya — "Akun Anda sudah
  // dibuat" — mengubah kerahasiaan itu menjadi jebakan: orang yang
  // mendaftar ulang dengan kata sandi baru percaya sandi itu terpasang,
  // padahal tidak ada yang berubah. Ia lalu tidak bisa masuk dan
  // menyimpulkan akunnya hilang.
  //
  // Kalimat penggantinya benar untuk kedua kemungkinan sekaligus, jadi
  // tidak ada yang bocor dan tidak ada yang tersesat.
  akunSudahDibuat:  { id: "Pendaftaran diterima. Bila alamat itu belum punya akun, akunnya sudah dibuat — silakan masuk. Bila sudah punya, masuklah dengan kata sandi lama, atau pulihkan lewat Lupa kata sandi.",
                      en: "Registration received. If that address had no account, one has been created — please sign in. If it already had one, sign in with the existing password, or recover it via Forgotten password." },

  // ── Layar guru saat permainan berjalan ────────────────────────────
  //
  // Kalimat-kalimat ini sebelumnya tertulis langsung di dalam
  // app/host/[roomCode]/play/page.tsx, sebagian Inggris dan sebagian
  // Indonesia, di layar yang sama. Menekan tombol bahasa di sana tidak
  // menggerakkan satu kata pun.
  klasikSpanduk:    { id: "KLASIK — Tiap peserta maju dengan kecepatannya sendiri",
                      en: "CLASSIC — Player-paced · each player advances at their own speed" },
  tamatKecil:       { id: "tamat",                    en: "finished" },
  memuatKecil:      { id: "memuat...",                en: "loading..." },
  ketepatanKecil:   { id: "Ketepatan",                en: "Accuracy" },
  ketepatanSingkat: { id: "Tepat",                    en: "Acc" },
  peringkatLangsung:{ id: "Peringkat langsung",       en: "Live ranking" },
  pesertaKecil:     { id: "peserta",                  en: "players" },
  benarKecil:       { id: "Benar",                    en: "Correct" },
  salahKecil:       { id: "Salah",                    en: "Wrong" },
  sebagianBenarKecil:{ id: "Sebagian benar",          en: "Partly correct" },
  riwayatSoalTakTermuat: { id: "rincian per-soal tidak termuat",
                      en: "per-question detail unavailable" },

  // ── Lupa dan ganti kata sandi ─────────────────────────────────────
  lupaJudul:        { id: "Lupa kata sandi",          en: "Forgotten password" },
  lupaSub:          { id: "Masukkan email Anda untuk meminta tautan penggantian",
                      en: "Enter your email to request a reset link" },
  kirimTautan:      { id: "Kirim tautan",             en: "Send the link" },
  sedangMengirim:   { id: "Sedang mengirim",          en: "Sending" },
  // Pengiriman surel belum terpasang: tautannya diterbitkan, tetapi
  // hanya sampai ke catatan peladen. Kalimat lamanya menyuruh orang
  // memeriksa kotak masuk yang tidak akan pernah kedatangan apa pun,
  // sehingga satu-satunya jalan pulih dari lupa sandi tampak berfungsi
  // padahal buntu. Selama pengirimnya belum ada, halaman ini menyebut
  // keadaan yang sebenarnya dan menunjuk jalan yang benar-benar bisa
  // ditempuh.
  periksaJudul:     { id: "Permintaan sudah dicatat",  en: "Your request is recorded" },
  periksaSub:       { id: "Pengiriman surel belum terpasang di layanan ini, jadi tautannya tidak dikirim ke kotak masuk. Hubungi pengelola kelas untuk menerima tautan penggantian Anda.",
                      en: "Email delivery is not yet configured here, so the link is not sent to your inbox. Ask your class administrator for your reset link." },
  kembaliMasuk:     { id: "Kembali ke halaman masuk", en: "Back to the sign-in page" },
  galatPermintaan:  { id: "Permintaan gagal diproses. Coba lagi sebentar lagi.",
                      en: "The request could not be processed. Try again in a moment." },

  sandiBaruJudul:   { id: "Kata sandi baru",          en: "New password" },
  sandiBaruSub:     { id: "Pilih kata sandi yang belum pernah Anda pakai di layanan lain",
                      en: "Choose a password you have not used on any other service" },
  sandiDigantiJudul:{ id: "Kata sandi diganti",       en: "Password changed" },
  sandiDigantiSub:  { id: "Anda akan diarahkan ke halaman masuk",
                      en: "You are being taken to the sign-in page" },
  sandiDigantiKet:  { id: "Silakan masuk dengan kata sandi yang baru.",
                      en: "Please sign in with your new password." },
  tautanMatiJudul:  { id: "Tautan tidak berlaku",     en: "Link no longer valid" },
  tautanMatiSub:    { id: "Tautan penggantian ini tidak bisa dipakai",
                      en: "This reset link cannot be used" },
  sandiBelumSama:   { id: "Kedua kata sandi belum sama.",
                      en: "The two passwords do not match yet." },
  galatGantiSandi:  { id: "Penggantian gagal. Tautannya mungkin sudah dipakai atau kedaluwarsa.",
                      en: "The change failed. The link may already be used or expired." },
  simpanSandi:      { id: "Simpan kata sandi",        en: "Save the password" },
  sedangMenyimpan:  { id: "Sedang menyimpan",         en: "Saving" },
  tautanTakLengkap: { id: "Tautan ini tidak lengkap atau sudah kedaluwarsa. Silakan minta tautan baru.",
                      en: "This link is incomplete or has expired. Please request a new one." },
  mintaTautanBaru:  { id: "Minta tautan baru",         en: "Request a new link" },
  tautanTerkirimKet:{ id: "Kami mengirim tautan ke {email} apabila alamat itu terdaftar. Tautannya berlaku satu jam. Bila tidak ada di kotak masuk, coba periksa folder spam.",
                      en: "We sent a link to {email} if that address is registered. The link is valid for one hour. If it is not in your inbox, check the spam folder." },

  // ── Bilah samping guru, tampil di setiap halaman guru ─────────────
  navKuisSaya:      { id: "Kuis saya",                en: "My quizzes" },
  navSusunKuis:     { id: "Susun kuis",               en: "Build a quiz" },
  navJelajahi:      { id: "Jelajahi",                 en: "Explore" },
  navRiwayat:       { id: "Riwayat",                  en: "History" },
  navKuisTersusun:  { id: "Kuis tersusun",            en: "Quizzes built" },
  pengajar:         { id: "Pengajar",                 en: "Teacher" },
  temaTerang:       { id: "Terang",                   en: "Light" },
  temaGelap:        { id: "Gelap",                    en: "Dark" },
  keluarAkun:       { id: "Keluar dari akun",         en: "Sign out of this account" },
  tutupMenu:        { id: "Tutup menu",               en: "Close the menu" },
  bukaMenu:         { id: "Buka menu",                en: "Open the menu" },

  // ── Kuis saya ─────────────────────────────────────────────────────
  memuat:           { id: "Memuat",                   en: "Loading" },
  selamatDatang:    { id: "Selamat datang kembali, {nama}",
                      en: "Welcome back, {nama}" },
  kuisBaru:         { id: "Kuis baru",                en: "New quiz" },
  ringkasKuis:      { id: "Kuis",                     en: "Quizzes" },
  ringkasSoal:      { id: "Soal",                     en: "Questions" },
  ringkasPublik:    { id: "Terbuka untuk umum",       en: "Open to everyone" },
  belumAdaKuis:     { id: "Belum ada kuis",           en: "No quizzes yet" },
  belumAdaKuisKet:  { id: "Susun kuis pertama Anda, atau ambil salah satu dari katalog umum lalu ubah sesuai kebutuhan kelas.",
                      en: "Build your first quiz, or take one from the public catalogue and adapt it to your class." },
  lihatKatalog:     { id: "Lihat katalog",            en: "Browse the catalogue" },
  badgeUmum:        { id: "Umum",                     en: "Public" },
  badgePribadi:     { id: "Pribadi",                  en: "Private" },
  satuanSoal:       { id: "soal",                     en: "questions" },
  mulai:            { id: "Mulai",                    en: "Start" },
  ubahKuis:         { id: "Ubah kuis {judul}",        en: "Edit the quiz {judul}" },
  hapusKuis:        { id: "Hapus kuis {judul}",       en: "Delete the quiz {judul}" },
  konfirmasiHapus:  { id: "Hapus \"{judul}\"? Soal di dalamnya ikut terhapus dan tidak bisa dikembalikan.",
                      en: "Delete \"{judul}\"? The questions inside go with it and cannot be brought back." },

  // ── Jelajahi ──────────────────────────────────────────────────────
  cariJudul:        { id: "Cari judul kuis",          en: "Search quiz titles" },
  saringMapel:      { id: "Saring menurut mata pelajaran", en: "Filter by subject" },
  takAdaCocok:      { id: "Tidak ada yang cocok",     en: "Nothing matches" },
  takAdaCocokKet:   { id: "Coba kata kunci lain, atau lepas saringan mata pelajarannya.",
                      en: "Try another keyword, or clear the subject filter." },
  katalogKosong:    { id: "Katalog umum masih kosong.", en: "The public catalogue is still empty." },
  badgeBaru:        { id: "Baru",                     en: "New" },
  semuaMapel:       { id: "Semua",                    en: "All" },
  buka:             { id: "Buka",                     en: "Open" },
  jelajahiKet:      { id: "Kuis siap pakai yang bisa langsung dibawakan atau disalin lalu diubah",
                      en: "Ready-made quizzes you can run straight away, or copy and adapt" },
  cariKuis:         { id: "Cari kuis",                en: "Search quizzes" },
  tampilkanSemua:   { id: "Tampilkan semua",          en: "Show everything" },
  bukaKuis:         { id: "Buka kuis {judul}",        en: "Open the quiz {judul}" },

  // ── Riwayat ───────────────────────────────────────────────────────
  riwayatSesi:      { id: "Riwayat",                  en: "History" },
  riwayatLaporan:   { id: "Laporan",                  en: "Report" },
  bagianRiwayat:    { id: "Bagian riwayat",           en: "History sections" },
  memuatRiwayat:    { id: "Memuat riwayat…",          en: "Loading history…" },
  ketepatanTiapSesi:{ id: "Ketepatan kelas pada tiap sesi terakhir",
                      en: "Class accuracy across the most recent sessions" },
  ketepatanKelasKecil:{ id: "ketepatan kelas",        en: "class accuracy" },
  belumAdaSaran:    { id: "Belum ada saran.",         en: "No suggestions yet." },
  riwayatKet:       { id: "Sesi yang sudah Anda bawakan dan kuis yang Anda susun",
                      en: "The sessions you have run and the quizzes you have built" },
  tabSesi:          { id: "Sesi yang dibawakan",      en: "Sessions run" },
  sesiTerakhir:     { id: "Sesi terakhir",            en: "Recent sessions" },
  koleksiKuis:      { id: "Koleksi kuis",             en: "Your quizzes" },
  belumAdaSesi:     { id: "Belum ada sesi yang selesai. Setelah satu kuis dibawakan sampai tuntas, ringkasannya muncul di sini.",
                      en: "No session has finished yet. Once you run a quiz all the way through, its summary appears here." },
  belumAdaKuisTitik:{ id: "Belum ada kuis.",          en: "No quizzes yet." },
  susunYangPertama: { id: "Susun yang pertama",       en: "Build your first one" },
  kuisMungkinCocok: { id: "KUIS YANG MUNGKIN COCOK",  en: "QUIZZES THAT MIGHT SUIT" },
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
