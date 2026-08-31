import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import type { Client } from "@libsql/client";
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import * as schema from "@/db/schema";
import { toLibsqlUrl } from "@/db/url";
import { env } from "@/lib/env";

/**
 * Opens the SQLite file, creating its parent directory if the volume is empty.
 *
 * libSQL rather than `better-sqlite3` or `bun:sqlite`: it is the only driver
 * that runs unmodified on both Node and Bun, which keeps `bun test` and the
 * Node-based production server on the same code. It is also the upgrade path off
 * a local file — pointing `DATABASE_PATH` at a `libsql://` URL moves the same
 * queries to Turso without touching this module.
 *
 * WAL is the right default for a web server: readers never block on the writer.
 * `foreign_keys` is off by default in SQLite and must be re-enabled per
 * connection, otherwise Drizzle's relations are silently unenforced.
 */
function createConnection(): Client {
  const url = toLibsqlUrl(env.DATABASE_PATH);

  if (url.startsWith("file:")) {
    mkdirSync(dirname(env.DATABASE_PATH), { recursive: true });
  }

  const client = createClient({ url });
  void client.execute("PRAGMA journal_mode = WAL");
  void client.execute("PRAGMA foreign_keys = ON");

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
