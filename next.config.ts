import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // Covers are up to 2 MB; leave headroom for the rest of the story form.
    serverActions: { bodySizeLimit: "3mb" },
  },
};

export default nextConfig;
