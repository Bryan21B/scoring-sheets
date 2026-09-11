import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import type { Base } from "@/db/base";
import { trouverEntree } from "@/lib/jeux/catalogue";
import { estComplete, gagnantDeManche } from "@/lib/jeux/moteur";
import type { Regles } from "@/lib/jeux/regles";
import { resoudreRegles } from "@/lib/jeux/resolution";
import { lireLaManche, mancheDuMoteur, type VueDeManche } from "@/lib/manche/lecture";
import { ouvrirLaMancheSuivante } from "@/lib/manche/ouverture";
import { ecrireLaCase } from "@/lib/manche/saisie";
import { type BaseDeTest, creerBaseDeTest } from "../helpers/base-de-test";
import {
  joueurDeLaPartie,
  ouvrirUnePartieDeTest,
  type PartieDeTest,
} from "../helpers/partie-de-test";

let baseDeTest: BaseDeTest;
let base: Base;

/** Une table déjà ouverte sur un jeu, avec sa première manche. */
type TableDeTest = {
  partie: PartieDeTest;
  mancheId: number;
  regles: Regles;
};

async function ouvrirUneTable(
  jeuId: "uno" | "dnup",
  noms: readonly string[],
  finValeur: string,
): Promise<TableDeTest> {
  const partie = await ouvrirUnePartieDeTest(base, { jeuId, noms, finValeur });

  return {
    partie,
    mancheId: (await ouvrirLaMancheSuivante(base, partie.partieId)).id,
    regles: resoudreRegles(trouverEntree(jeuId), { nombreDeJoueurs: noms.length }),
  };
}

/** Uno à trois : Marie tient le téléphone, Paul et Léa sont à côté. */
function uno(): Promise<TableDeTest> {
  return ouvrirUneTable("uno", ["Marie", "Paul", "Léa"], "500");
}

/** Dnup à quatre : deux rangs à désigner, `[2, 1]` au barème. */
function dnup(): Promise<TableDeTest> {
  return ouvrirUneTable("dnup", ["Marie", "Paul", "Léa", "Tom"], "4");
}

/** Dnup à deux : pas de jetons du tout, et la partie se gagne en manches. */
function dnupADeux(): Promise<TableDeTest> {
  return ouvrirUneTable("dnup", ["Marie", "Paul"], "2");
}

/**
 * Ce que l'écran envoie : la case d'un joueur, montrée vide, et la valeur du
 * geste — le rang d'une désignation au podium, le vide à Uno, un total sinon.
 */
async function ecrire(
  table: TableDeTest,
  rang: number,
  valeur: unknown,
  valeurMontree: unknown = null,
) {
  const agissant = joueurDeLaPartie(table.partie, 0);

  return ecrireLaCase(base, {
    mancheId: table.mancheId,
    joueurConcerneId: joueurDeLaPartie(table.partie, rang),
    valeurMontree,
    valeur,
    agissant: { joueurId: agissant, appareilId: table.partie.idAppareil },
  });
}

async function relire(table: TableDeTest): Promise<VueDeManche> {
  const vue = await lireLaManche(base, table.partie.partieId, 1);

  if (vue === null) {
    throw new Error("La manche de test a disparu.");
  }

  return vue;
}

/** La manche telle que le moteur la reçoit, clôture déclarée mise à part. */
async function pourLeMoteur(table: TableDeTest) {
  return mancheDuMoteur((await relire(table)).cases, false);
}

beforeEach(() => {
  baseDeTest = creerBaseDeTest();
  base = baseDeTest.base;
});

afterEach(() => {
  baseDeTest.fermer();
});

describe("Uno : une désignation, puis un total unique", () => {
  it("désigne le sorti en touchant sa case, qui reste vide", async () => {
    const table = await uno();

    const resultat = await ecrire(table, 1, "");

    expect(resultat).toEqual({ statut: "ecrite", valeur: null });
  });

  it("laisse la case du gagnant exister et valoir vide entre les deux gestes", async () => {
    const table = await uno();

    await ecrire(table, 1, "");

    const vue = await relire(table);

    expect(vue.cases.map((une) => [une.joueur.nom, une.valeur, une.touchee])).toEqual([
      ["Marie", null, false],
      ["Paul", null, true],
      ["Léa", null, false],
    ]);
  });

  it("ne rend la manche complète qu'une fois le total tapé", async () => {
    const table = await uno();

    await ecrire(table, 1, "");
    expect(estComplete(table.regles, await pourLeMoteur(table))).toBe(false);

    await ecrire(table, 1, "24", "");
    expect(estComplete(table.regles, await pourLeMoteur(table))).toBe(true);
  });

  it("crédite le total au gagnant désigné, qui est celui que le moteur nomme", async () => {
    const table = await uno();

    await ecrire(table, 1, "");
    await ecrire(table, 1, "24", "");

    expect(gagnantDeManche(table.regles, await pourLeMoteur(table))).toBe(
      joueurDeLaPartie(table.partie, 1),
    );
  });

  it("accepte un total jusqu'à 999, la borne d'un total et non d'un score", async () => {
    const table = await uno();

    await ecrire(table, 1, "");

    expect(await ecrire(table, 1, "999", "")).toEqual({ statut: "ecrite", valeur: 999 });
  });

  it("refuse au-delà : la borne n'est là que pour attraper une faute de frappe", async () => {
    const table = await uno();

    await expect(ecrire(table, 1, "1000", "")).rejects.toThrow();
  });
});

describe("Dnup : deux désignations et aucun chiffre", () => {
  it("écrit le rang du premier sorti, et non un nombre compté devant soi", async () => {
    const table = await dnup();

    expect(await ecrire(table, 2, "1")).toEqual({ statut: "ecrite", valeur: 1 });
  });

  it("s'arrête au deuxième sorti : la manche est complète à deux rangs", async () => {
    const table = await dnup();

    await ecrire(table, 2, "1");
    expect(estComplete(table.regles, await pourLeMoteur(table))).toBe(false);

    await ecrire(table, 0, "2");
    expect(estComplete(table.regles, await pourLeMoteur(table))).toBe(true);
  });

  it("nomme le premier du podium comme gagnant de la manche", async () => {
    const table = await dnup();

    await ecrire(table, 2, "1");
    await ecrire(table, 0, "2");

    expect(gagnantDeManche(table.regles, await pourLeMoteur(table))).toBe(
      joueurDeLaPartie(table.partie, 2),
    );
  });

  it("refuse un rang que le barème ne porte pas : il n'y a ni troisième ni dernier", async () => {
    const table = await dnup();

    await expect(ecrire(table, 1, "3")).rejects.toThrow();
  });

  it("refuse une case vide : au podium, la désignation est le rang lui-même", async () => {
    const table = await dnup();

    await expect(ecrire(table, 1, "")).rejects.toThrow();
  });
});

describe("Dnup à deux joueurs : sans jetons, en manches gagnées", () => {
  it("se joue sur un seul rang, celui de la dernière carte posée", async () => {
    const table = await dnupADeux();

    await ecrire(table, 1, "1");

    expect(estComplete(table.regles, await pourLeMoteur(table))).toBe(true);
    expect(gagnantDeManche(table.regles, await pourLeMoteur(table))).toBe(
      joueurDeLaPartie(table.partie, 1),
    );
  });

  it("refuse un deuxième rang, que cette variante n'a pas", async () => {
    const table = await dnupADeux();

    await expect(ecrire(table, 0, "2")).rejects.toThrow();
  });
});
