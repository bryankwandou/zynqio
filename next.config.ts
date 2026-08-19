import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {},

  /**
   * next-auth 4.24 dikirim sebagai CommonJS tanpa peta "exports" yang
   * memisahkan build peramban dari build server. Akibatnya, ketika
   * SessionProvider dirender saat prerender, modulnya ikut menarik salinan
   * React untuk lingkungan server — salinan yang memang tidak punya
   * useState. Yang terlihat di layar hanyalah:
   *
   *   TypeError: Cannot read properties of null (reading 'useState')
   *       at SessionProvider
   *
   * Menyuruh Next mentranspilasi paketnya membuat sambungan React-nya
   * ikut diselesaikan dengan kondisi yang benar.
   *
   * Ini bukan galat baru. Build proyek ini sudah gagal karenanya sejak
   * sebelum perombakan, yang menjelaskan mengapa penerapan terakhir ke
   * produksi tertinggal jauh di belakang kode di repositori.
   */
  transpilePackages: ["next-auth"],

  serverExternalPackages: ["pako"],

  images: {
    remotePatterns: [
      { protocol: "https", hostname: "lh3.googleusercontent.com" },
      { protocol: "https", hostname: "avatars.githubusercontent.com" },
    ],
  },
};

export default nextConfig;
