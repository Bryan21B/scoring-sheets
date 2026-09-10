import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { eq } from "drizzle-orm";
import type { Base } from "@/db/base";
import { partie } from "@/db/schema";
import { lirePartieEnCours } from "@/lib/partie/en-cours";
import { type BaseDeTest, creerBaseDeTest } from "../helpers/base-de-test";
import { joueurDeLaPartie, ouvrirUnePartieDeTest } from "../helpers/partie-de-test";

let baseDeTest: BaseDeTest;
let base: Base;

beforeEach(() => {
  baseDeTest = creerBaseDeTest();
  base = baseDeTest.base;
});

afterEach(() => {
  baseDeTest.fermer();
});

/** Estampille une fin sur cette partie : les trois colonnes bougent ensemble. */
async function terminer(partieId: number, joueurId: number): Promise<void> {
  await base
    .update(partie)
    .set({ finLe: new Date(), finCause: "terminee", finPar: joueurId })
    .where(eq(partie.id, partieId));
}

describe("lirePartieEnCours", () => {
  it("rend null quand rien ne tourne : c'est là que le catalogue reprend l'écran", async () => {
    expect(await lirePartieEnCours(base)).toBeNull();
  });

  it("rend la partie ouverte, avec de quoi la montrer en entier", async () => {
    const ouverte = await ouvrirUnePartieDeTest(base);

    const vue = await lirePartieEnCours(base);

    expect(vue?.code).toBe(ouverte.code);
    expect(vue?.participants.map((joueur) => joueur.nom)).toEqual(["Marie", "Paul", "Léa"]);
  });

  it("ne rend pas une partie qui porte une fin : elle a quitté l'écran d'accueil", async () => {
    const finie = await ouvrirUnePartieDeTest(base);
    await terminer(finie.partieId, joueurDeLaPartie(finie, 0));

    expect(await lirePartieEnCours(base)).toBeNull();
  });

  it("rend la plus récente quand deux tournent : l'autre se retrouve par son code", async () => {
    await ouvrirUnePartieDeTest(base, { noms: ["Zoé", "Nour"] });
    const derniere = await ouvrirUnePartieDeTest(base, { noms: ["Tom", "Ana"] });

    expect((await lirePartieEnCours(base))?.code).toBe(derniere.code);
  });

  it("porte l'estampille de version, que le poll interroge", async () => {
    await ouvrirUnePartieDeTest(base);

    expect((await lirePartieEnCours(base))?.version).toBeGreaterThan(0);
  });
});
