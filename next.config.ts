import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Enable Turbopack (default in Next.js 16) with empty config to avoid warnings
  turbopack: {},
  // Externalize server-only packages from client bundles
  serverExternalPackages: ['pako'],
};

export default nextConfig;
