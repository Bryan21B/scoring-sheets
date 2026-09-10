import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { eq } from "drizzle-orm";
import type { Base } from "@/db/base";
import { partie as partieTable } from "@/db/schema";
import { estampillerLaFin, lireLaFin } from "@/lib/partie/fin";
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

function paul(): number {
  return joueurDeLaPartie(partie, 1);
}

/** La ligne de partie, l'estampille de fin comprise. */
async function ligneDePartie() {
  const [ligne] = await base.select().from(partieTable).where(eq(partieTable.id, partie.partieId));

  return ligne;
}

const QUAND_MARIE_A_CLOS = new Date("2026-09-09T20:00:00.000Z");
const TROIS_SECONDES_PLUS_TARD = new Date("2026-09-09T20:00:03.000Z");

beforeEach(async () => {
  baseDeTest = creerBaseDeTest();
  base = baseDeTest.base;
  partie = await ouvrirUnePartieDeTest(base);
});

afterEach(() => {
  baseDeTest.fermer();
});

describe("lire la fin d'une partie", () => {
  it("rend null tant que la partie est en cours", async () => {
    expect(await lireLaFin(base, partie.partieId)).toBeNull();
  });

  it("rend les trois colonnes d'un bloc une fois la fin posée", async () => {
    await base.transaction(async (tx) =>
      estampillerLaFin(tx, partie.partieId, {
        le: QUAND_MARIE_A_CLOS,
        cause: "terminee",
        par: marie(),
      }),
    );

    expect(await lireLaFin(base, partie.partieId)).toEqual({
      le: QUAND_MARIE_A_CLOS,
      cause: "terminee",
      par: marie(),
    });
  });
});

// Le vrai entrelacement, par la couture exportée : les deux clôtures ont
// calculé `fini` sur une partie encore ouverte, donc les deux estampillent.
// Un `Promise.all` sur une connexion unique se sérialiserait et ne prouverait
// rien ; c'est la condition SQL, et elle seule, qui départage.
describe("deux clôtures simultanées", () => {
  it("n'estampillent la fin qu'une seule fois : le second reçoit celle du premier", async () => {
    const [vuParMarie, vuParPaul] = await base.transaction(async (tx) => [
      await estampillerLaFin(tx, partie.partieId, {
        le: QUAND_MARIE_A_CLOS,
        cause: "terminee",
        par: marie(),
      }),
      await estampillerLaFin(tx, partie.partieId, {
        le: TROIS_SECONDES_PLUS_TARD,
        cause: "terminee",
        par: paul(),
      }),
    ]);

    expect(vuParPaul).toEqual(vuParMarie);
  });

  it("laissent en base la date et l'auteur du premier, jamais ceux du second", async () => {
    await base.transaction(async (tx) => {
      await estampillerLaFin(tx, partie.partieId, {
        le: QUAND_MARIE_A_CLOS,
        cause: "terminee",
        par: marie(),
      });
      await estampillerLaFin(tx, partie.partieId, {
        le: TROIS_SECONDES_PLUS_TARD,
        cause: "terminee",
        par: paul(),
      });
    });

    const ligne = await ligneDePartie();
    expect(ligne?.finLe).toEqual(QUAND_MARIE_A_CLOS);
    expect(ligne?.finPar).toBe(marie());
  });
});
