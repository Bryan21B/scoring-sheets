#!/usr/bin/env node
import { mkdirSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { migrate } from "drizzle-orm/libsql/migrator";

/**
 * Applies pending migrations from `drizzle/`, then the triggers, then exits.
 *
 * Plain `.mjs` with no path aliases and no dev dependencies, so the exact same
 * file runs under Node (in the runtime container, which has no TypeScript
 * toolchain) and under Bun (locally, via `bun run db:migrate`).
 *
 * Run it as a deploy step *before* starting the server, never at app boot, so a
 * failed migration stops the rollout instead of leaving a half-migrated process
 * serving traffic.
 *
 * The triggers are a second step because Drizzle Kit cannot generate them: they
 * hold the append-only journal and the version stamp, neither of which any table
 * declaration can express. `src/db/triggers.sql` drops each trigger before
 * creating it, so this stays idempotent and the file remains the single
 * description of what the database should hold.
 */
const databasePath = process.env.DATABASE_PATH ?? "./data/app.db";
const url = /^(file|libsql|https?|ws|wss):/.test(databasePath)
  ? databasePath
  : `file:${databasePath}`;

if (url.startsWith("file:")) {
  mkdirSync(dirname(databasePath), { recursive: true });
}

const client = createClient({ url });

try {
  await migrate(drizzle(client), {
    migrationsFolder: resolve(import.meta.dirname, "..", "drizzle"),
  });
  await client.executeMultiple(
    readFileSync(resolve(import.meta.dirname, "..", "src", "db", "triggers.sql"), "utf8"),
  );
  process.stdout.write(
    `${JSON.stringify({ level: "info", message: "migrations and triggers applied", databasePath })}\n`,
  );
} catch (error) {
  process.stderr.write(
    `${JSON.stringify({
      level: "error",
      message: "migration failed",
      error: error instanceof Error ? error.message : String(error),
    })}\n`,
  );
  process.exitCode = 1;
} finally {
  client.close();
}
