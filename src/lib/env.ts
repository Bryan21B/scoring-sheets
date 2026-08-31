import { z } from "zod";

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
  /** Filesystem path to the SQLite database file. Must be overridable so a
   * container can be handed an external volume path instead of a baked-in one. */
  DATABASE_PATH: z.string().min(1).default("./data/app.db"),
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
    const issues = parsed.error.issues
      .map((issue) => `  - ${issue.path.join(".") || "(root)"}: ${issue.message}`)
      .join("\n");
    throw new Error(`Invalid environment variables:\n${issues}\n\nSee .env.example.`);
  }

  return parsed.data;
}

export const env: Env = parseEnv();
