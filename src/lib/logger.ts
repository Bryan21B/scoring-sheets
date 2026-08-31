import "server-only";
import { createLogger, format, transports } from "winston";
import { env } from "@/lib/env";

/**
 * Application logger — the only sanctioned alternative to `console.*`, which
 * Biome rejects in application code.
 *
 * Server-only: winston is a Node library and pulling it into a client component
 * would break the browser bundle. The `server-only` import turns that mistake
 * into a build error instead of a runtime one.
 *
 * Console transport only, by design. Log files are the container runtime's
 * problem (`podman` / journald rotation, see `docs/deployment.md`); an app that
 * writes its own files fills the disk of whatever host it lands on. `LOG_LEVEL`
 * caps the volume at the source.
 */
export const logger = createLogger({
  level: env.LOG_LEVEL === "silent" ? "error" : env.LOG_LEVEL,
  silent: env.LOG_LEVEL === "silent",
  format: format.combine(format.timestamp(), format.errors({ stack: true }), format.json()),
  transports: [
    new transports.Console({
      // Sans ça, winston envoie warn/error sur stderr et le reste sur stdout,
      // ce qui désordonne les lignes dans un collecteur qui lit les deux flux.
      stderrLevels: [],
    }),
  ],
});
