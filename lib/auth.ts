import { AuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import CredentialsProvider from "next-auth/providers/credentials";

if (process.env.NODE_ENV === 'production' && !process.env.NEXTAUTH_SECRET) {
  console.error("CRITICAL ERROR: NEXTAUTH_SECRET is not set in production. Please set it in Vercel environment variables.");
}

const hasGoogleKeys = process.env.GOOGLE_CLIENT_ID && 
                     process.env.GOOGLE_CLIENT_ID !== 'your_google_client_id' &&
                     process.env.GOOGLE_CLIENT_SECRET &&
                     process.env.GOOGLE_CLIENT_SECRET !== 'your_google_client_secret';

export const authOptions: AuthOptions = {
  // Use a fallback secret to prevent 500 errors if the env var is missing during initial deployment
  secret: process.env.NEXTAUTH_SECRET || "zynqio-emergency-secret-key-123",
  providers: [
    ...(hasGoogleKeys ? [
      GoogleProvider({
        clientId: process.env.GOOGLE_CLIENT_ID || "",
        clientSecret: process.env.GOOGLE_CLIENT_SECRET || "",
      })
    ] : []),
    // Developer fallback for zero-config requirement
    CredentialsProvider({
      name: 'Developer Login (No Config)',
      credentials: {
        username: { label: "Username (type 'admin')", type: "text", placeholder: "admin" },
        password: { label: "Password (any)", type: "password" }
      },
      async authorize(credentials) {
        if (credentials?.username === 'admin') {
          return { id: "1", name: "Zynqio Admin", email: "admin@zynqio.local" };
        }
        return null;
      }
    })
  ],
  session: {
    strategy: "jwt",
  },
  pages: {
    signIn: "/auth/signin",
  },
  callbacks: {
    session: ({ session, token }) => {
      if (session.user) {
        (session.user as any).id = token.sub;
      }
      return session;
    },
  },
};
