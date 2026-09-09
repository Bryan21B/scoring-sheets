import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Client, InValue } from "@libsql/client";
import { createClient } from "@libsql/client";
import { toLibsqlUrl } from "@/db/url";

/**
 * Covers our own artefacts — the migration set in `drizzle/`, the triggers in
 * `src/db/triggers.sql` and the URL coercion — never Drizzle's or SQLite's own
 * behaviour.
 *
 * The failure mode to catch: a schema edit that never got its matching
 * `bun run db:generate`. Invisible on a machine whose database is already
 * migrated, fatal in production against a fresh one. So every test here runs
 * `scripts/migrate.mjs` — the very script `playwright.config.ts` and
 * `bun run db:migrate` run — against a brand-new file, then asserts on what that
 * left behind. Calling Drizzle's `migrate()` directly would prove the SQL
 * applies while saying nothing about the triggers the script also carries.
 */
const MIGRATE_SCRIPT = "scripts/migrate.mjs";

/** The writes the tests arrange with, shared so no two call sites can drift. */
const INSERT_PARTIE = "INSERT INTO partie (code, jeu_id, regles, cree_le) VALUES (?, ?, ?, ?)";
const INSERT_PARTIE_FINIE = `INSERT INTO partie (code, jeu_id, regles, cree_le, fin_le, fin_cause, fin_par)
   VALUES (?, ?, ?, ?, ?, ?, ?)`;
const INSERT_MANCHE = "INSERT INTO manche (partie_id, numero) VALUES (?, ?)";
const INSERT_SAISIE = "INSERT INTO saisie (manche_id, joueur_id, valeur) VALUES (?, ?, ?)";
const INSERT_PARTICIPANT = "INSERT INTO participant (partie_id, joueur_id) VALUES (?, ?)";
const INSERT_LIGNE_DE_JOURNAL = `INSERT INTO journal (partie_id, geste, joueur_agissant_id, manche_numero, ecrit_le)
   VALUES (?, ?, ?, ?, ?)`;

/** Fixed server clock, so a row's timestamp is never what makes a test flap. */
const NOW = Date.UTC(2026, 8, 9);

/**
 * Runs the real deploy-time migration step against `databasePath`.
 *
 * Array arguments rather than a template literal, per AGENTS.md: a path
 * interpolated into a shell string is a command injection waiting to happen.
 */
function runMigrate(databasePath: string): void {
  const result = Bun.spawnSync([process.execPath, MIGRATE_SCRIPT], {
    env: { ...process.env, DATABASE_PATH: databasePath },
    stdout: "pipe",
    stderr: "pipe",
  });

  if (result.exitCode !== 0) {
    throw new Error(`${MIGRATE_SCRIPT} exited ${result.exitCode}: ${result.stderr.toString()}`);
  }
}

/**
 * Names of the schema objects of one kind, excluding SQLite's own bookkeeping
 * and Drizzle's migration ledger — neither is ours to assert on.
 */
async function schemaObjects(client: Client, type: "table" | "index"): Promise<string[]> {
  const result = await client.execute({
    sql: `SELECT name FROM sqlite_master
          WHERE type = ? AND name NOT LIKE 'sqlite_%' AND name <> '__drizzle_migrations'
          ORDER BY name`,
    args: [type],
  });

  return result.rows.map((row) => String(row.name));
}

let dir: string;
let databasePath: string;
let client: Client;

/** Runs one write and hands back the id it created. */
async function insert(sql: string, args: InValue[]): Promise<number> {
  const result = await client.execute({ sql, args });
  return Number(result.lastInsertRowid);
}

/** A partie in progress, which is the only kind anything is written to. */
async function creerPartie(code: string, jeuId = "uno"): Promise<number> {
  return insert(INSERT_PARTIE, [code, jeuId, "{}", NOW]);
}

/**
 * The smallest graph any write below needs: one joueur, one partie, one manche.
 *
 * Built with raw SQL rather than through Drizzle on purpose — what is under test
 * is the migrated database, and a query builder would only stand between the
 * test and the constraint it is trying to provoke.
 */
async function seed(): Promise<{ joueurId: number; partieId: number; mancheId: number }> {
  const joueurId = await insert("INSERT INTO joueur (nom, cree_le) VALUES (?, ?)", ["Marie", NOW]);
  const partieId = await creerPartie("A1B2C3", "6-qui-prend");
  const mancheId = await insert(INSERT_MANCHE, [partieId, 1]);

  return { joueurId, partieId, mancheId };
}

/** The poll stamp the other phones compare against. */
async function estampille(partieId: number): Promise<number> {
  const result = await client.execute({
    sql: "SELECT version FROM partie WHERE id = ?",
    args: [partieId],
  });

  return Number(result.rows[0]?.version);
}

