import { AuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import CredentialsProvider from "next-auth/providers/credentials";
import { verifyUser, getUserByEmail, createUser } from "./user";

if (process.env.NODE_ENV === 'production' && !process.env.NEXTAUTH_SECRET) {
  console.error("CRITICAL: NEXTAUTH_SECRET is not set. Set it in Vercel → Settings → Environment Variables.");
}

const hasGoogleKeys = !!(
  process.env.GOOGLE_CLIENT_ID &&
  process.env.GOOGLE_CLIENT_ID !== 'your_google_client_id' &&
  process.env.GOOGLE_CLIENT_SECRET &&
  process.env.GOOGLE_CLIENT_SECRET !== 'your_google_client_secret'
);

export const authOptions: AuthOptions = {
  secret: process.env.NEXTAUTH_SECRET || "zynqio-fallback-dev-secret-change-in-prod",
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
  },
  pages: {
    signIn: "/auth/signin",
  },
  callbacks: {
    signIn: async ({ user, account, profile }) => {
      if (account?.provider === "google") {
        try {
          const email = user.email?.toLowerCase();
          if (!email) return false;

          const existingUser = await getUserByEmail(email);
          if (!existingUser) {
            // Auto-register Google users in our Redis DB
            await createUser(email, user.name || email.split('@')[0], "google-oauth-managed-" + Math.random().toString(36));
          }
          return true;
        } catch (error) {
          console.error("Error persisting Google user:", error);
          return true; // Still allow sign in even if persistence fails
        }
      }
      return true;
    },
    session: ({ session, token }) => {
      if (session.user) {
        (session.user as any).id = token.sub;
      }
      return session;
    },
  },
};
