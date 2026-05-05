import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

interface EnvCheck {
  key: string;
  required: boolean;
  status: "set" | "missing";
  note?: string;
}

export async function GET() {
  const checks: EnvCheck[] = [
    {
      key: "NEXTAUTH_SECRET",
      required: true,
      status: process.env.NEXTAUTH_SECRET ? "set" : "missing",
      note: "Generate with: openssl rand -base64 32",
    },
    {
      key: "NEXTAUTH_URL",
      required: true,
      status: process.env.NEXTAUTH_URL ? "set" : "missing",
      note: "Set to https://zynqio.vercel.app in Vercel",
    },
    {
      key: "UPSTASH_REDIS_REST_URL",
      required: true,
      status: (process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL) ? "set" : "missing",
      note: "From Upstash console or Vercel KV integration",
    },
    {
      key: "UPSTASH_REDIS_REST_TOKEN",
      required: true,
      status: (process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN) ? "set" : "missing",
      note: "From Upstash console or Vercel KV integration",
    },
    {
      key: "GOOGLE_CLIENT_ID",
      required: false,
      status: process.env.GOOGLE_CLIENT_ID ? "set" : "missing",
      note: "Optional — enables Google login. Get from console.cloud.google.com",
    },
    {
      key: "GOOGLE_CLIENT_SECRET",
      required: false,
      status: process.env.GOOGLE_CLIENT_SECRET ? "set" : "missing",
      note: "Optional — required if GOOGLE_CLIENT_ID is set",
    },
    {
      key: "PUSHER_APP_ID",
      required: false,
      status: process.env.PUSHER_APP_ID ? "set" : "missing",
      note: "Optional — enables real-time events. Get from pusher.com",
    },
    {
      key: "PUSHER_KEY",
      required: false,
      status: process.env.PUSHER_KEY ? "set" : "missing",
    },
    {
      key: "PUSHER_SECRET",
      required: false,
      status: process.env.PUSHER_SECRET ? "set" : "missing",
    },
  ];

  const required = checks.filter((c) => c.required);
  const allRequiredSet = required.every((c) => c.status === "set");
  const missingRequired = required.filter((c) => c.status === "missing").map((c) => c.key);

  return NextResponse.json({
    status: allRequiredSet ? "ready" : "missing_config",
    mode: (() => {
      const hasRedis = checks.find((c) => c.key === "UPSTASH_REDIS_REST_URL")?.status === "set";
      const hasPusher = checks.find((c) => c.key === "PUSHER_APP_ID")?.status === "set";
      if (hasRedis && hasPusher) return "full";
      if (hasRedis) return "persistent_no_realtime";
      return "ephemeral";
    })(),
    missing_required: missingRequired,
    checks,
    instructions: allRequiredSet ? null : {
      vercel_dashboard: "https://vercel.com/dashboard → Your Project → Settings → Environment Variables",
      required_vars: missingRequired,
    },
  });
}
