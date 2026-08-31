import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Client } from "@libsql/client";
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { migrate } from "drizzle-orm/libsql/migrator";
import { toLibsqlUrl } from "@/db/url";

/**
 * Covers our own artefacts — the migration set in `drizzle/` and the URL
 * coercion — never Drizzle's own behaviour.
 *
 * `src/db/schema.ts` declares no table yet, so the migration set is empty. These
 * tests still earn their keep: `drizzle/meta/_journal.json` has to stay
 * loadable, because `playwright.config.ts` runs `scripts/migrate.mjs` before it
 * serves anything. A missing or corrupt journal would surface as a puzzling e2e
 * timeout rather than as the migration failure it actually is.
 *
 * The failure mode to catch once tables exist: a schema edit that never got its
 * matching `bun run db:generate`. Invisible on a machine whose database is
 * already migrated, fatal in production against a fresh one. Assert the tables
 * here when they land.
 */
let dir: string;
let client: Client;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "scoring-sheets-db-"));
  client = createClient({ url: `file:${join(dir, "test.db")}` });
});

afterEach(() => {
  client.close();
  rmSync(dir, { recursive: true, force: true });
});

describe("migrations", () => {
  it("apply cleanly to an empty database", async () => {
    await expect(
      migrate(drizzle(client), { migrationsFolder: "./drizzle" }),
    ).resolves.toBeUndefined();
  });

  it("are idempotent, so redeploying against a migrated database is a no-op", async () => {
    await migrate(drizzle(client), { migrationsFolder: "./drizzle" });

    await expect(
      migrate(drizzle(client), { migrationsFolder: "./drizzle" }),
    ).resolves.toBeUndefined();
  });
});

describe("toLibsqlUrl", () => {
  it("adds the file scheme to a bare path", () => {
    expect(toLibsqlUrl("./data/app.db")).toBe("file:./data/app.db");
    expect(toLibsqlUrl("/data/app.db")).toBe("file:/data/app.db");
  });

  it("leaves an URL that already has a scheme alone", () => {
    expect(toLibsqlUrl("file:/data/app.db")).toBe("file:/data/app.db");
    expect(toLibsqlUrl("libsql://db.turso.io")).toBe("libsql://db.turso.io");
  });
});
