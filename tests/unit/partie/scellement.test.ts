import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { and, eq } from "drizzle-orm";
import type { Base } from "@/db/base";
import { saisie } from "@/db/schema";
import { creerIdAppareil } from "@/lib/appareil/cookie";
import { cloturerLaManche } from "@/lib/manche/cloture";
import { ouvrirLaMancheSuivante } from "@/lib/manche/ouverture";
import { ecrireLaCase } from "@/lib/manche/saisie";
import { PartieScellee } from "@/lib/partie/fin";
import {
  ajouterParticipant,
  rejoindrePartie,
  retirerParticipant,
} from "@/lib/partie/salle-attente";
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

function marie(): number {
  return joueurDeLaPartie(partie, 0);
}

function paul(): number {
  return joueurDeLaPartie(partie, 1);
}

/** Ce que Marie envoie depuis son écran de saisie. */
function demandeDeMarie(surcharges: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    mancheId,
    joueurConcerneId: marie(),
    valeurMontree: null,
    valeur: 8,
    agissant: { joueurId: marie(), appareilId: partie.idAppareil },
    ...surcharges,
  };
}

/** La valeur que la base porte pour cette case. */
async function valeurEnBase(joueurId: number): Promise<number | null | undefined> {
  const [ligne] = await base
    .select({ valeur: saisie.valeur })
    .from(saisie)
    .where(and(eq(saisie.mancheId, mancheId), eq(saisie.joueurId, joueurId)))
    .limit(1);

  return ligne?.valeur;
}

/**
 * Une partie **scellée** : une manche remplie au-delà du seuil, puis close.
 *
 * Le scellement passe par la vraie porte — la clôture qui estampille — et non
 * par un `UPDATE` posé à la main : un test qui fabriquerait la fin lui-même ne
 * dirait rien de la façon dont elle arrive.
 */
beforeEach(async () => {
  baseDeTest = creerBaseDeTest();
  base = baseDeTest.base;
  partie = await ouvrirUnePartieDeTest(base);
  mancheId = (await ouvrirLaMancheSuivante(base, partie.partieId)).id;

  for (const [rang, valeur] of [70, 3, 0].entries()) {
    await ecrireLaCase(base, {
      mancheId,
      joueurConcerneId: joueurDeLaPartie(partie, rang),
      valeurMontree: null,
      valeur,
      agissant: { joueurId: marie(), appareilId: partie.idAppareil },
    });
  }

  await cloturerLaManche(base, { mancheId, parJoueurId: marie() });
});

afterEach(() => {
  baseDeTest.fermer();
});

// Une erreur découverte le lendemain y reste, et le palmarès la portera. Le
// seul recours est de corriger *avant* de clore la manche qui termine la partie.
describe("une partie terminée est scellée", () => {
  it("refuse une saisie", async () => {
    const deuxieme = await ouvrirLaMancheSuivante(base, partie.partieId);

    const ecriture = ecrireLaCase(base, demandeDeMarie({ mancheId: deuxieme.id }));

    expect(ecriture).rejects.toBeInstanceOf(PartieScellee);
  });

  it("refuse une correction, et laisse la valeur fausse telle quelle", async () => {
    const correction = ecrireLaCase(base, demandeDeMarie({ valeurMontree: 70, valeur: 7 }));

    expect(correction).rejects.toBeInstanceOf(PartieScellee);
    expect(await valeurEnBase(marie())).toBe(70);
  });

  it("refuse d'ajouter un participant", async () => {
    const ajout = ajouterParticipant(base, partie.partieId, {
      idAppareil: partie.idAppareil,
      identite: { mode: "nouveau", nom: "Zoé" },
    });

    expect(ajout).rejects.toBeInstanceOf(PartieScellee);
  });

  it("refuse d'en retirer un", async () => {
    const retrait = retirerParticipant(base, partie.partieId, {
      idAppareil: partie.idAppareil,
      joueurId: paul(),
    });

    expect(retrait).rejects.toBeInstanceOf(PartieScellee);
  });

  it("refuse qu'on la rejoigne, et le dit sans mentir sur la manche 1", async () => {
    const arrivee = rejoindrePartie(base, partie.partieId, {
      idAppareil: creerIdAppareil(),
      identite: { mode: "nouveau", nom: "Zoé" },
    });

    expect(arrivee).rejects.toBeInstanceOf(PartieScellee);
  });
});
