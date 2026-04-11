import type { NextConfig } from "next";

function backendOriginForRewrites(): string {
  const raw = (process.env.BACKEND_URL ?? "http://localhost:8001").trim();
  return raw.replace(/\/+$/, "");
}

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `${backendOriginForRewrites()}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
