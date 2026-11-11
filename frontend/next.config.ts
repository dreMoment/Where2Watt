import type { NextConfig } from "next";

// The browser always calls the API on this app's own origin (/api/...), and
// Next.js (or Vercel) forwards those requests to the backend. Keeping the API
// same-origin means the backend needs no CORS configuration.
// Outside production (next dev, jest) it defaults to the local backend.
const apiProxyTarget = (
  process.env.API_PROXY_TARGET ??
  (process.env.NODE_ENV === "production" ? "" : "http://localhost:8080")
)
  .trim()
  .replace(/\/+$/, "");

if (!apiProxyTarget) {
  throw new Error("API_PROXY_TARGET must be set to the backend URL, e.g. https://api.example.com");
}

const nextConfig: NextConfig = {
  // Keep tracing scoped to this app when a parent directory also has a lockfile.
  outputFileTracingRoot: process.cwd(),
  async rewrites() {
    return [{ source: "/api/:path*", destination: `${apiProxyTarget}/api/:path*` }];
  },
};

export default nextConfig;
