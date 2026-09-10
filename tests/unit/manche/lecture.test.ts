import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import type { Base } from "@/db/base";
import { trouverEntree } from "@/lib/jeux/catalogue";
import { resoudreRegles } from "@/lib/jeux/resolution";
import { evaluerLaPartie, lireLaManche } from "@/lib/manche/lecture";
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
let partie: PartieDeTest;
let mancheId: number;

/** Les règles figées à l'ouverture de la partie de test : 6 qui prend à trois. */
const REGLES = resoudreRegles(trouverEntree("6-qui-prend"), { nombreDeJoueurs: 3 });

function joueurA(rang: number): number {
  return joueurDeLaPartie(partie, rang);
}

/** Pose une valeur sur la case de ce joueur, en partant du vide. */
async function poser(joueurConcerneId: number, valeur: number, surMancheId = mancheId) {
  await ecrireLaCase(base, {
    mancheId: surMancheId,
    joueurConcerneId,
    valeurMontree: null,
    valeur,
    agissant: { joueurId: joueurA(0), appareilId: partie.idAppareil },
  });
}

beforeEach(async () => {
  baseDeTest = creerBaseDeTest();
  base = baseDeTest.base;
  partie = await ouvrirUnePartieDeTest(base);
  mancheId = (await ouvrirLaMancheSuivante(base, partie.partieId)).id;
});

afterEach(() => {
  baseDeTest.fermer();
});

describe("lireLaManche", () => {
  it("nomme une case par participant, dans l'ordre de la tablée", async () => {
    const vue = await lireLaManche(base, partie.partieId, 1);

    expect(vue?.cases.map((une) => une.joueur.nom)).toEqual(["Marie", "Paul", "Léa"]);
  });

  it("laisse vides les cases que personne n'a touchées", async () => {
    const vue = await lireLaManche(base, partie.partieId, 1);

    expect(vue?.cases.map((une) => une.valeur)).toEqual([null, null, null]);
  });

  it("porte les valeurs saisies", async () => {
    await poser(joueurA(1), 15);

    const vue = await lireLaManche(base, partie.partieId, 1);

    expect(vue?.cases.map((une) => une.valeur)).toEqual([null, 15, null]);
  });

  it("dit son numéro, celui que le journal garde", async () => {
    const vue = await lireLaManche(base, partie.partieId, 1);

    expect(vue?.numero).toBe(1);
  });

  it("rend null pour un numéro que cette partie ne porte pas", async () => {
    expect(await lireLaManche(base, partie.partieId, 99)).toBeNull();
  });
});

describe("evaluerLaPartie", () => {
  it("rend les totaux du moteur, manche en cours comprise", async () => {
    await poser(joueurA(0), 8);
    await poser(joueurA(1), 15);

    const etat = await evaluerLaPartie(base, partie.partieId, REGLES);

    expect(etat.totaux.get(joueurA(0))).toBe(8);
    expect(etat.totaux.get(joueurA(1))).toBe(15);
  });

  it("part de zéro pour un participant qui n'a encore rien saisi", async () => {
    await poser(joueurA(0), 8);

    const etat = await evaluerLaPartie(base, partie.partieId, REGLES);

    expect(etat.totaux.get(joueurA(2))).toBe(0);
  });

  it("cumule d'une manche à l'autre", async () => {
    const deuxieme = await ouvrirLaMancheSuivante(base, partie.partieId);
    await poser(joueurA(0), 8);
    await poser(joueurA(0), 5, deuxieme.id);

    const etat = await evaluerLaPartie(base, partie.partieId, REGLES);

    expect(etat.totaux.get(joueurA(0))).toBe(13);
  });

  it("ne compte comme jouée qu'une manche close", async () => {
    await poser(joueurA(0), 8);

    const etat = await evaluerLaPartie(base, partie.partieId, REGLES);

    expect(etat.manchesJouees).toBe(0);
  });

  it("ne lit que les manches de sa partie", async () => {
    const voisine = await ouvrirUnePartieDeTest(base, { noms: ["Zoé", "Tom"] });
    const chezElle = await ouvrirLaMancheSuivante(base, voisine.partieId);
    await poser(joueurDeLaPartie(voisine, 0), 40, chezElle.id);

    const etat = await evaluerLaPartie(base, partie.partieId, REGLES);

    expect([...etat.totaux.keys()]).toEqual([joueurA(0), joueurA(1), joueurA(2)]);
  });
});
