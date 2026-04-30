import { NextResponse } from 'next/server';

export async function GET() {
  const envStatus = {
    NEXTAUTH_SECRET: process.env.NEXTAUTH_SECRET ? 'SET ✅' : 'MISSING ❌',
    NEXTAUTH_URL: process.env.NEXTAUTH_URL ? 'SET ✅' : 'MISSING ❌',
    KV_REST_API_URL: process.env.KV_REST_API_URL ? 'SET ✅' : 'MISSING ❌',
    BLOB_READ_WRITE_TOKEN: process.env.BLOB_READ_WRITE_TOKEN ? 'SET ✅' : 'MISSING ❌',
    GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID ? 'SET ✅' : 'MISSING ❌',
    PUSHER_APP_ID: process.env.PUSHER_APP_ID ? 'SET ✅' : 'MISSING ❌',
    NODE_ENV: process.env.NODE_ENV,
  };

  const isConfigured = !Object.values(envStatus).includes('MISSING ❌');

  return NextResponse.json({
    status: isConfigured ? 'Fully Configured 🚀' : 'Configuration Missing ⚠️',
    details: envStatus,
    instructions: "If any are MISSING, please set them in your Vercel Project Settings > Environment Variables."
  });
}
