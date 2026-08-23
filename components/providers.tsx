"use client";

import { SessionProvider } from "next-auth/react";
import { ThemeProvider } from "next-themes";
import { PenyediaBahasa } from "@/lib/bahasa";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider refetchInterval={5 * 60} refetchOnWindowFocus={true}>
      <ThemeProvider attribute="class" defaultTheme="system" enableSystem={true} disableTransitionOnChange>
        <PenyediaBahasa>{children}</PenyediaBahasa>
      </ThemeProvider>
    </SessionProvider>
  );
}
