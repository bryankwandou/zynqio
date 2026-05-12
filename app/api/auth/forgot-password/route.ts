import { NextResponse } from "next/server";
import { getUserByEmail } from "@/lib/user";
import { redis } from "@/lib/redis";
import crypto from "crypto";

export async function POST(req: Request) {
  try {
    const { email } = await req.json();

    if (!email || typeof email !== "string") {
      return NextResponse.json({ error: "Email is required" }, { status: 400 });
    }

    const normalizedEmail = email.toLowerCase().trim();
    const user = await getUserByEmail(normalizedEmail);

    if (!user) {
      // Don't reveal if user exists for security
      return NextResponse.json({ success: true });
    }

    // Generate reset token (32 bytes = 64 hex chars)
    const resetToken = crypto.randomBytes(32).toString("hex");
    const resetTokenHash = crypto.createHash("sha256").update(resetToken).digest("hex");
    const resetTokenExpiry = Date.now() + 3600000; // 1 hour

    // Store reset token in Redis with 1 hour TTL
    const resetKey = `password-reset:${resetTokenHash}`;
    await redis.set(
      resetKey,
      JSON.stringify({ userId: user.id, email: user.email, expiry: resetTokenExpiry }),
      { ex: 3600 }
    );

    // Build reset URL
    const resetUrl = `${process.env.NEXTAUTH_URL || "https://zynqio.vercel.app"}/auth/reset-password?token=${resetToken}`;

    // Log for development (in production, integrate with email service like SendGrid/Resend)
    console.log(`[Password Reset] Email: ${user.email}, URL: ${resetUrl}`);

    // TODO: Send email with reset link
    // In production, use SendGrid, Resend, or similar service
    // Example with Resend:
    // await resend.emails.send({
    //   from: "noreply@zynqio.vercel.app",
    //   to: user.email,
    //   subject: "Reset your Zynqio password",
    //   html: `<a href="${resetUrl}">Reset password</a>`
    // });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Forgot password error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
