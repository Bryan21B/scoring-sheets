import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import type { Client } from "@libsql/client";
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import * as schema from "@/db/schema";
import { toLibsqlUrl } from "@/db/url";
import { env } from "@/lib/env";
import { logger } from "@/lib/logger";

/**
 * Runs a pragma without blocking module evaluation on it.
 *
 * The `catch` is load-bearing, not decoration: an unhandled rejection takes the
 * Node process down, and a remote Turso endpoint is far likelier to refuse a
 * pragma than a local file is. A refused pragma degrades behaviour; it should
 * not kill the server before it has served anything.
 */
function applyPragma(client: Client, pragma: string): void {
  void client.execute(pragma).catch((error: unknown) => {
    logger.warn("pragma rejected", {
      pragma,
      error: error instanceof Error ? error.message : String(error),
    });
  });
}

/**
 * Opens the database, creating the parent directory when it is a local file.
 *
 * libSQL rather than `better-sqlite3` or `bun:sqlite`: it is the only driver
 * that runs unmodified on both Node and Bun, which keeps `bun test` and the
 * Node-based production server on the same code. It is also what makes the
 * Vercel deployment possible at all — pointing `DATABASE_PATH` at a `libsql://`
 * URL moves the same queries to Turso without touching this module.
 */
function createConnection(): Client {
  const url = toLibsqlUrl(env.DATABASE_PATH);
  const isLocalFile = url.startsWith("file:");

  if (isLocalFile) {
    mkdirSync(dirname(env.DATABASE_PATH), { recursive: true });
  }

  const client = createClient({
    url,
    // Spread rather than `authToken: env.TURSO_AUTH_TOKEN`: `exactOptionalPropertyTypes`
    // refuses an explicit `undefined` on an optional property, and an empty
    // string would be worse still — libSQL would send it as a real credential.
    ...(env.TURSO_AUTH_TOKEN ? { authToken: env.TURSO_AUTH_TOKEN } : {}),
  });

  // WAL only means something for an embedded file, where it keeps readers from
  // blocking on the writer. Turso runs its own journal and rejects the pragma.
  if (isLocalFile) {
    applyPragma(client, "PRAGMA journal_mode = WAL");
  }

  // `foreign_keys` is off by default in SQLite and must be re-enabled per
  // connection, otherwise Drizzle's relations are silently unenforced.
  applyPragma(client, "PRAGMA foreign_keys = ON");

  return client;
}

/**
 * Next.js dev mode re-evaluates modules on every hot reload, which would leak a
 * new connection each time. Stashing it on `globalThis` keeps a single one alive
 * across reloads; production evaluates the module once.
 */
const globalForDb = globalThis as unknown as { connection?: Client };

const connection = globalForDb.connection ?? createConnection();

if (env.NODE_ENV !== "production") {
  globalForDb.connection = connection;
}

export const db = drizzle(connection, { schema });

export { schema };
