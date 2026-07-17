import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // A stray lockfile in a parent directory (e.g. the user's home dir) can make
  // Turbopack infer the wrong workspace root and break route resolution.
  // Pin it explicitly to this project.
  turbopack: {
    root: path.join(__dirname),
  },
  // geo-tz locates its data file relative to its own module path at runtime;
  // bundling it breaks that lookup, so keep it as a plain Node `require`.
  serverExternalPackages: ["geo-tz"],
};

export default nextConfig;
