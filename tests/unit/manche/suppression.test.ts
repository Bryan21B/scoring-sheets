import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { eq } from "drizzle-orm";
import type { Base } from "@/db/base";
import { manche, saisie } from "@/db/schema";
import { lireLeTiroir } from "@/lib/journal/lecture";
import type { Agissant } from "@/lib/journal/ligne";
import type { LigneDuTiroir } from "@/lib/journal/tiroir";
import { ouvrirLaMancheSuivante } from "@/lib/manche/ouverture";
import { ecrireLaCase } from "@/lib/manche/saisie";
import { supprimerLaManche } from "@/lib/manche/suppression";
import { type BaseDeTest, creerBaseDeTest } from "../helpers/base-de-test";
import {
  joueurDeLaPartie,
  ouvrirUnePartieDeTest,
  type PartieDeTest,
} from "../helpers/partie-de-test";

let baseDeTest: BaseDeTest;
let base: Base;
let partie: PartieDeTest;

/** Marie tient le téléphone ; Paul et Léa sont à côté, sans le leur. */
function marie(): number {
  return joueurDeLaPartie(partie, 0);
}

function paul(): number {
  return joueurDeLaPartie(partie, 1);
}

/** Celui qui agit dans ces tests : le téléphone de Marie, se déclarant Marie. */
function agissant(): Agissant {
  return { joueurId: marie(), appareilId: partie.idAppareil };
}

/**
 * Une case écrite par le **vrai** chemin d'écriture.
 *
 * Insérer la ligne à la main donnerait une manche que la production ne produit
 * jamais — sans ligne de journal — et la suppression se lirait alors contre un
 * décor, pas contre un état réel.
 */
async function ecrire(mancheId: number, joueurConcerneId: number, valeur: number): Promise<void> {
  const resultat = await ecrireLaCase(base, {
    mancheId,
    joueurConcerneId,
    valeurMontree: null,
    valeur,
    agissant: agissant(),
  });

  if (resultat.statut !== "ecrite") {
    throw new Error(`Écriture attendue, reçu « ${resultat.statut} ».`);
  }
}

/** Les numéros des manches que la partie porte encore, dans l'ordre. */
async function numerosDesManches(): Promise<number[]> {
  const lignes = await base
    .select({ numero: manche.numero })
    .from(manche)
    .where(eq(manche.partieId, partie.partieId));

  return lignes.map((ligne) => ligne.numero).sort((a, b) => a - b);
}

/** Le nombre de cases encore en base, toutes manches confondues. */
async function casesRestantes(): Promise<number> {
  return (await base.select({ id: saisie.id }).from(saisie)).length;
}

/**
 * Le journal entier, relu par le **tiroir** et non par un `select`.
 *
 * C'est la lecture publique : ce qu'on vérifie est ce qu'on viendra lire le
 * jour où un score a bougé, pas la forme du JSON en colonne.
 */
async function lignesDuJournal(id = partie.partieId): Promise<readonly LigneDuTiroir[]> {
  const tiroir = await lireLeTiroir(base, id, { journal: "tout" });

  if (tiroir.etat !== "ouvert") {
    throw new Error(`Tiroir ouvert attendu, reçu « ${tiroir.etat} ».`);
  }

  return tiroir.lignes;
}

beforeEach(async () => {
  baseDeTest = creerBaseDeTest();
  base = baseDeTest.base;
  partie = await ouvrirUnePartieDeTest(base);
});

afterEach(() => {
  baseDeTest.fermer();
});

describe("supprimer une manche", () => {
  it("efface la manche et emporte les cases qu'elle portait", async () => {
    const premiere = await ouvrirLaMancheSuivante(base, partie.partieId);
    await ecrire(premiere.id, marie(), 12);
    await ecrire(premiere.id, paul(), 7);

    await supprimerLaManche(base, partie.partieId, { numero: 1, agissant: agissant() });

    expect(await numerosDesManches()).toEqual([]);
    expect(await casesRestantes()).toBe(0);
  });

  it("laisse un trou : supprimer la manche 2 sur trois laisse 1 et 3", async () => {
    await ouvrirLaMancheSuivante(base, partie.partieId);
    await ouvrirLaMancheSuivante(base, partie.partieId);
    await ouvrirLaMancheSuivante(base, partie.partieId);

    await supprimerLaManche(base, partie.partieId, { numero: 2, agissant: agissant() });

    expect(await numerosDesManches()).toEqual([1, 3]);
  });

  it("ne réattribue pas le numéro : la manche suivante reste le plus grand plus un", async () => {
    await ouvrirLaMancheSuivante(base, partie.partieId);
    await ouvrirLaMancheSuivante(base, partie.partieId);
    await ouvrirLaMancheSuivante(base, partie.partieId);
    await supprimerLaManche(base, partie.partieId, { numero: 2, agissant: agissant() });

    const suivante = await ouvrirLaMancheSuivante(base, partie.partieId);

    expect(suivante.numero).toBe(4);
  });

  it("ne touche pas les manches d'à côté", async () => {
    const premiere = await ouvrirLaMancheSuivante(base, partie.partieId);
    const deuxieme = await ouvrirLaMancheSuivante(base, partie.partieId);
    await ecrire(premiere.id, marie(), 12);
    await ecrire(deuxieme.id, marie(), 9);

    await supprimerLaManche(base, partie.partieId, { numero: 1, agissant: agissant() });

    expect(await casesRestantes()).toBe(1);
  });

  it("rend « déjà supprimée » au second appui, sans rien annoncer de plus", async () => {
    await ouvrirLaMancheSuivante(base, partie.partieId);
    await supprimerLaManche(base, partie.partieId, { numero: 1, agissant: agissant() });

    const second = await supprimerLaManche(base, partie.partieId, {
      numero: 1,
      agissant: agissant(),
    });

    expect(second.statut).toBe("dejaSupprimee");
  });
});

