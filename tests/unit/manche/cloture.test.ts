import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { eq } from "drizzle-orm";
import type { Base } from "@/db/base";
import { journal, manche, partie as partieTable } from "@/db/schema";
import { cloturerLaManche, RefusDeCloture } from "@/lib/manche/cloture";
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

/** Marie tient le téléphone ; Paul et Léa sont à côté. */
function marie(): number {
  return joueurDeLaPartie(partie, 0);
}

/** Paul est à côté, et appuie parfois sur le même bouton au même moment. */
function paul(): number {
  return joueurDeLaPartie(partie, 1);
}

/** Remplit la manche courante pour toute la tablée : elle devient complète. */
async function remplirLaManche(valeurs: readonly number[]): Promise<void> {
  for (const [rang, valeur] of valeurs.entries()) {
    await ecrireLaCase(base, {
      mancheId,
      joueurConcerneId: joueurDeLaPartie(partie, rang),
      valeurMontree: null,
      valeur,
      agissant: { joueurId: marie(), appareilId: partie.idAppareil },
    });
  }
}

/** La ligne de manche telle que la base la porte. */
async function ligneDeManche() {
  const [ligne] = await base.select().from(manche).where(eq(manche.id, mancheId)).limit(1);

  return ligne;
}

/** La ligne de partie telle que la base la porte, l'estampille de fin comprise. */
async function ligneDePartie() {
  const [ligne] = await base.select().from(partieTable).where(eq(partieTable.id, partie.partieId));

  return ligne;
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

describe("clore une manche", () => {
  it("date la clôture et grave son auteur sur une manche complète", async () => {
    await remplirLaManche([8, 3, 0]);

    const resultat = await cloturerLaManche(base, { mancheId, parJoueurId: marie() });

    expect(resultat.statut).toBe("close");
    const ligne = await ligneDeManche();
    expect(ligne?.closeLe).toBeInstanceOf(Date);
    expect(ligne?.closePar).toBe(marie());
  });

  // Une manche incomplète ne se clôt pas : elle se répare.
  it("refuse une manche incomplète, et ne la date pas au passage", async () => {
    await remplirLaManche([8]);

    const cloture = cloturerLaManche(base, { mancheId, parJoueurId: marie() });

    expect(cloture).rejects.toBeInstanceOf(RefusDeCloture);
    expect((await ligneDeManche())?.closeLe).toBeNull();
  });
});

describe("la clôture n'est pas un geste du journal", () => {
  // Elle ne déplace aucune valeur : il n'y a rien à consigner. Le journal ne
  // doit donc porter que les trois saisies qui ont rempli la manche.
  it("ne laisse aucune ligne de journal", async () => {
    await remplirLaManche([8, 3, 0]);

    await cloturerLaManche(base, { mancheId, parJoueurId: marie() });

    const lignes = await base
      .select({ geste: journal.geste })
      .from(journal)
      .where(eq(journal.partieId, partie.partieId));
    expect(lignes.map(({ geste }) => geste)).toEqual(["saisie", "saisie", "saisie"]);
  });
});

describe("clore une manche déjà close", () => {
  it("ne fait rien et n'annonce aucune erreur : c'est l'écran qu'on voulait", async () => {
    await remplirLaManche([8, 3, 0]);
    await cloturerLaManche(base, { mancheId, parJoueurId: marie() });

    const seconde = await cloturerLaManche(base, { mancheId, parJoueurId: paul() });

    expect(seconde.statut).toBe("dejaClose");
  });

  it("garde la date et l'auteur du premier, jamais ceux du second", async () => {
    await remplirLaManche([8, 3, 0]);
    await cloturerLaManche(base, { mancheId, parJoueurId: marie() });
    const premiere = await ligneDeManche();

    await cloturerLaManche(base, { mancheId, parJoueurId: paul() });

    const apres = await ligneDeManche();
    expect(apres?.closePar).toBe(marie());
    expect(apres?.closeLe).toEqual(premiere?.closeLe ?? null);
  });
});

describe("la clôture qui termine la partie estampille la fin", () => {
  it("pose la date, la cause « terminee » et l'auteur, dans la même transaction", async () => {
    await remplirLaManche([70, 3, 0]);

    const resultat = await cloturerLaManche(base, { mancheId, parJoueurId: marie() });

    expect(resultat.fin).not.toBeNull();
    const ligne = await ligneDePartie();
    expect(ligne?.finLe).toBeInstanceOf(Date);
    expect(ligne?.finCause).toBe("terminee");
    expect(ligne?.finPar).toBe(marie());
  });

  it("n'estampille rien tant que le seuil n'est pas franchi", async () => {
    await remplirLaManche([8, 3, 0]);

    const resultat = await cloturerLaManche(base, { mancheId, parJoueurId: marie() });

    expect(resultat.fin).toBeNull();
    expect((await ligneDePartie())?.finLe).toBeNull();
  });
});
