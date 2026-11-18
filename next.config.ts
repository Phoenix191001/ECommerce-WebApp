import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Pages read live per-instance data, so they render per request.
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
