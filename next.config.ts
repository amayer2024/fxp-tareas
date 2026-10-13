import path from "node:path";

import type { NextConfig } from "next";

const projectRoot = path.join(import.meta.dirname, ".");

const nextConfig: NextConfig = {
  output: "standalone",
  // There is a stray package-lock.json in the home directory. Without this,
  // Next infers that as the workspace root, loads a second copy of React, and
  // client components crash with "Cannot read properties of undefined (reading
  // 'apply')".
  outputFileTracingRoot: projectRoot,
  turbopack: {
    root: projectRoot,
  },
  allowedDevOrigins: ["127.0.0.1", "localhost"],
  experimental: {
    serverActions: {
      bodySizeLimit: "26mb",
    },
  },
};

export default nextConfig;
