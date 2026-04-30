import { AuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import CredentialsProvider from "next-auth/providers/credentials";

const hasGoogleKeys = process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_ID !== 'your_google_client_id';

export const authOptions: AuthOptions = {
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
