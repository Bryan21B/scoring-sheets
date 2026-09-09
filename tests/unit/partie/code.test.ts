import { describe, expect, it } from "bun:test";
import {
  ALPHABET_CROCKFORD,
  codeSchema,
  genererCode,
  genererCodeUnique,
  LONGUEUR_CODE,
  normaliserCode,
} from "@/lib/partie/code";

describe("l'alphabet", () => {
  it("est celui de Crockford : trente-deux symboles, sans I, L, O ni U", () => {
    expect(ALPHABET_CROCKFORD).toBe("0123456789ABCDEFGHJKMNPQRSTVWXYZ");
    expect(ALPHABET_CROCKFORD).toHaveLength(32);
  });
});

describe("genererCode", () => {
  it("rend six caractères de l'alphabet", () => {
    expect(genererCode()).toMatch(/^[0-9A-HJKMNP-TV-Z]{6}$/);
    expect(genererCode()).toHaveLength(LONGUEUR_CODE);
  });

  it("n'écrit jamais les quatre lettres qui se confondent à l'oral", () => {
    // Un code se dicte à voix haute : I, L, O et U n'y entrent pas, sinon
    // « zéro ou O ? » se pose à chaque partie.
    const milleCodes = Array.from({ length: 1000 }, () => genererCode()).join("");

    expect(milleCodes).not.toMatch(/[ILOU]/);
  });

  it("ne rend pas deux fois le même", () => {
    const tirages = new Set(Array.from({ length: 200 }, () => genererCode()));

    expect(tirages.size).toBeGreaterThan(190);
  });
});

describe("normaliserCode", () => {
  it("accepte les minuscules", () => {
    expect(normaliserCode("a1b2c3")).toBe("A1B2C3");
  });

  it("ramène O sur zéro, I et L sur un", () => {
    expect(normaliserCode("OIL23Z")).toBe("01123Z");
  });

  it("laisse tomber les espaces et les tirets de dictée", () => {
    expect(normaliserCode("A1B-2C3")).toBe("A1B2C3");
    expect(normaliserCode(" A1B 2C3 ")).toBe("A1B2C3");
  });
});

describe("codeSchema", () => {
  it("normalise ce qui est tapé à la main avant de le valider", () => {
    expect(codeSchema.parse("a1b-2c3")).toBe("A1B2C3");
    expect(codeSchema.parse("oil123")).toBe("011123");
  });

  it("refuse une longueur qui n'est pas six", () => {
    expect(codeSchema.safeParse("A1B2C").success).toBe(false);
    expect(codeSchema.safeParse("A1B2C34").success).toBe(false);
  });

  it("refuse un symbole hors alphabet, U compris", () => {
    expect(codeSchema.safeParse("A1B2CU").success).toBe(false);
    expect(codeSchema.safeParse("A1B2C!").success).toBe(false);
  });
});

describe("genererCodeUnique", () => {
  it("rend un code que la base ne porte pas déjà", async () => {
    const code = await genererCodeUnique(() => Promise.resolve(false));

    expect(codeSchema.safeParse(code).success).toBe(true);
  });

  it("retire tant que le tirage tombe sur un code déjà pris", async () => {
    let appels = 0;
    const deuxCollisionsPuisLibre = (): Promise<boolean> => {
      appels += 1;
      return Promise.resolve(appels <= 2);
    };

    const code = await genererCodeUnique(deuxCollisionsPuisLibre);

    expect(appels).toBe(3);
    expect(codeSchema.safeParse(code).success).toBe(true);
  });

  it("abandonne plutôt que de boucler sans fin quand tout est pris", async () => {
    // Une base qui répond « pris » à chaque tirage est cassée, pas pleine :
    // 2³⁰ combinaisons pour quelques centaines de parties. Boucler pour
    // toujours transformerait une panne en requête qui ne revient jamais.
    await expect(genererCodeUnique(() => Promise.resolve(true))).rejects.toThrow();
  });
});
