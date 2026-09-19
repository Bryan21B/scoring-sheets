import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import type { Base } from "@/db/base";
import { creerIdAppareil } from "@/lib/appareil/cookie";
import { retirerDeLaPartie } from "@/lib/partie/depart";
import type { VueDePartie } from "@/lib/partie/lecture";
import { lirePartieParCode } from "@/lib/partie/lecture";
import { RefusDeRejeu, rejouerLaTablee } from "@/lib/partie/rejouer";
import { type BaseDeTest, creerBaseDeTest } from "../helpers/base-de-test";
import {
  joueurDeLaPartie,
  ouvrirUnePartieDeTest,
  type PartieDeTest,
} from "../helpers/partie-de-test";

let baseDeTest: BaseDeTest;
let base: Base;
let partie: PartieDeTest;

/** La partie modèle telle qu'un écran la tient : celle qu'on veut rejouer. */
async function modele(): Promise<VueDePartie> {
  const vue = await lirePartieParCode(base, partie.code);

  if (vue === null) {
    throw new Error("La partie de test est introuvable par son code.");
  }

  return vue;
}

/** Les identifiants d'une tablée, triés : on compare un ensemble, pas un ordre. */
function idsTries(vue: VueDePartie | null): number[] {
  return (vue?.participants ?? []).map((joueur) => joueur.id).sort((un, autre) => un - autre);
}

beforeEach(async () => {
  baseDeTest = creerBaseDeTest();
  base = baseDeTest.base;
  partie = await ouvrirUnePartieDeTest(base);
});

afterEach(() => {
  baseDeTest.fermer();
});

describe("rejouer la même tablée", () => {
  it("ouvre une partie du même jeu, avec les mêmes joueurs, sous un code neuf", async () => {
    const depart = await modele();

    const code = await rejouerLaTablee(base, depart, { idAppareil: partie.idAppareil });

    const rejouee = await lirePartieParCode(base, code);

    expect(code).not.toBe(depart.code);
    expect(rejouee?.jeu.id).toBe(depart.jeu.id);
    // Les **mêmes** joueurs, par leurs identifiants : un rejeu qui recréerait
    // Marie sous un nouvel id ferait une homonyme et casserait son palmarès.
    expect(idsTries(rejouee)).toEqual(idsTries(depart));
  });

  it("refige les mêmes règles, seuil compris, plutôt que les valeurs par défaut", async () => {
    // Ouverte à 40 têtes de bœuf et non aux 66 du catalogue : si le rejeu
    // repartait des défauts, la soirée suivante changerait de règle sans que
    // personne l'ait demandé. Des noms neufs, parce qu'une seconde Marie dans
    // la même base poserait la question de l'homonyme au lieu de créer.
    partie = await ouvrirUnePartieDeTest(base, {
      finValeur: "40",
      noms: ["Anne", "Bob", "Chloé"],
    });
    const depart = await modele();

    const code = await rejouerLaTablee(base, depart, { idAppareil: partie.idAppareil });

    expect((await lirePartieParCode(base, code))?.regles).toEqual(depart.regles);
  });

  it("est refusé au spectateur, qui a le code sans être de la tablée", async () => {
    // Sans cette ligne, un passant ouvrirait une soirée entre des gens qu'il ne
    // connaît pas — en s'y asseyant, puisque la création inscrit son auteur.
    const depart = await modele();

    await expect(
      rejouerLaTablee(base, depart, { idAppareil: creerIdAppareil() }),
    ).rejects.toBeInstanceOf(RefusDeRejeu);
  });

  it("ne rappelle pas celui qui était rentré chez lui en cours de route", async () => {
    await retirerDeLaPartie(base, partie.partieId, {
      idAppareil: partie.idAppareil,
      joueurId: String(joueurDeLaPartie(partie, 1)),
    });
    const depart = await modele();

    const code = await rejouerLaTablee(base, depart, { idAppareil: partie.idAppareil });

    const noms = (await lirePartieParCode(base, code))?.participants.map((un) => un.nom);

    // La tablée entière, et non « Paul n'y est pas » : une assertion d'absence
    // resterait vraie si le rejeu n'asseyait personne du tout. Le test d'au
    // dessus montre que les trois voyagent quand personne n'est parti.
    expect(noms).toEqual(["Marie", "Léa"]);
  });
});
