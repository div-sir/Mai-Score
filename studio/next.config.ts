import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  async headers() {
    return [{
      source: "/data/catalog.json",
      headers: [
        { key: "Access-Control-Allow-Origin", value: "*" },
        { key: "Cache-Control", value: "public, max-age=3600, stale-while-revalidate=86400" }
      ]
    }];
  },
  turbopack: {
    root: process.cwd()
  }
};

export default nextConfig;
