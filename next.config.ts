import type { NextConfig } from "next";

const publicUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const internalUrl = process.env.SUPABASE_INTERNAL_URL;

const nextConfig: NextConfig = {
  experimental: {
    // Covers are up to 2 MB; leave headroom for the rest of the story form.
    serverActions: { bodySizeLimit: "3mb" },
  },
  async headers() {
    return [
      {
        // The service worker must never be served stale, or fixes to offline reading would not reach readers.
        source: "/sw.js",
        headers: [
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Service-Worker-Allowed", value: "/" },
        ],
      },
    ];
  },
  // When NEXT_PUBLIC_SUPABASE_URL is a path (e.g. "/sb"), proxy it to Supabase so one port serves everything.
  async rewrites() {
    if (!publicUrl.startsWith("/") || !internalUrl) return [];
    return [{ source: `${publicUrl}/:path*`, destination: `${internalUrl.replace(/\/$/, "")}/:path*` }];
  },
};

export default nextConfig;
