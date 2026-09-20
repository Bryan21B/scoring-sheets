import { describe, expect, it } from "bun:test";
import { parseEnv, urlDeLaBase } from "@/lib/env";

/**
 * Exercises `parseEnv` directly rather than re-importing the module with a
 * doctored `process.env` — the schema is the thing under test, and passing it a
 * source keeps the test free of module-registry tricks.
 */
describe("parseEnv", () => {
  it("applies defaults when optional variables are absent", () => {
    const env = parseEnv({});

    expect(env.NODE_ENV).toBe("development");
    expect(env.DATABASE_PATH).toBe("./data/app.db");
    expect(env.LOG_LEVEL).toBe("info");
    expect(env.PORT).toBe(3000);
    expect(env.TURSO_AUTH_TOKEN).toBeUndefined();
  });

  it("accepts an empty TURSO_AUTH_TOKEN, so .env.example stays copyable as-is", () => {
    // `.env.example` ships the key with no value; a `min(1)` here would make a
    // straight copy to `.env.local` fail to boot. `src/db/index.ts` is what
    // turns the empty string back into "no token".
    expect(() => parseEnv({ TURSO_AUTH_TOKEN: "" })).not.toThrow();
  });

  it("coerces PORT to a number", () => {
    expect(parseEnv({ PORT: "8080" }).PORT).toBe(8080);
  });

  it("keeps values that are already valid", () => {
    const env = parseEnv({
      NODE_ENV: "production",
      LOG_LEVEL: "warn",
      DATABASE_PATH: "/data/x.db",
    });

    expect(env.NODE_ENV).toBe("production");
    expect(env.LOG_LEVEL).toBe("warn");
    expect(env.DATABASE_PATH).toBe("/data/x.db");
  });

  it("rejects an out-of-range LOG_LEVEL instead of falling back", () => {
    expect(() => parseEnv({ LOG_LEVEL: "verbose" })).toThrow(/Invalid environment variables/);
  });

  it("rejects a non-numeric PORT", () => {
    expect(() => parseEnv({ PORT: "not-a-port" })).toThrow(/Invalid environment variables/);
  });

  it("rejects an empty DATABASE_PATH, which would otherwise open a temp database", () => {
    expect(() => parseEnv({ DATABASE_PATH: "" })).toThrow(/Invalid environment variables/);
  });

  it("names the offending variable in the error", () => {
    expect(() => parseEnv({ PORT: "-1" })).toThrow(/PORT/);
  });
});

/**
 * Là où l'intégration Turso de Vercel et le schéma de l'app se rencontrent.
 *
 * L'intégration pose `TURSO_DATABASE_URL`, l'app lisait `DATABASE_PATH`. Les
 * deux noms coexistent donc, et c'est cette fonction qui tranche — plutôt que de
 * recopier l'URL dans une seconde variable, qui pointerait dans le vide le jour
 * où l'intégration reprovisionne la base.
 */
describe("urlDeLaBase", () => {
  it("prend l'URL de l'intégration quand elle est là", () => {
    const env = parseEnv({ TURSO_DATABASE_URL: "libsql://une-base.turso.io" });

    expect(urlDeLaBase(env)).toBe("libsql://une-base.turso.io");
  });

  it("garde le fichier local quand l'intégration n'a rien posé", () => {
    expect(urlDeLaBase(parseEnv({}))).toBe("./data/app.db");
  });

  it("fait passer l'intégration avant un DATABASE_PATH qui traînerait", () => {
    // Le cas qui décide de l'ordre : une variable oubliée dans le projet Vercel
    // ne doit pas renvoyer la production sur un fichier éphémère.
    const env = parseEnv({
      TURSO_DATABASE_URL: "libsql://une-base.turso.io",
      DATABASE_PATH: "./data/app.db",
    });

    expect(urlDeLaBase(env)).toBe("libsql://une-base.turso.io");
  });

  it("traite une URL d'intégration vide comme absente, et retombe sur le fichier", () => {
    // `.env.example` livre la clé sans valeur pour rester copiable tel quel vers
    // `.env.local`, comme TURSO_AUTH_TOKEN. La préférer au fichier renverrait le
    // dev sur une URL vide au premier `bun run dev`.
    expect(urlDeLaBase(parseEnv({ TURSO_DATABASE_URL: "" }))).toBe("./data/app.db");
  });
});
