/**
 * Validates required environment variables at startup.
 * Called by lib/kv.ts on first import.
 */
export function validateEnv() {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!process.env.NEXTAUTH_SECRET) {
    errors.push("NEXTAUTH_SECRET is required. Generate one with: openssl rand -base64 32");
  }

  if (!process.env.NEXTAUTH_URL) {
    errors.push("NEXTAUTH_URL is required (e.g. https://zynqio.vercel.app)");
  }

  const hasKV =
    process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  if (!hasKV) {
    errors.push(
      "KV_REST_API_URL (or UPSTASH_REDIS_REST_URL) is required. " +
      "Set up Vercel KV or Upstash Redis."
    );
  }

  if (!process.env.GOOGLE_CLIENT_ID) {
    warnings.push("GOOGLE_CLIENT_ID missing — Google OAuth will be disabled");
  }

  if (!process.env.PUSHER_APP_ID) {
    warnings.push("PUSHER_APP_ID missing — realtime will fall back to polling");
  }

  if (errors.length > 0) {
    console.error("\n[Zynqio] Missing required environment variables:");
    errors.forEach((e) => console.error(`  ✗ ${e}`));
    // In production, throw; in dev just warn
    if (process.env.NODE_ENV === "production") {
      throw new Error(
        "[Zynqio] Missing required env vars:\n" + errors.join("\n")
      );
    }
  }

  if (warnings.length > 0) {
    warnings.forEach((w) => console.warn(`[Zynqio] ⚠️  ${w}`));
  }
}
