import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  // Pin the workspace root — this repo has its own lockfile inside a parent that
  // also has one, which otherwise triggers a root-inference warning.
  turbopack: {
    root: path.resolve(__dirname),
  },
};

export default nextConfig;
