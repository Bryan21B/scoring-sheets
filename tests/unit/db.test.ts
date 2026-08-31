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
 * Covers the migration set in `drizzle/` and our URL coercion — our artefacts,
 * not Drizzle's.
 *
 * The failure mode worth catching: a schema edit that never got a matching
 * `bun run db:generate`. It stays invisible on a developer machine whose
 * database is already migrated, and surfaces in production on a fresh volume.
 */
let dir: string;
let client: Client;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "starter-db-"));
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

  it("produce every table declared in the schema", async () => {
    await migrate(drizzle(client), { migrationsFolder: "./drizzle" });

    const result = await client.execute("select name from sqlite_master where type = 'table'");
    const tables = result.rows.map((row) => row.name);

    expect(tables).toContain("notes");
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
