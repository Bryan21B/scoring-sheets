import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { eq } from "drizzle-orm";
import type { Base } from "@/db/base";
import { journal, manche, partie as partieTable, saisie } from "@/db/schema";
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

/** Le rang de tête au podium, tel que la colonne `valeur` le porte. */
const RANG_PREMIER = 1;

/** Marie tient le téléphone ; Paul et Léa sont à côté. */
function marie(): number {
  return joueurDeLaPartie(partie, 0);
}

/** Paul est à côté, et appuie parfois sur le même bouton au même moment. */
function paul(): number {
  return joueurDeLaPartie(partie, 1);
}

/** Remplit une manche pour toute la tablée d'une partie : elle devient complète. */
async function remplir(cible: PartieDeTest, id: number, valeurs: readonly number[]): Promise<void> {
  for (const [rang, valeur] of valeurs.entries()) {
    await ecrireLaCase(base, {
      mancheId: id,
      joueurConcerneId: joueurDeLaPartie(cible, rang),
      valeurMontree: null,
      valeur,
      agissant: { joueurId: joueurDeLaPartie(cible, 0), appareilId: cible.idAppareil },
    });
  }
}

/** Remplit la manche courante pour toute la tablée : elle devient complète. */
async function remplirLaManche(valeurs: readonly number[]): Promise<void> {
  await remplir(partie, mancheId, valeurs);
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

  // Deux clôtures de la même manche : la seconde ne referme rien, et surtout
  // n'estampille pas une deuxième fois.
  it("n'estampille qu'une fois quand deux participants closent la même manche", async () => {
    await remplirLaManche([70, 3, 0]);
    const parMarie = await cloturerLaManche(base, { mancheId, parJoueurId: marie() });

    const parPaul = await cloturerLaManche(base, { mancheId, parJoueurId: paul() });

    expect(parPaul.statut).toBe("dejaClose");
    expect(parPaul.fin).toEqual(parMarie.fin);
    expect((await ligneDePartie())?.finPar).toBe(marie());
  });
});

// Les trois conditions de fin sont trois branches du moteur, jamais trois
// chemins d'écriture : elles passent toutes par la clôture.
describe("les autres conditions de fin passent par la même porte", () => {
  it("termine sur un nombre de manches fixe, sans regarder les totaux", async () => {
    const courte = await ouvrirUnePartieDeTest(base, {
      jeuId: "6-qui-prend-cartes-speciales",
      finValeur: "2",
      noms: ["Anna", "Bruno", "Chloé"],
    });
    const premier = joueurDeLaPartie(courte, 0);

    const une = await ouvrirLaMancheSuivante(base, courte.partieId);
    await remplir(courte, une.id, [1, 2, 3]);
    const apresUne = await cloturerLaManche(base, { mancheId: une.id, parJoueurId: premier });

    const deux = await ouvrirLaMancheSuivante(base, courte.partieId);
    await remplir(courte, deux.id, [1, 2, 3]);
    const apresDeux = await cloturerLaManche(base, { mancheId: deux.id, parJoueurId: premier });

    expect(apresUne.fin).toBeNull();
    expect(apresDeux.fin?.cause).toBe("terminee");
  });

  it("termine sur un nombre de manches gagnées, sans traitement particulier", async () => {
    // Dnup à deux : podium sans jetons, la partie se gagne à deux manches.
    const dnup = await ouvrirUnePartieDeTest(base, {
      jeuId: "dnup",
      noms: ["Zoé", "Tom"],
      finValeur: "2",
    });
    const zoe = joueurDeLaPartie(dnup, 0);
    const fins = [];

    for (const _ of [1, 2]) {
      const tour = await ouvrirLaMancheSuivante(base, dnup.partieId);
      // Le mode `podium` ne se saisit pas case par case : la ligne s'écrit
      // directement, l'écran de désignation suivant son propre ticket.
      await base.insert(saisie).values({ mancheId: tour.id, joueurId: zoe, valeur: RANG_PREMIER });
      fins.push((await cloturerLaManche(base, { mancheId: tour.id, parJoueurId: zoe })).fin);
    }

    expect(fins[0]).toBeNull();
    expect(fins[1]?.cause).toBe("terminee");
  });
});
