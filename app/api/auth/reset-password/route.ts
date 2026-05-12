import { NextResponse } from "next/server";
import { redis } from "@/lib/redis";
import { getUserById, updateUserPassword } from "@/lib/user";
import crypto from "crypto";

export async function POST(req: Request) {
  try {
    const { token, password } = await req.json();

    if (!token || typeof token !== "string") {
      return NextResponse.json({ error: "Invalid reset token" }, { status: 400 });
    }

    if (!password || typeof password !== "string") {
      return NextResponse.json({ error: "Password is required" }, { status: 400 });
    }

    if (password.length < 6) {
      return NextResponse.json({ error: "Password must be at least 6 characters" }, { status: 400 });
    }

    const resetTokenHash = crypto.createHash("sha256").update(token).digest("hex");
    const resetKey = `password-reset:${resetTokenHash}`;

    const resetDataRaw = await redis.get<string | { userId: string; email: string; expiry: number }>(resetKey);
    if (!resetDataRaw) {
      return NextResponse.json({ error: "Reset token not found or has expired" }, { status: 400 });
    }

    const resetData: { userId: string; email: string; expiry: number } =
      typeof resetDataRaw === "string" ? JSON.parse(resetDataRaw) : resetDataRaw;

    if (Date.now() > resetData.expiry) {
      await redis.del(resetKey);
      return NextResponse.json({ error: "Reset token has expired" }, { status: 400 });
    }

    const { userId } = resetData;

    await updateUserPassword(userId, password);

    await redis.del(resetKey);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Reset password error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
