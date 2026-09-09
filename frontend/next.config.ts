import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",

  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: "http://api:8000/api/:path*",
      },
    ];
  },

  turbopack: {
    resolveAlias: {
      "@": "./src",
    },
  },
};

export default nextConfig;