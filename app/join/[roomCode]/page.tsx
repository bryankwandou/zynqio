"use client";

import { useEffect, use } from "react";
import { useRouter } from "next/navigation";

export default function JoinRedirect({ params }: { params: Promise<{ roomCode: string }> }) {
  const router = useRouter();
  const unwrappedParams = use(params);

  useEffect(() => {
    // Automatically redirect to nickname page
    router.replace(`/play/${unwrappedParams.roomCode}/nickname`);
  }, [unwrappedParams.roomCode, router]);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center text-muted-foreground font-black uppercase tracking-widest">
      Redirecting to room {unwrappedParams.roomCode}...
    </div>
  );
}
