import { describe, expect, it } from "bun:test";
import { trouverEntree } from "@/lib/jeux/catalogue";
import { parseRegles } from "@/lib/jeux/regles";
import { resoudreRegles } from "@/lib/jeux/resolution";

const sixQuiPrend = trouverEntree("6-qui-prend");
const uno = trouverEntree("uno");
const dnup = trouverEntree("dnup");

describe("resoudreRegles", () => {
  it("produit l'instantané que la partie fige", () => {
    const regles = resoudreRegles(sixQuiPrend, { nombreDeJoueurs: 4 });

    expect(regles).toEqual({
      classement: { direction: "bas" },
      saisie: { mode: "entierParJoueur", min: 0, max: 200 },
      fin: { type: "seuil", valeur: 66 },
      joueursMin: 2,
      joueursMax: 10,
    });
  });

  it("rend un instantané qui se relit tel quel depuis du JSON", () => {
    const regles = resoudreRegles(dnup, { nombreDeJoueurs: 4 });

    expect(parseRegles(JSON.stringify(regles))).toEqual(regles);
  });

  it("laisse la présentation au catalogue", () => {
    // Nom, famille, unité et liens de règles se relisent du catalogue à
    // l'affichage : les figer dans la partie ferait deux sources pour un même
    // mot, et une correction de libellé ne rattraperait pas les parties passées.
    const regles = resoudreRegles(uno, { nombreDeJoueurs: 3 });

    expect(Object.keys(regles).sort()).toEqual([
      "classement",
      "fin",
      "joueursMax",
      "joueursMin",
      "saisie",
    ]);
  });

  it("détache l'instantané du catalogue", () => {
    // `as const` ne gèle rien à l'exécution : rendre les sous-objets du
    // catalogue par référence laisserait une partie réécrire le jeu pour toutes
    // les autres, et l'instantané ne serait plus un instantané.
    const regles = resoudreRegles(uno, { nombreDeJoueurs: 4 });

    regles.classement.direction = "bas";

    expect(uno.regles.classement.direction).toBe("haut");
  });

  it("n'emporte pas finSelonJoueurs dans l'instantané", () => {
    const regles = resoudreRegles(dnup, { nombreDeJoueurs: 2 });

    expect(regles).not.toHaveProperty("finSelonJoueurs");
  });
});

describe("finSelonJoueurs", () => {
  it("sort Dnup en manches gagnées à deux joueurs", () => {
    // À deux, Dnup n'a pas de jetons du tout : c'est une variante à part, et la
    // partie se gagne à deux manches.
    expect(resoudreRegles(dnup, { nombreDeJoueurs: 2 }).fin).toEqual({
      type: "manchesGagnees",
      valeur: 2,
    });
  });

  it("sort Dnup en seuil à trois joueurs et plus", () => {
    for (const nombreDeJoueurs of [3, 4, 5]) {
      expect(resoudreRegles(dnup, { nombreDeJoueurs }).fin).toEqual({
        type: "seuil",
        valeur: 4,
      });
    }
  });

  it("ne change rien pour une entrée qui n'en déclare pas", () => {
    expect(resoudreRegles(sixQuiPrend, { nombreDeJoueurs: 2 }).fin).toEqual({
      type: "seuil",
      valeur: 66,
    });
  });

  it("refuse un effectif hors des bornes du jeu", () => {
    // Plancher et plafond durs : le nombre de joueurs est lu une fois, à
    // l'ouverture, donc une table hors bornes doit être refusée là.
    expect(() => resoudreRegles(dnup, { nombreDeJoueurs: 6 })).toThrow();
    expect(() => resoudreRegles(dnup, { nombreDeJoueurs: 1 })).toThrow();
    expect(() => resoudreRegles(sixQuiPrend, { nombreDeJoueurs: 11 })).toThrow();
  });
});

describe("la surcharge de fin", () => {
  it("remplace la valeur de fin, et elle seule", () => {
    const regles = resoudreRegles(uno, { nombreDeJoueurs: 4, finValeur: 300 });

    expect(regles.fin).toEqual({ type: "seuil", valeur: 300 });
    expect(regles.saisie).toEqual(uno.regles.saisie);
    expect(regles.classement).toEqual(uno.regles.classement);
    expect(regles.joueursMax).toBe(uno.regles.joueursMax);
  });

  it("s'applique après finSelonJoueurs, sans en changer le type", () => {
    const regles = resoudreRegles(dnup, { nombreDeJoueurs: 2, finValeur: 3 });

    expect(regles.fin).toEqual({ type: "manchesGagnees", valeur: 3 });
  });

  it("accepte un entier supérieur ou égal à un", () => {
    expect(resoudreRegles(uno, { nombreDeJoueurs: 4, finValeur: 1 }).fin.valeur).toBe(1);
    expect(resoudreRegles(uno, { nombreDeJoueurs: 4, finValeur: 1000 }).fin.valeur).toBe(1000);
  });

  it("refuse zéro, un négatif, un décimal et ce qui n'est pas un nombre", () => {
    // 30 et 200 sont deux soirées valides, 0 n'en est pas une.
    for (const finValeur of [0, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(() => resoudreRegles(uno, { nombreDeJoueurs: 4, finValeur })).toThrow();
    }
  });

  it("garde la valeur du catalogue quand rien n'est surchargé", () => {
    expect(resoudreRegles(uno, { nombreDeJoueurs: 4, finValeur: undefined }).fin.valeur).toBe(500);
    expect(resoudreRegles(uno, { nombreDeJoueurs: 4 }).fin.valeur).toBe(500);
  });
});
