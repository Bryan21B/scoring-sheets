import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import type { Base } from "@/db/base";
import { CATALOGUE } from "@/lib/jeux/catalogue";
import { compterLesParties, type FicheDeJoueur, lireLaFicheDeJoueur } from "@/lib/palmares/fiche";
import { tauxDUnePartie } from "@/lib/palmares/taux";
import type { JoueurConnu } from "@/lib/roster/noms";
import { type BaseDeTest, creerBaseDeTest } from "../helpers/base-de-test";
import { inscrireLeRoster, jouerUnePartie, leJour } from "../helpers/soiree";

let baseDeTest: BaseDeTest;
let base: Base;
let marie: JoueurConnu;
let paul: JoueurConnu;
let lea: JoueurConnu;

/** La fiche de Marie, qui ne peut pas être absente dans ces tests. */
async function ficheDeMarie(): Promise<FicheDeJoueur> {
  const fiche = await lireLaFicheDeJoueur(base, marie.id);

  if (fiche === null) {
    throw new Error("Marie est au roster : sa fiche ne peut pas être absente.");
  }

  return fiche;
}

/** Le compteur d'une entrée du catalogue, par son identifiant. */
function compteurDe(fiche: FicheDeJoueur, jeuId: string) {
  return fiche.familles
    .flatMap((famille) => famille.compteurs)
    .find((compteur) => compteur.jeu.id === jeuId);
}

/** Le groupe de famille qui porte cette entrée. */
function familleDe(fiche: FicheDeJoueur, jeuId: string) {
  return fiche.familles.find((famille) =>
    famille.compteurs.some((compteur) => compteur.jeu.id === jeuId),
  );
}

beforeEach(async () => {
  baseDeTest = creerBaseDeTest();
  base = baseDeTest.base;

  const roster = await inscrireLeRoster(base, ["Marie", "Paul", "Léa"]);
  const [premiere, deuxieme, troisieme] = roster;

  if (premiere === undefined || deuxieme === undefined || troisieme === undefined) {
    throw new Error("Le roster de test n'a pas été inscrit en entier.");
  }

  marie = premiere;
  paul = deuxieme;
  lea = troisieme;
});

afterEach(() => {
  baseDeTest.fermer();
});

describe("les compteurs de la fiche de joueur", () => {
  it("porte un compteur par entrée du catalogue, même sans y avoir joué", async () => {
    const fiche = await ficheDeMarie();
    const portees = fiche.familles.flatMap((famille) =>
      famille.compteurs.map((compteur) => compteur.jeu.id),
    );

    // L'ensemble exact du catalogue, et pas seulement « chacune est là » : une
    // entrée oubliée disparaîtrait de la fiche sans que rien ne proteste.
    expect(portees).toEqual(Object.keys(CATALOGUE));
  });

  it("compte les parties jouées, les victoires et la dernière partie", async () => {
    // Deux soirées gagnées par Marie, une par Paul. 6 qui prend se gagne par le
    // bas, et la dernière est celle du 3 janvier.
    await jouerUnePartie(base, { joueurs: [marie, paul], manches: [[1, 9]], finLe: leJour(0) });
    await jouerUnePartie(base, { joueurs: [marie, paul], manches: [[2, 8]], finLe: leJour(1) });
    await jouerUnePartie(base, { joueurs: [marie, paul], manches: [[9, 1]], finLe: leJour(2) });

    const compteur = compteurDe(await ficheDeMarie(), "6-qui-prend");

    expect(compteur?.partiesJouees).toBe(3);
    expect(compteur?.victoires).toBe(2);
    expect(compteur?.dernierePartie).toEqual(leJour(2));
  });

  it("laisse un compteur à zéro, la dernière partie absente", async () => {
    const compteur = compteurDe(await ficheDeMarie(), "uno");

    expect(compteur?.partiesJouees).toBe(0);
    expect(compteur?.victoires).toBe(0);
    expect(compteur?.dernierePartie).toBeNull();
  });

  it("ne crédite pas de victoire une tête à égalité", async () => {
    // Le moteur sort son classement en groupes de rang, et un groupe de deux ne
    // se départage nulle part : la partie a eu lieu, personne ne l'a gagnée.
    await jouerUnePartie(base, { joueurs: [marie, paul], manches: [[4, 4]], finLe: leJour(0) });

    const compteur = compteurDe(await ficheDeMarie(), "6-qui-prend");

    expect(compteur?.partiesJouees).toBe(1);
    expect(compteur?.victoires).toBe(0);
  });

  it("ne compte une partie abandonnée ni en parties jouées ni en victoires", async () => {
    await jouerUnePartie(base, {
      joueurs: [marie, paul],
      manches: [[1, 9]],
      finLe: leJour(0),
      cause: "abandonnee",
    });

    const compteur = compteurDe(await ficheDeMarie(), "6-qui-prend");

    expect(compteur?.partiesJouees).toBe(0);
    expect(compteur?.victoires).toBe(0);
    expect(compteur?.dernierePartie).toBeNull();
  });

  it("ne compte pas une partie que le joueur a quittée", async () => {
    // Léa avait le meilleur score — 0 tête de bœuf — avant de quitter la table.
    // Elle ne figure pas au classement final, donc la partie n'est pas la sienne.
    await jouerUnePartie(base, {
      joueurs: [marie, paul, lea],
      manches: [[9, 1, 0]],
      finLe: leJour(0),
      retires: [lea],
    });

    const fiche = await lireLaFicheDeJoueur(base, lea.id);

    expect(compteurDe(fiche as FicheDeJoueur, "6-qui-prend")?.partiesJouees).toBe(0);
    expect(compteurDe(await ficheDeMarie(), "6-qui-prend")?.partiesJouees).toBe(1);
  });

  it("compte pour Dnup, qui ne distribue que des jetons", async () => {
    // Aucun score saisi : la manche désigne un premier et un deuxième sortis, et
    // c'est le barème qui dit ce que le rang rapporte. Le compteur n'en a pas
    // besoin — il ne compte que des parties et des victoires.
    await jouerUnePartie(base, {
      joueurs: [marie, paul, lea],
      manches: [[1, 2, null]],
      jeuId: "dnup",
      finLe: leJour(0),
    });

    const compteur = compteurDe(await ficheDeMarie(), "dnup");

    expect(compteur?.partiesJouees).toBe(1);
    expect(compteur?.victoires).toBe(1);
  });

  it("ne rend aucune fiche pour un joueur que le roster ne porte pas", async () => {
    expect(await lireLaFicheDeJoueur(base, 9999)).toBeNull();
  });
});

