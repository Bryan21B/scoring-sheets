/**
 * Drizzle schema — intentionally empty for now.
 *
 * The domain (parties, joueurs, manches, points) is not modelled yet: it gets a
 * design doc under `docs/specs/` before it gets tables, per the working loop in
 * CLAUDE.md. Until then this module exports no table, `drizzle/` holds no
 * migration, and `bun run db:migrate` is an honest no-op rather than a failure.
 *
 * Adding the first table: declare it here, run `bun run db:generate`, commit the
 * generated SQL under `drizzle/` — never hand-edited — then extend
 * `tests/unit/db.test.ts` so the migration set is asserted, not assumed.
 */
export {};
