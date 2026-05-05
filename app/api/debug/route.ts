import { NextResponse } from "next/server";

type CheckLevel = "required" | "recommended" | "optional";
type CheckState = "set" | "fallback" | "missing";

interface EnvCheck {
  key: string;
  level: CheckLevel;
  state: CheckState;
  note: string;
}

function required(key: string, isSet: boolean, note = ""): EnvCheck {
  return {
    key,
    level: "required",
    state: isSet ? "set" : "missing",
    note,
  };
}

function recommended(key: string, isSet: boolean, fallbackNote: string): EnvCheck {
  return {
    key,
    level: "recommended",
    state: isSet ? "set" : "fallback",
    note: isSet ? "" : fallbackNote,
  };
}

function optional(key: string, isSet: boolean, note = ""): EnvCheck {
  return {
    key,
    level: "optional",
    state: isSet ? "set" : "fallback",
    note,
  };
}

export async function GET() {
  const hasNextAuthSecret = Boolean(process.env.NEXTAUTH_SECRET);
  const hasNextAuthUrl = Boolean(process.env.NEXTAUTH_URL || process.env.VERCEL_URL);
  const hasGoogleOAuth = Boolean(process.env.GOOGLE_CLIENT_ID && 
                               process.env.GOOGLE_CLIENT_ID !== 'your_google_client_id' &&
                               process.env.GOOGLE_CLIENT_SECRET);
  const hasUpstash = Boolean(
    process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN &&
    !process.env.UPSTASH_REDIS_REST_URL.includes('placeholder')
  );
  const hasVercelKv = Boolean(process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN);
  const hasRedis = hasUpstash || hasVercelKv;
  const hasPusher = Boolean(
    process.env.PUSHER_APP_ID &&
      process.env.PUSHER_KEY &&
      !process.env.PUSHER_KEY.includes('placeholder')
  );
  const hasEmergencyLogin = Boolean(
    process.env.EMERGENCY_ADMIN_PASSWORD || process.env.NODE_ENV !== "production" || process.env.NEXTAUTH_SECRET
  );

  const details: EnvCheck[] = [
    required("NEXTAUTH_SECRET", hasNextAuthSecret, "Critical for session security."),
    required("NEXTAUTH_URL", hasNextAuthUrl, "Required for OAuth redirects and session cookies."),
    recommended(
      "CLOUD_STORAGE",
      hasRedis,
      "Using In-Memory Storage (Ephemeral). For persistent storage, link Vercel KV or Upstash."
    ),
    recommended(
      "REALTIME_ENGINE",
      hasPusher,
      "Using Production Polling Engine. For instant websocket events, add Pusher keys."
    ),
    recommended(
      "GOOGLE_OAUTH",
      hasGoogleOAuth,
      "Google login is active."
    ),
  ];

  const hasRequiredMissing = details.some(
    (item) => item.level === "required" && item.state === "missing"
  );
  const hasFallback = details.some((item) => item.state === "fallback");

  const statusCode = hasRequiredMissing
    ? "configuration_missing"
    : hasFallback
      ? "autonomous_mode"
      : "fully_configured";

  const statusLabel =
    statusCode === "fully_configured"
      ? "Zynqio Advanced Engine"
      : statusCode === "autonomous_mode"
        ? "Standard Cloud Engine"
        : "Configuration Required";

  return NextResponse.json({
    status: {
      code: statusCode,
      label: statusLabel,
    },
    details,
    nodeEnv: process.env.NODE_ENV || "unknown",
    vercelEnv: process.env.VERCEL_ENV || "local",
  });
}
