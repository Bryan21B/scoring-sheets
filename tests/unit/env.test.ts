import { describe, expect, it } from "bun:test";
import { parseEnv } from "@/lib/env";

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
