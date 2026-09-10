import { describe, expect, it } from "bun:test";
import { finAAnnoncer, refusAMontrer } from "@/lib/manche/annonce";
import { RefusDeCloture } from "@/lib/manche/cloture";
import type { FinDePartie } from "@/lib/partie/fin";

/** La fin telle que la clôture l'estampille : datée, causée, signée. */
const FIN: FinDePartie = { le: new Date("2026-09-09T21:30:00Z"), cause: "terminee", par: 1 };

describe("ce que la clôture annonce", () => {
  // L'alerte de seuil ne sort que d'ici : une page qui la recalculerait la
  // ferait s'allumer puis s'éteindre au gré des corrections.
  it("n'annonce rien d'une clôture qui ne termine pas la partie", () => {
    expect(finAAnnoncer({ statut: "close", fin: null })).toBeNull();
  });

  it("annonce la fin quand la clôture vient de l'estampiller", () => {
    expect(finAAnnoncer({ statut: "close", fin: FIN })).toEqual({
      statut: "finie",
      cause: "terminee",
    });
  });

  // Le second à appuyer n'a rien refermé, mais la partie est finie et il doit
  // le voir : c'est `fin` qui décide, jamais le statut de la clôture.
  it("annonce la fin au second qui appuie, dont la clôture n'a rien écrit", () => {
    expect(finAAnnoncer({ statut: "dejaClose", fin: FIN })).toEqual({
      statut: "finie",
      cause: "terminee",
    });
  });

  it("n'annonce rien d'une manche déjà close dans une partie qui continue", () => {
    expect(finAAnnoncer({ statut: "dejaClose", fin: null })).toBeNull();
  });

  it("dit la cause telle que l'estampille la porte, sans la deviner", () => {
    const abandonnee = { ...FIN, cause: "abandonnee" } as const;

    expect(finAAnnoncer({ statut: "dejaClose", fin: abandonnee })).toEqual({
      statut: "finie",
      cause: "abandonnee",
    });
  });
});

describe("ce qu'un refus de clôture montre", () => {
  it("montre un refus écrit pour être lu", () => {
    expect(refusAMontrer(new RefusDeCloture("Il manque des valeurs à cette manche."))).toEqual({
      statut: "refusee",
      message: "Il manque des valeurs à cette manche.",
    });
  });

  // Un rapport de champs Zod ou une contrainte SQLite n'aiderait personne à la
  // table, et raconterait la base : il remonte à la frontière d'erreur.
  it("ne montre rien d'une erreur interne", () => {
    expect(refusAMontrer(new Error("SQLITE_CONSTRAINT: FOREIGN KEY"))).toBeNull();
  });

  it("ne montre rien de ce qui n'est même pas une erreur", () => {
    expect(refusAMontrer("boum")).toBeNull();
  });
});
