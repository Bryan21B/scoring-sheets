import { describe, expect, it } from "bun:test";
import {
  ecrireIdentiteChoisie,
  lireIdentiteChoisie,
  premierParametre,
} from "@/lib/partie/identite-url";

describe("premierParametre", () => {
  it("rend la valeur unique", () => {
    expect(premierParametre("Marie")).toBe("Marie");
  });

  it("rend la première quand l'adresse en porte plusieurs", () => {
    expect(premierParametre(["Marie", "Paul"])).toBe("Marie");
  });

  it("ne rend rien quand le paramètre est absent ou vide", () => {
    expect(premierParametre(undefined)).toBeUndefined();
    expect(premierParametre([])).toBeUndefined();
  });
});

describe("lireIdentiteChoisie", () => {
  it("lit un joueur choisi dans le roster", () => {
    expect(lireIdentiteChoisie({ joueurId: "3" })).toEqual({ mode: "roster", joueurId: 3 });
  });

  it("lit un nom tapé", () => {
    expect(lireIdentiteChoisie({ nom: "Marie B." })).toEqual({
      mode: "nouveau",
      nom: "Marie B.",
    });
  });

  it("fait gagner le choix explicite sur le nom tapé", () => {
    // On arrive là par « C’est elle » après une désambiguïsation : le nom tapé
    // traîne encore dans l'adresse, et c'est le choix qui tranche.
    expect(lireIdentiteChoisie({ joueurId: "3", nom: "Marie" })).toEqual({
      mode: "roster",
      joueurId: 3,
    });
  });

  it("ne lit rien quand l'adresse ne porte aucune identité", () => {
    expect(lireIdentiteChoisie({})).toBeNull();
  });

  it("refuse un joueur qui n'est pas un entier positif", () => {
    expect(lireIdentiteChoisie({ joueurId: "trois" })).toBeNull();
    expect(lireIdentiteChoisie({ joueurId: "0" })).toBeNull();
    expect(lireIdentiteChoisie({ joueurId: "-1" })).toBeNull();
  });

  it("refuse un nom vide", () => {
    expect(lireIdentiteChoisie({ nom: "   " })).toBeNull();
  });
});

describe("ecrireIdentiteChoisie", () => {
  it("fait l'aller-retour pour un joueur du roster", () => {
    const parametres = ecrireIdentiteChoisie({ mode: "roster", joueurId: 12 });

    expect(lireIdentiteChoisie(Object.fromEntries(parametres))).toEqual({
      mode: "roster",
      joueurId: 12,
    });
  });

  it("fait l'aller-retour pour un nom neuf, accents et espaces compris", () => {
    const parametres = ecrireIdentiteChoisie({ mode: "nouveau", nom: "Zoé B." });

    expect(lireIdentiteChoisie(Object.fromEntries(parametres))).toEqual({
      mode: "nouveau",
      nom: "Zoé B.",
    });
  });
});