beforeEach(async () => {
  dir = mkdtempSync(join(tmpdir(), "scoring-sheets-db-"));
  databasePath = join(dir, "test.db");
  runMigrate(databasePath);
  client = createClient({ url: toLibsqlUrl(databasePath) });
  // Off by default in SQLite and re-enabled per connection by `src/db/index.ts`;
  // the tests read the schema as production sees it, cascades included.
  await client.execute("PRAGMA foreign_keys = ON");
});

afterEach(() => {
  client.close();
  rmSync(dir, { recursive: true, force: true });
});

describe("migrations", () => {
  it("apply cleanly to an empty database", () => {
    expect(() => runMigrate(join(dir, "vierge.db"))).not.toThrow();
  });

  it("are idempotent, so redeploying against a migrated database is a no-op", () => {
    expect(() => runMigrate(databasePath)).not.toThrow();
  });

  it("create the seven domain tables", async () => {
    expect(await schemaObjects(client, "table")).toEqual([
      "appareil",
      "joueur",
      "journal",
      "manche",
      "participant",
      "partie",
      "saisie",
    ]);
  });
});

describe("uniqueness the schema holds on its own", () => {
  it("refuses a second manche with the same numero in one partie", async () => {
    const { partieId } = await seed();

    await expect(client.execute({ sql: INSERT_MANCHE, args: [partieId, 1] })).rejects.toThrow();
  });

  it("lets the same numero live in two different parties", async () => {
    await seed();
    const autrePartieId = await creerPartie("D4E5F6");

    await expect(
      client.execute({ sql: INSERT_MANCHE, args: [autrePartieId, 1] }),
    ).resolves.toBeDefined();
  });

  it("refuses a second saisie for the same joueur in one manche", async () => {
    const { joueurId, mancheId } = await seed();
    await insert(INSERT_SAISIE, [mancheId, joueurId, 12]);

    await expect(
      client.execute({ sql: INSERT_SAISIE, args: [mancheId, joueurId, 30] }),
    ).rejects.toThrow();
  });

  it("refuses the same joueur twice in one partie", async () => {
    const { joueurId, partieId } = await seed();
    await insert(INSERT_PARTICIPANT, [partieId, joueurId]);

    await expect(
      client.execute({ sql: INSERT_PARTICIPANT, args: [partieId, joueurId] }),
    ).rejects.toThrow();
  });

  it("refuses a duplicate partie code", async () => {
    await seed();

    await expect(
      client.execute({ sql: INSERT_PARTIE, args: ["A1B2C3", "uno", "{}", NOW] }),
    ).rejects.toThrow();
  });
});

describe("the floor of zero on a saisie", () => {
  it("refuses a negative valeur", async () => {
    const { joueurId, mancheId } = await seed();

    await expect(
      client.execute({ sql: INSERT_SAISIE, args: [mancheId, joueurId, -1] }),
    ).rejects.toThrow();
  });

  it("accepts an empty valeur, which is a case touched but not filled in", async () => {
    const { joueurId, mancheId } = await seed();

    await expect(
      client.execute({ sql: INSERT_SAISIE, args: [mancheId, joueurId, null] }),
    ).resolves.toBeDefined();
  });
});

describe("the end of a partie, absent or present as a whole", () => {
  it("accepts the three end columns filled in together", async () => {
    const { joueurId } = await seed();

    await expect(
      client.execute({
        sql: INSERT_PARTIE_FINIE,
        args: ["G7H8J9", "uno", "{}", NOW, NOW, "terminee", joueurId],
      }),
    ).resolves.toBeDefined();
  });

  it("refuses a date of end without its cause and its author", async () => {
    await seed();

    await expect(
      client.execute({
        sql: INSERT_PARTIE_FINIE,
        args: ["G7H8J9", "uno", "{}", NOW, NOW, null, null],
      }),
    ).rejects.toThrow();
  });

  it("refuses a cause of end without its date", async () => {
    const { joueurId } = await seed();

    await expect(
      client.execute({
        sql: INSERT_PARTIE_FINIE,
        args: ["G7H8J9", "uno", "{}", NOW, null, "abandonnee", joueurId],
      }),
    ).rejects.toThrow();
  });

  it("refuses an author of end without the other two", async () => {
    const { joueurId } = await seed();

    await expect(
      client.execute({
        sql: INSERT_PARTIE_FINIE,
        args: ["G7H8J9", "uno", "{}", NOW, null, null, joueurId],
      }),
    ).rejects.toThrow();
  });

  it("refuses a cause of end that is neither terminee nor abandonnee", async () => {
    const { joueurId } = await seed();

    await expect(
      client.execute({
        sql: INSERT_PARTIE_FINIE,
        args: ["G7H8J9", "uno", "{}", NOW, NOW, "en-cours", joueurId],
      }),
    ).rejects.toThrow();
  });
});

