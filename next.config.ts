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
  /** Emits `.next/standalone` — a self-contained server the Containerfile copies
   * without shipping the whole `node_modules` tree. Opt-in, because `next start`
   * refuses to serve a standalone build and local runs would break. The
   * Containerfile sets this; nothing else should. */
  ...(process.env.BUILD_STANDALONE === "1" ? { output: "standalone" as const } : {}),
  /** `@libsql/client` loads a platform-specific native binding at runtime: it
   * must stay a real `require` instead of being traced into the server bundle. */
  serverExternalPackages: ["@libsql/client"],
};

export default nextConfig;