describe("la ligne que la suppression écrit", () => {
  it("en écrit **une seule**, qui emporte toutes les valeurs effacées", async () => {
    const premiere = await ouvrirLaMancheSuivante(base, partie.partieId);
    await ecrire(premiere.id, marie(), 12);
    await ecrire(premiere.id, paul(), 7);

    await supprimerLaManche(base, partie.partieId, { numero: 1, agissant: agissant() });

    const suppressions = (await lignesDuJournal()).filter(
      (ligne) => ligne.geste === "suppressionDeManche",
    );

    expect(suppressions).toHaveLength(1);
    expect(suppressions[0]?.mancheNumero).toBe(1);
    expect(suppressions[0]?.detail).toEqual({
      forme: "valeursEffacees",
      valeurs: [
        { joueur: { id: marie(), nom: "Marie" }, valeur: 12 },
        { joueur: { id: paul(), nom: "Paul" }, valeur: 7 },
      ],
    });
  });

  it("garde la case **touchée mais vide** : le vide est une valeur", async () => {
    // Uno, parce que c'est le seul mode où une case existe sans porter de
    // nombre : désigner le sorti pose la ligne, le total se tape ensuite.
    const uno = await ouvrirUnePartieDeTest(base, {
      jeuId: "uno",
      finValeur: "500",
      noms: ["Zoé", "Tom", "Ana"],
    });
    const zoe = { joueurId: joueurDeLaPartie(uno, 0), appareilId: uno.idAppareil };
    const tom = joueurDeLaPartie(uno, 1);
    const premiere = await ouvrirLaMancheSuivante(base, uno.partieId);
    await ecrireLaCase(base, {
      mancheId: premiere.id,
      joueurConcerneId: tom,
      valeurMontree: null,
      valeur: null,
      agissant: zoe,
    });

    await supprimerLaManche(base, uno.partieId, { numero: 1, agissant: zoe });

    const [ligne] = (await lignesDuJournal(uno.partieId)).filter(
      (une) => une.geste === "suppressionDeManche",
    );

    expect(ligne?.detail).toEqual({
      forme: "valeursEffacees",
      valeurs: [{ joueur: { id: tom, nom: "Tom" }, valeur: null }],
    });
  });

  it("écrit la ligne même quand la manche ne portait rien, et le dit", async () => {
    await ouvrirLaMancheSuivante(base, partie.partieId);

    await supprimerLaManche(base, partie.partieId, { numero: 1, agissant: agissant() });

    const [ligne] = await lignesDuJournal();

    expect(ligne?.geste).toBe("suppressionDeManche");
    expect(ligne?.detail).toEqual({ forme: "valeursEffacees", valeurs: [] });
  });

  it("laisse en place les lignes antérieures de cette manche", async () => {
    const premiere = await ouvrirLaMancheSuivante(base, partie.partieId);
    await ecrire(premiere.id, marie(), 12);
    await ecrire(premiere.id, paul(), 7);

    await supprimerLaManche(base, partie.partieId, { numero: 1, agissant: agissant() });

    // Les plus récentes en tête : la suppression, puis les deux saisies qu'elle
    // a effacées. Une manche 1 supprimée puis ressaisie se lit trois fois.
    expect((await lignesDuJournal()).map((ligne) => ligne.geste)).toEqual([
      "suppressionDeManche",
      "saisie",
      "saisie",
    ]);
  });

  it("n'écrit rien de plus au second appui : une seule suppression a eu lieu", async () => {
    await ouvrirLaMancheSuivante(base, partie.partieId);
    await supprimerLaManche(base, partie.partieId, { numero: 1, agissant: agissant() });

    await supprimerLaManche(base, partie.partieId, { numero: 1, agissant: agissant() });

    expect(await lignesDuJournal()).toHaveLength(1);
  });
});
