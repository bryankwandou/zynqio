"use client";

import { useBahasa } from "@/lib/bahasa";
import { useEffect, use } from "react";
import { useRouter } from "next/navigation";

export default function JoinRedirect({ params }: { params: Promise<{ roomCode: string }> }) {
  const { tt } = useBahasa();
  const router = useRouter();
  const unwrappedParams = use(params);

  useEffect(() => {
    // Langsung dibawa ke halaman isi nama.
    router.replace(`/play/${unwrappedParams.roomCode}/nickname`);
  }, [unwrappedParams.roomCode, router]);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center text-muted-foreground font-black uppercase tracking-widest">
      {tt("Membuka ruangan", "Opening the room")}{" "}{unwrappedParams.roomCode}…
    </div>
  );
}
