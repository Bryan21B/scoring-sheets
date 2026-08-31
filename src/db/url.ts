/** Schemes libSQL accepts as-is; anything else is treated as a filesystem path. */
const URL_SCHEME = /^(file|libsql|https?|ws|wss):/;

/**
 * Normalises `DATABASE_PATH` into something libSQL accepts.
 *
 * libSQL wants a URL, but a bare filesystem path is the common case in
 * `.env.example` and in container env vars, so accept it and add the scheme —
 * while leaving a real remote URL (Turso) untouched.
 *
 * Lives in its own side-effect-free module so tests can import it without
 * `src/db/index.ts` opening a connection as a side effect of the import.
 */
export function toLibsqlUrl(path: string): string {
  return URL_SCHEME.test(path) ? path : `file:${path}`;
}
