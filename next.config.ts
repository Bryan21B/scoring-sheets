import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import type { NextConfig } from "next";
import {
  CHEMIN_DES_PARTIES,
  EN_TETE_REFERENT,
  POLITIQUE_DE_REFERENT,
} from "./src/lib/partie/referent";

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
  /** Le code d'une partie vit dans l'URL : sans politique de référent, il part
   * dans l'en-tête `Referer` au premier lien sortant. Voir
   * `src/lib/partie/referent.ts`. */
  headers: () =>
    Promise.resolve([
      {
        source: CHEMIN_DES_PARTIES,
        headers: [{ key: EN_TETE_REFERENT, value: POLITIQUE_DE_REFERENT }],
      },
    ]),
};

export default nextConfig;
