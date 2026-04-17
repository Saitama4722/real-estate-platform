import type { NextConfig } from "next";

function backendOriginForRewrites(): string {
  const trimEnd = (s: string) => s.replace(/\/+$/, "");
  const backend = (process.env.BACKEND_URL ?? "").trim();
  if (backend) return trimEnd(backend);
  const apiUrl = (process.env.NEXT_PUBLIC_API_URL ?? "").trim();
  if (apiUrl) {
    const base = trimEnd(apiUrl);
    return base.endsWith("/api") ? base.slice(0, -4) : base;
  }
  if (process.env.NODE_ENV !== "production") {
    return "http://localhost:8001";
  }
  throw new Error(
    "Set NEXT_PUBLIC_API_URL or BACKEND_URL for Next.js API rewrites (required in production).",
  );
}

const nextConfig: NextConfig = {
  async rewrites() {
    const backend = backendOriginForRewrites();
    return [
      // Django defines `login/`; POST without trailing slash breaks APPEND_SLASH. Normalize at the proxy.
      {
        source: "/api/auth/login",
        destination: `${backend}/api/auth/login/`,
      },
      {
        source: "/api/:path*",
        destination: `${backend}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
