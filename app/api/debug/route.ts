import { NextResponse } from 'next/server';

export async function GET() {
  const envStatus = {
    NEXTAUTH_SECRET: process.env.NEXTAUTH_SECRET ? 'SET ✅' : 'MISSING ❌',
    NEXTAUTH_URL: process.env.NEXTAUTH_URL ? 'SET ✅' : 'MISSING ❌',
    KV_REST_API_URL: process.env.KV_REST_API_URL ? 'SET ✅' : 'AUTONOMOUS MODE ⚡',
    BLOB_READ_WRITE_TOKEN: process.env.BLOB_READ_WRITE_TOKEN ? 'SET ✅' : 'MISSING ❌',
    GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID ? 'SET ✅' : 'MISSING ❌',
    PUSHER_APP_ID: process.env.PUSHER_APP_ID ? 'SET ✅' : 'AUTONOMOUS MODE ⚡',
    NODE_ENV: process.env.NODE_ENV,
  };

  const hasMissing = Object.values(envStatus).includes('MISSING ❌');
  const hasAutonomous = Object.values(envStatus).includes('AUTONOMOUS MODE ⚡');

  let statusMsg = 'Fully Configured 🚀';
  if (hasAutonomous && !hasMissing) statusMsg = 'Autonomous Mode Active ⚡';
  if (hasMissing) statusMsg = 'Configuration Missing ⚠️';

  return NextResponse.json({
    status: statusMsg,
    details: envStatus,
    instructions: "If KV or PUSHER are in AUTONOMOUS MODE, the system will use public zero-config cloud fallbacks."
  });
}
