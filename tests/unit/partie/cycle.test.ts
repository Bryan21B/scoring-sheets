import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { eq } from "drizzle-orm";
import type { Base } from "@/db/base";
import { joueur, journal, partie as tablePartie } from "@/db/schema";
import type { Agissant } from "@/lib/journal/ligne";
import { abandonnerLaPartie, RefusDeCycle } from "@/lib/partie/cycle";
import { lirePartieEnCours } from "@/lib/partie/en-cours";
import { lireLaFin, PartieScellee } from "@/lib/partie/fin";
import { type BaseDeTest, creerBaseDeTest } from "../helpers/base-de-test";
import {
  joueurDeLaPartie,
  ouvrirUnePartieDeTest,
  type PartieDeTest,
} from "../helpers/partie-de-test";

let baseDeTest: BaseDeTest;
let base: Base;
let partie: PartieDeTest;

function marie(): number {
  return joueurDeLaPartie(partie, 0);
}

/** Ce que l'action serveur résout du cookie : le joueur, et l'appareil à côté. */
function agissantDeMarie(): Agissant {
  return { joueurId: marie(), appareilId: partie.idAppareil };
}

/** Quelqu'un du roster qui n'est **pas** de cette partie : le spectateur. */
async function unSpectateur(): Promise<Agissant> {
  const [ligne] = await base
    .insert(joueur)
    .values({ nom: "Zoé", creeLe: new Date() })
    .returning({ id: joueur.id });

  if (ligne === undefined) {
    throw new Error("Insertion de Zoé sans id rendu.");
  }

  return { joueurId: ligne.id, appareilId: null };
}

/** Les lignes du journal de la partie, dans l'ordre où elles ont été écrites. */
async function lignesDuJournal(): Promise<
  {
    geste: string;
    joueurAgissantId: number;
    appareilId: string | null;
    mancheNumero: number | null;
    joueurConcerneId: number | null;
    detail: string | null;
  }[]
> {
  return base
    .select({
      geste: journal.geste,
      joueurAgissantId: journal.joueurAgissantId,
      appareilId: journal.appareilId,
      mancheNumero: journal.mancheNumero,
      joueurConcerneId: journal.joueurConcerneId,
      detail: journal.detail,
    })
    .from(journal)
    .where(eq(journal.partieId, partie.partieId))
    .orderBy(journal.id);
}

/** L'estampille que les autres téléphones sondent. */
async function versionEnBase(): Promise<number> {
  const [ligne] = await base
    .select({ version: tablePartie.version })
    .from(tablePartie)
    .where(eq(tablePartie.id, partie.partieId))
    .limit(1);

  if (ligne === undefined) {
    throw new Error("La partie de test a disparu.");
  }

  return ligne.version;
}

beforeEach(async () => {
  baseDeTest = creerBaseDeTest();
  base = baseDeTest.base;
  partie = await ouvrirUnePartieDeTest(base);
});

afterEach(() => {
  baseDeTest.fermer();
});

describe("abandonner une partie", () => {
  it("estampille la fin : sa date, la cause « abandonnee » et son auteur", async () => {
    const abandon = await abandonnerLaPartie(base, partie.partieId, agissantDeMarie());

    expect(abandon.cause).toBe("abandonnee");
    expect(abandon.par).toBe(marie());
    expect(await lireLaFin(base, partie.partieId)).toEqual(abandon);
  });

  it("écrit sa ligne de journal, et elle ne porte aucune case", async () => {
    await abandonnerLaPartie(base, partie.partieId, agissantDeMarie());

    expect(await lignesDuJournal()).toEqual([
      {
        geste: "abandon",
        joueurAgissantId: marie(),
        appareilId: partie.idAppareil,
        mancheNumero: null,
        joueurConcerneId: null,
        detail: null,
      },
    ]);
  });

  it("fait bouger l'estampille, sans quoi les autres téléphones ne l'apprendraient pas", async () => {
    const avant = await versionEnBase();

    await abandonnerLaPartie(base, partie.partieId, agissantDeMarie());

    expect(await versionEnBase()).toBeGreaterThan(avant);
  });

  it("refuse le spectateur, et ne laisse ni fin ni ligne derrière lui", async () => {
    const abandon = abandonnerLaPartie(base, partie.partieId, await unSpectateur());

    expect(abandon).rejects.toBeInstanceOf(RefusDeCycle);
    expect(await lireLaFin(base, partie.partieId)).toBeNull();
    expect(await lignesDuJournal()).toEqual([]);
  });

  it("refuse une partie déjà abandonnée : elle ne s'abandonne pas deux fois", async () => {
    const premier = await abandonnerLaPartie(base, partie.partieId, agissantDeMarie());

    const second = abandonnerLaPartie(base, partie.partieId, agissantDeMarie());

    expect(second).rejects.toBeInstanceOf(PartieScellee);
    expect(await lireLaFin(base, partie.partieId)).toEqual(premier);
  });

  it("sort la partie de l'accueil : c'est tout le métier du balai", async () => {
    expect((await lirePartieEnCours(base))?.code).toBe(partie.code);

    await abandonnerLaPartie(base, partie.partieId, agissantDeMarie());

    expect(await lirePartieEnCours(base)).toBeNull();
  });
});
