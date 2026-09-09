import { desc, sql } from "drizzle-orm";
import { check, index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

/**
 * The domain schema, written from `docs/specs/2026-09-09-schema.md`.
 *
 * Editing a table here is only half the change: `bun run db:generate` turns it
 * into SQL under `drizzle/`, which is never hand-edited. A schema edit without
 * its generation is invisible on an already-migrated machine and fatal against a
 * fresh database — `tests/unit/db.test.ts` exists to catch exactly that.
 *
 * Triggers are not expressible here — Drizzle Kit has no trigger primitive — so
 * the append-only journal and the version stamp live in `src/db/triggers.sql`,
 * applied by `scripts/migrate.mjs` right after the generated migrations. See
 * `docs/adr/0007-declencheurs-hors-du-jeu-de-migrations.md`.
 */

/**
 * The global roster. A joueur outlives any single partie.
 *
 * `nom` is deliberately **not** unique: two people called Marie are two rows,
 * and the ambiguity is resolved in the interface at creation time, never by an
 * automatic suffix.
 */
export const joueur = sqliteTable("joueur", {
  // AUTOINCREMENT, not a bare rowid alias: the spec calls this id monotone, and
  // a plain INTEGER PRIMARY KEY hands the highest id back out after a delete.
  id: integer("id").primaryKey({ autoIncrement: true }),
  nom: text("nom").notNull(),
  creeLe: integer("cree_le", { mode: "timestamp_ms" }).notNull(),
});

/**
 * A person's browser, recognised by a server cookie.
 *
 * The link to a joueur is global — never per partie — and it is a declaration,
 * not a proof. Several appareils may point at the same joueur, and repointing
 * one never re-reads the past: the journal freezes the acting joueur at write
 * time precisely so that it cannot.
 */
export const appareil = sqliteTable(
  "appareil",
  {
    /** The opaque cookie value itself, hence TEXT rather than an integer. */
    id: text("id").primaryKey(),
    joueurId: integer("joueur_id")
      .notNull()
      .references(() => joueur.id),
    vuLe: integer("vu_le", { mode: "timestamp_ms" }).notNull(),
    creeLe: integer("cree_le", { mode: "timestamp_ms" }).notNull(),
  },
  (t) => [index("appareil_joueur_id_idx").on(t.joueurId)],
);

/**
 * A scoring session: opened, filled in, then closed.
 *
 * There is no `jeux` table — the catalogue is a TypeScript constant, editable
 * without a migration — so `jeu_id` carries no foreign key and is validated by
 * Zod at the boundary. `regles` is the JSON snapshot of the **resolved** rules,
 * which is why an overridden threshold needs no column of its own.
 *
 * The end of a partie is absent or present, never a third status value; the
 * three `fin_*` columns move together, and a reprise clears all three.
 */
export const partie = sqliteTable(
  "partie",
  {
    // Monotone by contract: this id is what breaks ties in replay order.
    id: integer("id").primaryKey({ autoIncrement: true }),
    code: text("code").notNull(),
    jeuId: text("jeu_id").notNull(),
    regles: text("regles").notNull(),
    /** Poll stamp. Bumped by trigger, never by hand — see `src/db/triggers.sql`. */
    version: integer("version").notNull().default(0),
    finLe: integer("fin_le", { mode: "timestamp_ms" }),
    finCause: text("fin_cause", { enum: ["terminee", "abandonnee"] }),
    finPar: integer("fin_par").references(() => joueur.id),
    creeLe: integer("cree_le", { mode: "timestamp_ms" }).notNull(),
  },
  (t) => [
    uniqueIndex("partie_code_unique").on(t.code),
    // No three-valued status: either all three end columns are set or none is.
    // Written as two equalities on `IS NULL` so a reprise, which clears the
    // three at once, cannot leave a half-ended partie behind.
    check(
      "partie_fin_coherente",
      sql`(${t.finLe} is null) = (${t.finCause} is null) and (${t.finLe} is null) = (${t.finPar} is null)`,
    ),
    // The column enum is TypeScript-only; this is what the database enforces.
    check(
      "partie_fin_cause_connue",
      sql`${t.finCause} is null or ${t.finCause} in ('terminee', 'abandonnee')`,
    ),
    // Partial on purpose: the history and the palmarès read finished parties
    // only, so the parties still in progress have no business in this index.
    // This is what stamping the end buys — without it the index could not exist.
    index("partie_fin_le_idx").on(desc(t.finLe)).where(sql`${t.finLe} is not null`),
    index("partie_jeu_id_idx").on(t.jeuId),
  ],
);

/**
 * A joueur enrolled in one partie.
 *
 * A participant may have no appareil at all: the creator is allowed to add
 * players on their behalf. A **retired** participant keeps the values already
 * entered, drops out of the completeness of later manches, and out of the final
 * ranking — otherwise leaving early would win a game where the lowest score does.
 */
export const participant = sqliteTable(
  "participant",
  {
    // Insertion order *is* table order, so the id must never be handed back out.
    id: integer("id").primaryKey({ autoIncrement: true }),
    partieId: integer("partie_id")
      .notNull()
      .references(() => partie.id),
    joueurId: integer("joueur_id")
      .notNull()
      .references(() => joueur.id),
    retireLe: integer("retire_le", { mode: "timestamp_ms" }),
  },
  (t) => [
    uniqueIndex("participant_partie_id_joueur_id_unique").on(t.partieId, t.joueurId),
    // The other direction: a joueur's own page and its compteurs.
    index("participant_joueur_id_idx").on(t.joueurId),
  ],
);

/**
 * A round at the end of which points are awarded.
 *
 * Closing is **declared**, not deduced from completeness, which is why it has a
 * date and an author rather than being derived. Deleting a manche leaves a hole:
 * the next numero is the highest one plus one, never a reused value.
 */
export const manche = sqliteTable(
  "manche",
  {
    // No AUTOINCREMENT here, unlike joueur/partie/participant: nothing orders by
    // this id, and nothing points at it — a deleted manche is found again by its
    // numero, and the journal keeps that numero rather than this id precisely so
    // that reusing it can never matter.
    id: integer("id").primaryKey(),
    partieId: integer("partie_id")
      .notNull()
      .references(() => partie.id),
    numero: integer("numero").notNull(),
    closeLe: integer("close_le", { mode: "timestamp_ms" }),
    closePar: integer("close_par").references(() => joueur.id),
  },
  // The constraint that makes two phones opening "the next manche" at the same
  // moment land on the *same* one instead of creating two.
  (t) => [uniqueIndex("manche_partie_id_numero_unique").on(t.partieId, t.numero)],
);

/**
 * One *case* of the glossary: what a joueur scored in a manche.
 *
 * Named after the gesture that creates it because `case` is reserved in SQL.
 *
 * The grain is one row per case, not one JSON object per manche, because the
 * conflict policy requires two players writing different cases never to collide
 * — which the same row would make impossible.
 *
 * A row exists as soon as the case is **touched**, so `valeur IS NULL` means
 * *touched but empty* — the state Uno passes through between naming who went out
 * and typing their total. What `valeur` means is given by the saisie mode held
 * in the rules snapshot: the entered integer, the single total credited to the
 * winner, or the podium rank.
 */
export const saisie = sqliteTable(
  "saisie",
  {
    id: integer("id").primaryKey(),
    mancheId: integer("manche_id")
      .notNull()
      .references(() => manche.id, { onDelete: "cascade" }),
    /** The joueur the case is **about**, never the one who typed it. */
    joueurId: integer("joueur_id")
      .notNull()
      .references(() => joueur.id),
    valeur: integer("valeur"),
  },
  (t) => [
    uniqueIndex("saisie_manche_id_joueur_id_unique").on(t.mancheId, t.joueurId),
    // The floor the three saisie modes share. `IS NULL` is spelled out rather
    // than left to SQLite's three-valued logic, so the intent survives a reader:
    // an empty case is legal, a negative one never is.
    check("saisie_valeur_positive", sql`${t.valeur} is null or ${t.valeur} >= 0`),
  ],
);

/**
 * The written record of a partie: append-only, never modified, never purged.
 *
 * Never read by the scoring engine, which knows only manches. It is a trace, not
 * a source of truth.
 *
 * It carries **no foreign key to a manche**. A manche gets deleted and a journal
 * line is never modified, so a cascade would violate the append-only rule and an
 * `ON DELETE SET NULL` would too. It keeps the manche's **numero** instead — a
 * bare integer, which has the merit of being what a human reads.
 *
 * Append-only is held by two triggers rather than by discipline; discipline does
 * not hold in a repository where agents write. See `src/db/triggers.sql`.
 */
export const journal = sqliteTable(
  "journal",
  {
    id: integer("id").primaryKey(),
    // Safe as a foreign key: a partie is only ever deleted while its journal is empty.
    partieId: integer("partie_id")
      .notNull()
      .references(() => partie.id),
    // TypeScript-only, deliberately: unlike `partie.fin_cause`, whose allowed
    // values the spec pins with a `CHECK`, it asks only that a geste be one of
    // the seven and names no constraint. A `CHECK` here would need a migration
    // every time the domain gains a geste.
    geste: text("geste", {
      enum: [
        "saisie",
        "correction",
        "suppressionDeManche",
        "participantAjoute",
        "participantRetire",
        "abandon",
        "reprise",
      ],
    }).notNull(),
    /** Frozen at write time: repointing an appareil never re-reads the past. */
    joueurAgissantId: integer("joueur_agissant_id")
      .notNull()
      .references(() => joueur.id),
    appareilId: text("appareil_id").references(() => appareil.id),
    /** A bare integer, deliberately without a foreign key. */
    mancheNumero: integer("manche_numero"),
    joueurConcerneId: integer("joueur_concerne_id").references(() => joueur.id),
    /** JSON: the variable part — old and new values, or what a deletion carried off. */
    detail: text("detail"),
    /** Server clock, never the device's. */
    ecritLe: integer("ecrit_le", { mode: "timestamp_ms" }).notNull(),
  },
  // The corrections drawer: one partie's lines, newest first.
  (t) => [index("journal_partie_id_ecrit_le_idx").on(t.partieId, desc(t.ecritLe))],
);