/**
 * Trois soirées du jeu de base gagnées par Marie, une de la variante gagnée par
 * Paul — le décor de la famille, et la seule chose que fusionner cacherait.
 *
 * La variante ne joue **qu'une manche** alors qu'elle s'arrête à deux : une
 * deuxième ferait franchir la condition de fin à la clôture, qui estampille
 * alors la partie à l'horloge du serveur, et la date de fin ne se testerait plus.
 */
async function troisDeBaseEtUneVariante(): Promise<void> {
  for (const numero of [0, 1, 2]) {
    await jouerUnePartie(base, {
      joueurs: [marie, paul],
      manches: [[1, 9]],
      finLe: leJour(numero),
    });
  }

  await jouerUnePartie(base, {
    joueurs: [marie, paul],
    manches: [[9, 1]],
    jeuId: "6-qui-prend-cartes-speciales",
    finLe: leJour(3),
  });
}

describe("la famille de la fiche de joueur", () => {
  it("groupe les deux 6 qui prend sans les fusionner", async () => {
    // Trois parties du jeu de base, une de la variante. Un compteur fusionné
    // dirait « 4 parties » et cacherait exactement ce qu'on vient lire.
    await troisDeBaseEtUneVariante();

    const fiche = await ficheDeMarie();
    const famille = familleDe(fiche, "6-qui-prend");

    expect(famille?.compteurs.map((un) => un.jeu.id)).toEqual([
      "6-qui-prend",
      "6-qui-prend-cartes-speciales",
    ]);
    expect(compteurDe(fiche, "6-qui-prend")?.partiesJouees).toBe(3);
    expect(compteurDe(fiche, "6-qui-prend-cartes-speciales")?.partiesJouees).toBe(1);
  });

  it("sous-totalise la famille sans toucher aux compteurs", async () => {
    await troisDeBaseEtUneVariante();

    const famille = familleDe(await ficheDeMarie(), "6-qui-prend");

    // « J'ai gagné trois parties de 6 qui prend » : la phrase qu'un joueur dirait
    // vraiment, et qu'aucun des deux compteurs ne porte à lui seul.
    expect(famille?.sousTotal.partiesJouees).toBe(4);
    expect(famille?.sousTotal.victoires).toBe(3);
    expect(famille?.sousTotal.dernierePartie).toEqual(leJour(3));
  });

  it("sous-totalise aussi une famille d'une seule entrée, dans la donnée", async () => {
    // Le sous-total est porté par **toutes** les familles : c'est un fait, et le
    // calculer partout est ce qui laisse l'écran décider seul de le montrer ou
    // non — il ne l'affiche pas sur une famille d'une entrée, où il répéterait
    // la ligne mot pour mot. La donnée ne connaît pas cette mise en page.
    await jouerUnePartie(base, {
      joueurs: [marie, paul, lea],
      manches: [[1, 2, null]],
      jeuId: "dnup",
      finLe: leJour(0),
    });

    const famille = familleDe(await ficheDeMarie(), "dnup");

    expect(famille?.compteurs).toHaveLength(1);
    expect(famille?.sousTotal).toEqual({
      partiesJouees: 1,
      victoires: 1,
      dernierePartie: leJour(0),
    });
  });

  it("range chaque entrée sous la famille que le catalogue lui déclare", async () => {
    const fiche = await ficheDeMarie();

    expect(fiche.familles.map((famille) => famille.compteurs.map((un) => un.jeu.id))).toEqual([
      ["6-qui-prend", "6-qui-prend-cartes-speciales"],
      ["uno"],
      ["dnup"],
    ]);
  });

  it("nomme la famille d'après son entrée de base, celle dont la variante est tirée", async () => {
    const fiche = await ficheDeMarie();

    expect(fiche.familles.map((famille) => famille.nom)).toEqual(["6 qui prend", "Uno", "Dnup"]);
  });
});

describe("le compteur et le taux, là où ils ne comptent pas pareil", () => {
  it("crédite une victoire là où le taux n'a personne à mesurer", async () => {
    // Une partie que tout le monde a quittée sauf un : son classement ne retient
    // qu'un joueur. C'est un fait qu'il l'a finie en tête — le compteur le dit —
    // et le taux n'a rien à en tirer, une proportion d'adversaires battus
    // n'existant pas sans adversaire. L'écart est voulu, et ce test est ce qui
    // l'empêche de devenir un accident.
    const classement = [[marie.id]];
    const [compteur] = compterLesParties(marie.id, [
      { partieId: 1, jeuId: "6-qui-prend", finLe: leJour(0), classement },
    ]);

    expect(compteur?.partiesJouees).toBe(1);
    expect(compteur?.victoires).toBe(1);
    expect(tauxDUnePartie(classement, marie.id)).toBeNull();
  });
});
