import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({
    status: "online",
    timestamp: new Date().toISOString(),
    engine: "Zynqio Autonomous Engine 1.0",
    region: process.env.VERCEL_REGION || "unknown",
  });
}
