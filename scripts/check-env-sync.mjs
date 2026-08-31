#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

/**
 * Fails the commit when `src/lib/env.ts` and `.env.example` drift apart.
 *
 * The agent is told to read `.env.example` before inventing a variable name, so
 * a stale example file quietly sends it down the wrong path. Prose in AGENTS.md
 * can be ignored; a failing hook cannot.
 *
 * The schema is read as text rather than imported: importing it would run the
 * parser against the developer's own environment and throw for the wrong reason.
 */
const root = resolve(import.meta.dirname, "..");
const schemaSource = readFileSync(resolve(root, "src/lib/env.ts"), "utf8");
const exampleSource = readFileSync(resolve(root, ".env.example"), "utf8");

/** Keys inside the `z.object({ ... })` block, i.e. lines like `  FOO: z.…`. */
const schemaKeys = new Set(
  [...schemaSource.matchAll(/^\s{2}([A-Z][A-Z0-9_]*):\s*z\./gm)].map((match) => match[1]),
);

/** Keys assigned in the example file, commented-out lines excluded. */
const exampleKeys = new Set(
  [...exampleSource.matchAll(/^([A-Z][A-Z0-9_]*)=/gm)].map((match) => match[1]),
);

const missingFromExample = [...schemaKeys].filter((key) => !exampleKeys.has(key));
const missingFromSchema = [...exampleKeys].filter((key) => !schemaKeys.has(key));

if (missingFromExample.length === 0 && missingFromSchema.length === 0) {
  process.exit(0);
}

const report = [
  ".env.example et src/lib/env.ts ont divergé :",
  ...missingFromExample.map((key) => `  - ${key} : dans le schéma, absent de .env.example`),
  ...missingFromSchema.map((key) => `  - ${key} : dans .env.example, absent du schéma`),
  "",
  "Mets les deux à jour avant de commiter.",
].join("\n");

process.stderr.write(`${report}\n`);
process.exit(1);
