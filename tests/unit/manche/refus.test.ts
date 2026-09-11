import { describe, expect, it } from "bun:test";
import { reappliquer, refusDe } from "@/lib/manche/refus";
import { PAUL } from "../helpers/tablee";

describe("ce qu'un écran retient d'une écriture", () => {
  it("rend un refus quand quelqu'un est passé avant, avec la valeur arrivée", () => {
    const refus = refusDe({ statut: "refusee", valeurArrivee: 8, valeurRefusee: 12 }, PAUL);

    expect(refus).toEqual({ joueur: PAUL, valeurArrivee: 8, valeurTapee: 12 });
  });

  // L'écrasement informé : on voit la valeur, on écrit par dessus, ça passe.
  it("ne rend aucun refus d'une écriture qui est passée", () => {
    expect(refusDe({ statut: "ecrite", valeur: 12 }, PAUL)).toBeNull();
  });

  it("ne rend aucun refus d'une écriture sans effet : le résultat est celui qu'on voulait", () => {
    expect(refusDe({ statut: "sansEffet", valeur: 12 }, PAUL)).toBeNull();
  });

  it("porte une case redevenue vide comme une valeur arrivée à part entière", () => {
    const refus = refusDe({ statut: "refusee", valeurArrivee: null, valeurRefusee: 12 }, PAUL);

    expect(refus).toEqual({ joueur: PAUL, valeurArrivee: null, valeurTapee: 12 });
  });
});

describe("réappliquer la valeur tapée", () => {
  it("repart de la valeur arrivée comme nouvelle condition", () => {
    expect(reappliquer({ joueur: PAUL, valeurArrivee: 8, valeurTapee: 12 }).valeurMontree).toBe(
      "8",
    );
  });

  it("garde la valeur tapée : c'est elle qu'on repose, pas une autre", () => {
    expect(reappliquer({ joueur: PAUL, valeurArrivee: 8, valeurTapee: 12 }).valeur).toBe("12");
  });

  it("repose sur du vide quand la case est redevenue vide", () => {
    expect(reappliquer({ joueur: PAUL, valeurArrivee: null, valeurTapee: 12 })).toEqual({
      valeurMontree: "",
      valeur: "12",
    });
  });

  it("réapplique un zéro, qui est une manche réussie et non une case vide", () => {
    expect(reappliquer({ joueur: PAUL, valeurArrivee: 8, valeurTapee: 0 }).valeur).toBe("0");
  });
});