describe("indexes", () => {
  it("creates the nine indexes of the spec", async () => {
    expect(await schemaObjects(client, "index")).toEqual([
      "appareil_joueur_id_idx",
      "journal_partie_id_ecrit_le_idx",
      "manche_partie_id_numero_unique",
      "participant_joueur_id_idx",
      "participant_partie_id_joueur_id_unique",
      "partie_code_unique",
      "partie_fin_le_idx",
      "partie_jeu_id_idx",
      "saisie_manche_id_joueur_id_unique",
    ]);
  });

  it("indexes the date of end only for the parties that have one", async () => {
    const result = await client.execute({
      sql: "SELECT sql FROM sqlite_master WHERE type = 'index' AND name = ?",
      args: ["partie_fin_le_idx"],
    });
    const definition = String(result.rows[0]?.sql).toLowerCase();

    // Partial and descending: without both, the history page would scan every
    // partie ever opened just to list the finished ones newest-first.
    expect(definition).toContain("where");
    expect(definition).toContain("desc");
  });
});

describe("the journal is append-only, by trigger", () => {
  it("refuses to update a line", async () => {
    const { joueurId, partieId } = await seed();
    const ligneId = await insert(INSERT_LIGNE_DE_JOURNAL, [partieId, "saisie", joueurId, 1, NOW]);

    await expect(
      client.execute({
        sql: "UPDATE journal SET geste = ? WHERE id = ?",
        args: ["correction", ligneId],
      }),
    ).rejects.toThrow();
  });

  it("refuses to delete a line", async () => {
    const { joueurId, partieId } = await seed();
    const ligneId = await insert(INSERT_LIGNE_DE_JOURNAL, [partieId, "saisie", joueurId, 1, NOW]);

    await expect(
      client.execute({ sql: "DELETE FROM journal WHERE id = ?", args: [ligneId] }),
    ).rejects.toThrow();
  });
});

describe("the version stamp, by trigger", () => {
  it("starts at zero on a partie nobody has written to", async () => {
    const partieId = await creerPartie("K1L2M3");

    expect(await estampille(partieId)).toBe(0);
  });

  it("increments when a saisie lands", async () => {
    const { joueurId, mancheId, partieId } = await seed();
    const avant = await estampille(partieId);

    await insert(INSERT_SAISIE, [mancheId, joueurId, 12]);

    expect(await estampille(partieId)).toBe(avant + 1);
  });

  it("increments again when that saisie is corrected", async () => {
    const { joueurId, mancheId, partieId } = await seed();
    await insert(INSERT_SAISIE, [mancheId, joueurId, 12]);
    const avant = await estampille(partieId);

    await client.execute({
      sql: "UPDATE saisie SET valeur = ? WHERE manche_id = ? AND joueur_id = ?",
      args: [30, mancheId, joueurId],
    });

    expect(await estampille(partieId)).toBe(avant + 1);
  });

  it("increments when a manche opens", async () => {
    const { partieId } = await seed();
    const avant = await estampille(partieId);

    await insert(INSERT_MANCHE, [partieId, 2]);

    expect(await estampille(partieId)).toBe(avant + 1);
  });

  it("increments when a manche is closed", async () => {
    const { joueurId, mancheId, partieId } = await seed();
    const avant = await estampille(partieId);

    await client.execute({
      sql: "UPDATE manche SET close_le = ?, close_par = ? WHERE id = ?",
      args: [NOW, joueurId, mancheId],
    });

    expect(await estampille(partieId)).toBe(avant + 1);
  });

  it("increments when a manche is deleted, carrying its saisies off", async () => {
    const { joueurId, mancheId, partieId } = await seed();
    await insert(INSERT_SAISIE, [mancheId, joueurId, 12]);
    const avant = await estampille(partieId);

    await client.execute({ sql: "DELETE FROM manche WHERE id = ?", args: [mancheId] });

    expect(await estampille(partieId)).toBeGreaterThan(avant);
  });

  it("increments when a participant joins, and again when they are retired", async () => {
    const { joueurId, partieId } = await seed();
    const avant = await estampille(partieId);

    const participantId = await insert(INSERT_PARTICIPANT, [partieId, joueurId]);
    expect(await estampille(partieId)).toBe(avant + 1);

    await client.execute({
      sql: "UPDATE participant SET retire_le = ? WHERE id = ?",
      args: [NOW, participantId],
    });
    expect(await estampille(partieId)).toBe(avant + 2);
  });

  it("increments when a journal line is written", async () => {
    const { joueurId, partieId } = await seed();
    const avant = await estampille(partieId);

    await insert(INSERT_LIGNE_DE_JOURNAL, [partieId, "abandon", joueurId, null, NOW]);

    expect(await estampille(partieId)).toBe(avant + 1);
  });

  it("leaves the other parties' stamps alone", async () => {
    const { joueurId, mancheId } = await seed();
    const autrePartieId = await creerPartie("N4P5Q6");

    await insert(INSERT_SAISIE, [mancheId, joueurId, 12]);

    expect(await estampille(autrePartieId)).toBe(0);
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
