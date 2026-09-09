import { describe, expect, it } from "bun:test";
import { trouverEntree } from "@/lib/jeux/catalogue";
import { finImprimee, libelleDeFin } from "@/lib/partie/tablee";

const sixQuiPrend = trouverEntree("6-qui-prend");
const cartesSpeciales = trouverEntree("6-qui-prend-cartes-speciales");
const uno = trouverEntree("uno");
const dnup = trouverEntree("dnup");

describe("finImprimee", () => {
  it("rend la valeur du catalogue, celle qui pré-remplit le champ", () => {
    expect(finImprimee(sixQuiPrend, 4)).toEqual({ type: "seuil", valeur: 66 });
    expect(finImprimee(uno, 4)).toEqual({ type: "seuil", valeur: 500 });
  });

  it("suit la variation par effectif : Dnup à deux joueurs n'a pas de jetons", () => {
    expect(finImprimee(dnup, 2)).toEqual({ type: "manchesGagnees", valeur: 2 });
    expect(finImprimee(dnup, 3)).toEqual({ type: "seuil", valeur: 4 });
  });

  it("ne rend rien hors des bornes du jeu — il n'y a pas de valeur imprimée là", () => {
    expect(finImprimee(sixQuiPrend, 1)).toBeNull();
    expect(finImprimee(cartesSpeciales, 9)).toBeNull();
    expect(finImprimee(dnup, 6)).toBeNull();
  });

  it("ne rend rien pour un effectif qui n'est pas un entier", () => {
    expect(finImprimee(uno, 3.5)).toBeNull();
    expect(finImprimee(uno, Number.NaN)).toBeNull();
  });
});

describe("libelleDeFin", () => {
  it("dit un seuil dans l'unité du jeu", () => {
    expect(libelleDeFin({ type: "seuil", valeur: 66 }, sixQuiPrend.unite)).toBe("66 têtes de bœuf");
    expect(libelleDeFin({ type: "seuil", valeur: 500 }, uno.unite)).toBe("500 points");
  });

  it("accorde le singulier", () => {
    expect(libelleDeFin({ type: "seuil", valeur: 1 }, sixQuiPrend.unite)).toBe("1 tête de bœuf");
    expect(libelleDeFin({ type: "manchesFixes", valeur: 1 }, uno.unite)).toBe("1 manche");
  });

  it("dit les manches sans passer par l'unité, qui ne les concerne pas", () => {
    expect(libelleDeFin({ type: "manchesFixes", valeur: 2 }, sixQuiPrend.unite)).toBe("2 manches");
    expect(libelleDeFin({ type: "manchesGagnees", valeur: 2 }, dnup.unite)).toBe(
      "2 manches gagnées",
    );
  });
});
