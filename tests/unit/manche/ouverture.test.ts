import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { eq } from "drizzle-orm";
import type { Base } from "@/db/base";
import { manche } from "@/db/schema";
import {
  ouvrirLaMancheAuNumero,
  ouvrirLaMancheSuivante,
  prochainNumeroDeManche,
} from "@/lib/manche/ouverture";
import { type BaseDeTest, creerBaseDeTest } from "../helpers/base-de-test";
import { ouvrirUnePartieDeTest, type PartieDeTest } from "../helpers/partie-de-test";

let baseDeTest: BaseDeTest;
let base: Base;
let partie: PartieDeTest;

beforeEach(async () => {
  baseDeTest = creerBaseDeTest();
  base = baseDeTest.base;
  partie = await ouvrirUnePartieDeTest(base);
});

afterEach(() => {
  baseDeTest.fermer();
});

describe("« saisir la manche suivante »", () => {
  it("ouvre la première manche au numéro 1", async () => {
    const ouverte = await ouvrirLaMancheSuivante(base, partie.partieId);

    expect(ouverte.numero).toBe(1);
  });

  it("ouvre la suivante au plus grand numéro plus un", async () => {
    await ouvrirLaMancheSuivante(base, partie.partieId);
    await ouvrirLaMancheSuivante(base, partie.partieId);

    const troisieme = await ouvrirLaMancheSuivante(base, partie.partieId);

    expect(troisieme.numero).toBe(3);
  });

  it("ne réutilise jamais le numéro d'une manche supprimée : le trou reste", async () => {
    await ouvrirLaMancheSuivante(base, partie.partieId);
    const deuxieme = await ouvrirLaMancheSuivante(base, partie.partieId);
    await ouvrirLaMancheSuivante(base, partie.partieId);
    await base.delete(manche).where(eq(manche.id, deuxieme.id));

    const suivante = await ouvrirLaMancheSuivante(base, partie.partieId);

    expect(suivante.numero).toBe(4);
  });

  it("compte les manches de sa partie, jamais celles d'à côté", async () => {
    const voisine = await ouvrirUnePartieDeTest(base, { noms: ["Zoé", "Tom"] });
    await ouvrirLaMancheSuivante(base, voisine.partieId);
    await ouvrirLaMancheSuivante(base, voisine.partieId);

    const premiere = await ouvrirLaMancheSuivante(base, partie.partieId);

    expect(premiere.numero).toBe(1);
  });
});

describe("deux téléphones qui appuient en même temps", () => {
  // Le vrai entrelacement : les deux lisent le plus grand numéro avant que
  // l'autre n'ait écrit, donc les deux visent le même. C'est exactement ce que
  // l'unicité (partie, numéro) existe pour rattraper.
  it("rejoignent la même manche au lieu d'en créer une deuxième", async () => {
    const vuParMarie = await prochainNumeroDeManche(base, partie.partieId);
    const vuParPaul = await prochainNumeroDeManche(base, partie.partieId);

    const cellePourMarie = await ouvrirLaMancheAuNumero(base, partie.partieId, vuParMarie);
    const cellePourPaul = await ouvrirLaMancheAuNumero(base, partie.partieId, vuParPaul);

    expect(cellePourPaul).toEqual(cellePourMarie);
  });

  it("ne laissent qu'une seule ligne en base", async () => {
    const vuParMarie = await prochainNumeroDeManche(base, partie.partieId);
    const vuParPaul = await prochainNumeroDeManche(base, partie.partieId);

    await ouvrirLaMancheAuNumero(base, partie.partieId, vuParMarie);
    await ouvrirLaMancheAuNumero(base, partie.partieId, vuParPaul);

    const lignes = await base.select().from(manche).where(eq(manche.partieId, partie.partieId));

    expect(lignes).toHaveLength(1);
  });

  it("n'est pas une erreur : rejoindre rend la manche, pas un refus", async () => {
    const deja = await ouvrirLaMancheAuNumero(base, partie.partieId, 1);

    const rejointe = await ouvrirLaMancheAuNumero(base, partie.partieId, 1);

    expect(rejointe.id).toBe(deja.id);
  });
});
