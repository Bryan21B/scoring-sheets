import { z } from "zod";
import { formatZodIssues } from "@/lib/zod";

/**
 * Runtime environment contract.
 *
 * Server-only: importing this from a client component leaks the schema (and any
 * value read from it) into the browser bundle. Keep it behind server code.
 *
 * Every variable added here must also land in `.env.example` — the pre-commit
 * hook fails the commit when the two drift apart.
 */
const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  /** SQLite file path, or a `libsql://` URL for a remote Turso database. Must
   * stay overridable: Vercel's filesystem is ephemeral, so production points this
   * at Turso while the dev loop keeps a local file. */
  DATABASE_PATH: z.string().min(1).default("./data/app.db"),
  /** L'URL que pose l'**intégration Turso de Vercel**, sous son nom à elle.
   * Optionnelle parce qu'elle n'existe qu'en production : le dev garde
   * `DATABASE_PATH`. Une valeur vide compte comme absente, comme pour
   * `TURSO_AUTH_TOKEN` — sans quoi `.env.example`, qui la livre vide, ne serait
   * plus copiable tel quel vers `.env.local`. C'est {@link urlDeLaBase} qui
   * retombe alors sur le fichier local. */
  TURSO_DATABASE_URL: z.string().optional(),
  /** Auth token for a remote Turso database, unset for the local file that backs
   * the dev loop — hence optional. An empty value counts as absent (see
   * `src/db/index.ts`), so a `.env.local` copied straight from `.env.example`
   * still boots instead of failing a `min(1)`. */
  TURSO_AUTH_TOKEN: z.string().optional(),
  LOG_LEVEL: z.enum(["debug", "info", "warn", "error", "silent"]).default("info"),
  PORT: z.coerce.number().int().positive().default(3000),
});

export type Env = z.infer<typeof envSchema>;

/**
 * Validates an environment and fails fast with a readable report.
 *
 * Takes its source as a parameter so tests can exercise it directly, rather than
 * reaching for a module-registry reset to re-trigger the module-level parse
 * below — `bun test` has no `resetModules`, and the indirection was never worth
 * it anyway.
 *
 * Fail-fast beats lazy access: a missing variable surfaces at boot instead of on
 * the first request that happens to need it.
 */
export function parseEnv(source: Record<string, string | undefined> = process.env): Env {
  const parsed = envSchema.safeParse(source);

  if (!parsed.success) {
    throw new Error(
      `Invalid environment variables:\n${formatZodIssues(parsed.error)}\n\nSee .env.example.`,
    );
  }

  return parsed.data;
}

/**
 * Où vit la base, quel que soit le nom sous lequel on la lui a donnée.
 *
 * L'intégration Turso de Vercel pose `TURSO_DATABASE_URL` ; le dépôt lisait
 * `DATABASE_PATH` depuis toujours. Les deux coexistent donc, et l'intégration
 * passe devant : recopier son URL dans `DATABASE_PATH` marcherait aujourd'hui et
 * pointerait dans le vide le jour où elle reprovisionne la base, sans que rien
 * ne le signale.
 *
 * Rend une chaîne brute, pas une URL libSQL : `toLibsqlUrl` s'en charge, et
 * `src/db/index.ts` a besoin du chemin nu pour créer le dossier d'un fichier
 * local.
 */
export function urlDeLaBase(source: Env): string {
  // `|| ` et non `?? ` : la chaîne vide doit retomber sur le fichier local, et
  // non être préférée à lui. C'est le cas d'un `.env.local` copié depuis
  // `.env.example`, qui livre la clé sans valeur.
  return source.TURSO_DATABASE_URL || source.DATABASE_PATH;
}

export const env: Env = parseEnv();
