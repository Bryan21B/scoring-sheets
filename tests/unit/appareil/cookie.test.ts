import { describe, expect, it } from "bun:test";
import {
  assurerIdAppareil,
  creerIdAppareil,
  DUREE_COOKIE_APPAREIL,
  idAppareilSchema,
  NOM_COOKIE_APPAREIL,
  OPTIONS_COOKIE_APPAREIL,
} from "@/lib/appareil/cookie";

describe("les drapeaux du cookie d'appareil", () => {
  it("porte ceux qui ont été décidés, et le chemin de tout le site", () => {
    expect(NOM_COOKIE_APPAREIL).toBe("appareil");
    expect(OPTIONS_COOKIE_APPAREIL).toEqual({
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      path: "/",
      maxAge: DUREE_COOKIE_APPAREIL,
    });
  });

  it("dure quatre cents jours, en secondes", () => {
    expect(DUREE_COOKIE_APPAREIL).toBe(34_560_000);
  });

  it("reste en Lax, parce que Strict casserait le parcours principal", () => {
    // Arriver depuis un lien envoyé par messagerie est une navigation
    // cross-site : en Strict le cookie ne partirait pas et l'appareil
    // paraîtrait vierge exactement là où il ne faut pas.
    expect(OPTIONS_COOKIE_APPAREIL.sameSite).toBe("lax");
  });
});

describe("creerIdAppareil", () => {
  it("rend une valeur opaque de vingt et un caractères", () => {
    expect(creerIdAppareil()).toMatch(/^[A-Za-z0-9_-]{21}$/);
  });

  it("ne rend jamais deux fois la même", () => {
    const tirages = new Set(Array.from({ length: 200 }, () => creerIdAppareil()));

    expect(tirages.size).toBe(200);
  });
});

describe("idAppareilSchema", () => {
  it("accepte une valeur de la forme émise", () => {
    expect(idAppareilSchema.safeParse(creerIdAppareil()).success).toBe(true);
  });

  it("refuse une valeur trop courte, trop longue, ou hors alphabet", () => {
    expect(idAppareilSchema.safeParse("trop-court").success).toBe(false);
    expect(idAppareilSchema.safeParse(`${creerIdAppareil()}X`).success).toBe(false);
    expect(idAppareilSchema.safeParse("aaaaaaaaaaaaaaaaaaaa!").success).toBe(false);
  });
});

describe("assurerIdAppareil", () => {
  it("pose une valeur neuve quand l'appareil n'en porte aucune", () => {
    expect(assurerIdAppareil(undefined)).toMatch(/^[A-Za-z0-9_-]{21}$/);
  });

  it("garde celle qui est déjà là — la réémission ne fait pas tourner l'identité", () => {
    const dejaLa = creerIdAppareil();

    expect(assurerIdAppareil(dejaLa)).toBe(dejaLa);
  });

  it("remplace une valeur qui n'a pas la forme émise", () => {
    // Un cookie tronqué ou bricolé à la main n'est pas un appareil connu : on
    // en pose un neuf plutôt que de laisser une clé étrangère invalide filer
    // jusqu'à la table `appareil`.
    const remplacant = assurerIdAppareil("bidon!");

    expect(remplacant).not.toBe("bidon!");
    expect(idAppareilSchema.safeParse(remplacant).success).toBe(true);
  });
});
