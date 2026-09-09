import { describe, expect, it } from "bun:test";
import { parseRegles } from "@/lib/jeux/regles";

/**
 * L'instantané tel qu'une partie le stocke : les règles résolues, et rien
 * d'autre. Chaque cas ci-dessous en dégrade une seule facette.
 */
const instantane = {
  classement: { direction: "bas" },
  saisie: { mode: "entierParJoueur", min: 0, max: 200 },
  fin: { type: "seuil", valeur: 66 },
  joueursMin: 2,
  joueursMax: 10,
} as const;

const json = (valeur: unknown) => JSON.stringify(valeur);

describe("parseRegles", () => {
  it("relit un instantané écrit en JSON", () => {
    expect(parseRegles(json(instantane))).toEqual(instantane);
  });

  it("relit les trois modes de saisie", () => {
    const podium = {
      ...instantane,
      classement: { direction: "haut" },
      saisie: { mode: "podium", jetons: [2, 1] },
      fin: { type: "manchesGagnees", valeur: 2 },
    } as const;
    const somme = {
      ...instantane,
      classement: { direction: "haut" },
      saisie: { mode: "sommeAuGagnant", min: 0, max: 999 },
      fin: { type: "manchesFixes", valeur: 2 },
    } as const;

    expect(parseRegles(json(podium))).toEqual(podium);
    expect(parseRegles(json(somme))).toEqual(somme);
  });

  it("refuse un JSON illisible", () => {
    expect(() => parseRegles("{pas du json")).toThrow();
  });

  it("refuse un mode de saisie inconnu", () => {
    const saisie = { mode: "aDeviner", min: 0, max: 9 };

    expect(() => parseRegles(json({ ...instantane, saisie }))).toThrow();
  });

  it("refuse un type de fin inconnu", () => {
    const fin = { type: "auPremierQuiRit", valeur: 3 };

    expect(() => parseRegles(json({ ...instantane, fin }))).toThrow();
  });

  it("refuse un champ manquant", () => {
    const { fin: _fin, ...sansFin } = instantane;

    expect(() => parseRegles(json(sansFin))).toThrow();
  });

  it("refuse la présentation, qui n'entre jamais dans l'instantané", () => {
    // Un instantané qui accepterait `nom` ferait croire qu'une partie porte son
    // propre nom de jeu — alors qu'il se relit du catalogue à l'affichage, ce
    // qui est précisément ce qui interdit de renommer un id.
    const unite = { un: "point", plusieurs: "points" };

    expect(() => parseRegles(json({ ...instantane, nom: "6 qui prend" }))).toThrow();
    expect(() => parseRegles(json({ ...instantane, unite }))).toThrow();
  });

  it("refuse varianteSelonJoueurs, déjà appliqué au moment où l'instantané se fige", () => {
    const varianteSelonJoueurs = {
      2: { saisie: { mode: "podium", jetons: [0] }, fin: { type: "manchesGagnees", valeur: 2 } },
    };

    expect(() => parseRegles(json({ ...instantane, varianteSelonJoueurs }))).toThrow();
  });
});
