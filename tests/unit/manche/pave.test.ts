import { describe, expect, it } from "bun:test";
import { trouverEntree } from "@/lib/jeux/catalogue";
import { appuyerUnChiffre, effacerUnChiffre, valeurDuPave } from "@/lib/manche/pave";

/** Le garde-fou anti-doigt-gras de 6 qui prend, lu du catalogue et non recopié. */
const MAX = (() => {
  const { saisie } = trouverEntree("6-qui-prend").regles;

  if (saisie.mode !== "entierParJoueur") {
    throw new Error("6 qui prend se saisit entier par joueur.");
  }

  return saisie.max;
})();

describe("le pavé maison", () => {
  it("empile les chiffres tapés", () => {
    expect(appuyerUnChiffre(appuyerUnChiffre("", 1, MAX), 2, MAX)).toBe("12");
  });

  it("ne garde pas de zéro de tête : on tape 0 puis 5, on a 5", () => {
    expect(appuyerUnChiffre("0", 5, MAX)).toBe("5");
  });

  it("efface un chiffre à la fois", () => {
    expect(effacerUnChiffre("12")).toBe("1");
  });

  it("efface un champ déjà vide sans broncher", () => {
    expect(effacerUnChiffre("")).toBe("");
  });

  it("rend le nombre tapé", () => {
    expect(valeurDuPave("12")).toBe(12);
  });

  it("rend zéro pour un zéro tapé : une manche à zéro n'est pas une case vide", () => {
    expect(valeurDuPave("0")).toBe(0);
  });

  it("ne rend rien tant que rien n'est tapé", () => {
    expect(valeurDuPave("")).toBeNull();
  });
});

describe("le refus sec du pavé", () => {
  it("refuse le chiffre qui ferait passer au dessus de la borne du mode", () => {
    // 200 têtes de bœuf est déjà un ordre de grandeur de trop ; 2001 en est
    // deux. Le chiffre n'est simplement pas pris.
    expect(appuyerUnChiffre("200", 1, MAX)).toBe("200");
  });

  it("accepte la borne elle-même", () => {
    expect(appuyerUnChiffre("20", 0, MAX)).toBe("200");
  });

  it("refuse sans rien détruire de ce qui était tapé", () => {
    expect(appuyerUnChiffre("199", 9, MAX)).toBe("199");
  });

  it("refuse le premier chiffre déjà trop grand quand la borne est petite", () => {
    expect(appuyerUnChiffre("", 9, 4)).toBe("");
  });
});
