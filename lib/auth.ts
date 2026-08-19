import { AuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import CredentialsProvider from "next-auth/providers/credentials";
import { verifyUser, getUserByEmail, createOAuthUser } from "./user";

/**
 * Kunci penanda tangan sesi.
 *
 * Versi sebelumnya memakai nilai cadangan tetap bila peubah lingkungan
 * kosong. Nilai itu ikut tersimpan di repositori publik, sehingga sekali
 * saja NEXTAUTH_SECRET luput dipasang di produksi, siapa pun yang membaca
 * repositori bisa menempa token sesi atas nama pengguna mana pun.
 *
 * Sekarang aplikasinya menolak berjalan tanpa kunci sungguhan. Gagal saat
 * penyalaan jauh lebih murah daripada pembobolan yang tidak terlihat.
 */
const AUTH_SECRET = process.env.NEXTAUTH_SECRET;

if (!AUTH_SECRET) {
  throw new Error(
    "NEXTAUTH_SECRET belum dipasang. Buat nilainya dengan `openssl rand -base64 32`, " +
      "lalu simpan di .env.local untuk pengembangan dan di Vercel → Settings → " +
      "Environment Variables untuk produksi."
  );
}

if (AUTH_SECRET.length < 32) {
  throw new Error("NEXTAUTH_SECRET terlalu pendek. Gunakan minimal 32 karakter acak.");
}

const hasGoogleKeys = !!(
  process.env.GOOGLE_CLIENT_ID &&
  process.env.GOOGLE_CLIENT_ID !== 'your_google_client_id' &&
  process.env.GOOGLE_CLIENT_SECRET &&
  process.env.GOOGLE_CLIENT_SECRET !== 'your_google_client_secret'
);

const SESSION_MAX_AGE = 30 * 24 * 60 * 60; // 30 days in seconds
const isProd = process.env.NODE_ENV === "production";

export const authOptions: AuthOptions = {
  secret: AUTH_SECRET,
  debug: false,
  providers: [
    ...(hasGoogleKeys ? [GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    })] : []),
    CredentialsProvider({
      name: 'Zynqio Access',
      credentials: {
        email: { label: "Email", type: "email", placeholder: "your@email.com" },
        password: { label: "Password", type: "password" }
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null;
        }

        const user = await verifyUser(credentials.email, credentials.password);

        if (user) {
          return { id: user.id, name: user.username, email: user.email };
        }
        return null;
      }
    })
  ],
  session: {
    strategy: "jwt",
    maxAge: SESSION_MAX_AGE,
    updateAge: 24 * 60 * 60, // refresh token every 24h
  },
  jwt: {
    maxAge: SESSION_MAX_AGE,
  },
  cookies: {
    sessionToken: {
      name: isProd ? "__Secure-next-auth.session-token" : "next-auth.session-token",
      options: {
        httpOnly: true,
        sameSite: "lax" as const,
        path: "/",
        secure: isProd,
        maxAge: SESSION_MAX_AGE,
      },
    },
  },
  pages: {
    signIn: "/auth/signin",
  },
  callbacks: {
    signIn: async ({ user, account }) => {
      if (account?.provider === "google") {
        try {
          const email = user.email?.toLowerCase();
          if (!email) return false;

          const existingUser = await getUserByEmail(email);
          if (!existingUser) {
            // Akun dari penyedia luar tidak diberi kata sandi lokal acak.
            // Kata sandi yang tidak pernah dipakai tetap menambah bidang
            // serangan tanpa memberi manfaat apa pun.
            await createOAuthUser(email, user.name || email.split('@')[0]);
          }
          return true;
        } catch (error) {
          console.error("Gagal menyimpan pengguna Google:", error);
          // Gagal menyimpan berarti sesi berikutnya tidak punya sandaran
          // di basis data. Lebih baik tolak masuknya daripada memberi sesi
          // yang menunjuk pengguna yang tidak ada.
          return false;
        }
      }
      return true;
    },
    jwt: ({ token, user }) => {
      // Persist user.id to token on first sign-in
      if (user?.id) {
        token.userId = user.id;
      }
      return token;
    },
    session: ({ session, token }) => {
      if (session.user) {
        // Prefer explicit userId stored in jwt callback, fall back to token.sub
        (session.user as any).id = (token as any).userId || token.sub;
      }
      return session;
    },
  },
};
