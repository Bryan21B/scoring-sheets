import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /** Pins the workspace root to this repo. Without it Turbopack walks up the
   * filesystem, finds a stray lockfile in a parent directory, and infers the
   * wrong root. */
  turbopack: {
    root: dirname(fileURLToPath(import.meta.url)),
  },
  /** `@libsql/client` loads a platform-specific native binding at runtime: it
   * must stay a real `require` instead of being traced into the server bundle. */
  serverExternalPackages: ["@libsql/client"],
};

export default nextConfig;
