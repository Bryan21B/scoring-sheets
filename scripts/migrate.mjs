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
// Même arbitrage que `urlDeLaBase` dans src/lib/env.ts : l'intégration Turso
// de Vercel pose `TURSO_DATABASE_URL`, le dev garde `DATABASE_PATH`. Migrer
// la mauvaise des deux laisserait la prod sans tables et sans déclencheurs.
// `||` et non `??`, comme `urlDeLaBase` : une valeur vide compte pour absente.
const databasePath = process.env.TURSO_DATABASE_URL || process.env.DATABASE_PATH || "./data/app.db";
const url = /^(file|libsql|https?|ws|wss):/.test(databasePath)
  ? databasePath
  : `file:${databasePath}`;

if (url.startsWith("file:")) {
  mkdirSync(dirname(databasePath), { recursive: true });
}

// Le jeton n'existe que pour une base distante ; en local il n'y a rien à
// présenter. Spread plutôt qu'`authToken: …` : une chaîne vide serait envoyée
// comme une vraie crédence, exactement comme dans `src/db/index.ts`.
const authToken = process.env.TURSO_AUTH_TOKEN || undefined;

// Une base distante sans jeton échoue à la première écriture, sur une erreur de
// requête qui ne dit pas un mot du jeton manquant — on a mis un moment à la
// lire. Autant refuser tout de suite, en nommant la cause.
if (!url.startsWith("file:") && authToken === undefined) {
  process.stderr.write(
    `${JSON.stringify({
      level: "error",
      message: "migration refusée : base distante sans TURSO_AUTH_TOKEN",
      url,
    })}\n`,
  );
  process.exit(1);
}

const client = createClient({ url, ...(authToken ? { authToken } : {}) });

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
