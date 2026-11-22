import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV === "development";

// No nonces: they would force every page to render per request and lose the prerendered shells (PPR).
// 'unsafe-inline' scripts are still needed for Next's inline RSC payload and the theme script; everything else is
// locked to this origin, so an injected <script src> or fetch to another host is blocked.
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' blob: data:",
  "font-src 'self'",
  "connect-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  cacheComponents: true,
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
  partialPrefetching: true,
  // the "Ask the code" assistant reads this snapshot at runtime (scripts/build-code-index.ts); make sure it ships
  outputFileTracingIncludes: {
    "/api/v1/explain": ["./src/generated/code-index.json"],
    "/api/v1/explain/source": ["./src/generated/code-index.json"],
    "/api/v1/code/**": ["./src/generated/code-index.json"],
    "/code": ["./src/generated/code-index.json"],
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
