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
  const hasNextAuthUrl = Boolean(process.env.NEXTAUTH_URL);
  const hasGoogleOAuth = Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
  const hasUpstash = Boolean(
    process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
  );
  const hasVercelKv = Boolean(process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN);
  const hasRedis = hasUpstash || hasVercelKv;
  const hasPusher = Boolean(
    process.env.PUSHER_APP_ID &&
      process.env.PUSHER_KEY &&
      process.env.PUSHER_SECRET &&
      process.env.PUSHER_CLUSTER
  );
  const hasBlob = Boolean(process.env.BLOB_READ_WRITE_TOKEN);

  const details: EnvCheck[] = [
    required("NEXTAUTH_SECRET", hasNextAuthSecret),
    required("NEXTAUTH_URL", hasNextAuthUrl),
    recommended(
      "REDIS_BACKEND",
      hasRedis,
      "Using in-memory fallback (not persistent across serverless cold starts)."
    ),
    recommended(
      "PUSHER_CHANNELS",
      hasPusher,
      "Realtime events use mock fallback when Pusher is missing."
    ),
    recommended(
      "GOOGLE_OAUTH",
      hasGoogleOAuth,
      "Google button disabled until GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET are set."
    ),
    optional("BLOB_STORAGE", hasBlob, "Image upload stays disabled until token is set."),
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
      ? "Fully Configured"
      : statusCode === "autonomous_mode"
        ? "Autonomous Mode Active"
        : "Configuration Missing";

  return NextResponse.json({
    status: {
      code: statusCode,
      label: statusLabel,
    },
    details,
    nodeEnv: process.env.NODE_ENV || "unknown",
  });
}
