import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
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
