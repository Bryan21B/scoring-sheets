import { eq } from "drizzle-orm";
import type { Lecture } from "@/db/base";
import { joueur } from "@/db/schema";
import { CATALOGUE, type EntreeCatalogue } from "@/lib/jeux/catalogue";
import type { JoueurId } from "@/lib/jeux/moteur";
import { vainqueurDuClassement } from "@/lib/jeux/vainqueur";
import { lireLesPartiesDUnJoueur, type PartieClassee } from "@/lib/palmares/lecture";
import type { JoueurConnu } from "@/lib/roster/noms";

/**
 * La fiche de joueur : **des compteurs, jamais une estimation**.
 *
 * La coupe par joueur *est* la fiche. Les compteurs sont par couple joueur et
 * entrée du catalogue : à dix joueurs et quatre entrées, c'est une grille de
 * quarante cases, illisible sur un téléphone, et elle se coupe naturellement par
 * joueur.
 *
 * Un compteur ne souffre pas du découpage qui interdit une note par jeu — trois
 * parties donnent honnêtement « 3 parties, 1 victoire » — parce qu'il ne compte
 * que des parties et des victoires, et pas des points. C'est aussi ce qui le
 * rend défini pour une entrée **sans score du tout** : Dnup ne distribue que des
 * jetons, et à deux joueurs pas même ça.
 */

/** Ce qu'un compteur porte : un fait, trois fois. */
export type Compteur = {
  jeu: EntreeCatalogue;
  partiesJouees: number;
  victoires: number;
  /** La date de fin de la plus récente, ou `null` — cette entrée n'a jamais été jouée. */
  dernierePartie: Date | null;
};

/** Ce qu'une famille additionne : tout sauf l'entrée elle-même. */
export type SousTotal = Omit<Compteur, "jeu">;

/**
 * Les entrées d'une même famille, **groupées et non fusionnées**.
 *
 * C'est ici que la `famille` déclarée au catalogue gagne sa raison d'être. Elle
 * **groupe, elle ne somme pas** : fusionner les deux *6 qui prend* en un seul
 * compteur cacherait que sur douze parties, neuf étaient le jeu de base et trois
 * la variante — exactement le fait qu'on vient lire. Les séparer garde le fait ;
 * le sous-total garde la phrase qu'un joueur dirait vraiment, « j'ai gagné cinq
 * parties de 6 qui prend ».
 *
 * `nom` est celui de la **première entrée du catalogue** dans la famille, c'est-
 * à-dire du jeu de base — la variante est déclarée par spread de celui-ci, donc
 * c'est lui qui donne son nom à l'ensemble. Aucun libellé de famille n'est
 * déclaré à côté : ce serait une chaîne de plus à tenir d'accord avec les noms
 * qu'elle chapeaute.
 */
export type GroupeDeFamille = {
  /** L'identifiant déclaré au catalogue, jamais montré. */
  famille: string;
  nom: string;
  compteurs: readonly Compteur[];
  sousTotal: SousTotal;
};

/** La fiche telle qu'un écran la reçoit. */
export type FicheDeJoueur = {
  joueur: JoueurConnu;
  familles: readonly GroupeDeFamille[];
};

/** Le compteur vide d'une entrée : ce que porte qui n'y a jamais joué. */
function compteurVide(jeu: EntreeCatalogue): Compteur {
  return { jeu, partiesJouees: 0, victoires: 0, dernierePartie: null };
}

/**
 * Additionne une partie dans le compteur de son entrée.
 *
 * **Une partie compte pour un joueur exactement quand il figure à son
 * classement final.** Une seule règle, appliquée une seule fois : elle sort les
 * parties abandonnées — qui ne sont jamais lues — et les parties qu'il a
 * quittées, dont la tablée relue ne le porte plus. Compter une partie qu'on a
 * quittée en partie jouée sans jamais pouvoir la compter en victoire creuserait
 * le compteur d'un montant qui dépend du moment où l'on est parti.
 *
 * `dernierePartie` prend le maximum plutôt que la dernière lue : la requête des
 * parties d'un joueur n'a **aucun `ORDER BY`** — l'ordre du palmarès est celui
 * des taux, pas celui d'une colonne — donc s'appuyer sur l'ordre d'arrivée
 * donnerait une date juste par hasard.
 */
function ajouter(compteur: Compteur, partie: PartieClassee, joueurId: JoueurId): Compteur {
  return {
    jeu: compteur.jeu,
    partiesJouees: compteur.partiesJouees + 1,
    victoires: compteur.victoires + (vainqueurDuClassement(partie.classement) === joueurId ? 1 : 0),
    dernierePartie:
      compteur.dernierePartie === null || compteur.dernierePartie < partie.finLe
        ? partie.finLe
        : compteur.dernierePartie,
  };
}

/**
 * Un compteur par entrée du catalogue, **dans l'ordre du catalogue**.
 *
 * Toutes les entrées, y compris celles auxquelles le joueur n'a jamais touché :
 * un compteur à zéro se lit, il ne se déduit pas d'une absence, et une entrée
 * qui disparaîtrait de la fiche faute de partie jouée rendrait la liste
 * différente d'un joueur à l'autre — donc illisible d'un coup d'œil.
 *
 * Pure, et c'est ce qui la rend vérifiable sur des classements écrits à la main.
 */
export function compterLesParties(
  joueurId: JoueurId,
  parties: readonly PartieClassee[],
): Compteur[] {
  const compteurs = new Map<string, Compteur>(
    Object.values(CATALOGUE).map((jeu) => [jeu.id, compteurVide(jeu)]),
  );

  for (const partie of parties) {
    const compteur = compteurs.get(partie.jeuId);

    if (compteur === undefined || tauxAbsent(partie, joueurId)) {
      continue;
    }

    compteurs.set(partie.jeuId, ajouter(compteur, partie, joueurId));
  }

  return [...compteurs.values()];
}

/** Ce joueur est-il absent du classement de cette partie ? */
function tauxAbsent(partie: PartieClassee, joueurId: JoueurId): boolean {
  return !partie.classement.some((groupe) => groupe.includes(joueurId));
}

/**
 * Range les compteurs sous leur famille, l'ordre du catalogue préservé.
 *
 * Pure, et séparée du comptage : ce qui groupe est une propriété déclarée au
 * catalogue, ce qui compte est une lecture de parties, et les deux n'ont aucune
 * raison de bouger ensemble.
 */
export function grouperParFamille(compteurs: readonly Compteur[]): GroupeDeFamille[] {
  const familles = new Map<string, Compteur[]>();

  for (const compteur of compteurs) {
    const groupe = familles.get(compteur.jeu.famille) ?? [];

    groupe.push(compteur);
    familles.set(compteur.jeu.famille, groupe);
  }

  return [...familles.entries()].map(([famille, groupe]) => ({
    famille,
    nom: groupe[0]?.jeu.nom ?? famille,
    compteurs: groupe,
    sousTotal: sousTotaliser(groupe),
  }));
}

/** Ce que la famille additionne : les parties, les victoires, la plus récente. */
function sousTotaliser(compteurs: readonly Compteur[]): SousTotal {
  return compteurs.reduce<SousTotal>(
    (total, un) => ({
      partiesJouees: total.partiesJouees + un.partiesJouees,
      victoires: total.victoires + un.victoires,
      dernierePartie: plusRecente(total.dernierePartie, un.dernierePartie),
    }),
    { partiesJouees: 0, victoires: 0, dernierePartie: null },
  );
}

/** La plus récente de deux dates, l'absence comptant pour rien. */
function plusRecente(une: Date | null, autre: Date | null): Date | null {
  if (une === null) {
    return autre;
  }

  return autre === null || autre < une ? une : autre;
}

/**
 * La fiche d'un joueur, ou `null` si le roster ne le porte pas.
 *
 * `null` plutôt qu'une fiche vide : une adresse se bricole, et `/j/9999` doit
 * rendre un 404 plutôt qu'une page de compteurs à zéro qui laisserait croire à
 * un joueur inscrit mais inactif.
 *
 * Cinq requêtes : le joueur, ses parties terminées — par l'index
 * `participant_joueur_id_idx`, déclaré au schéma pour exactement cet usage — et
 * les trois lectures groupées qui rapportent leurs tablées, leurs manches et
 * leurs valeurs.
 */
export async function lireLaFicheDeJoueur(
  base: Lecture,
  joueurId: number,
): Promise<FicheDeJoueur | null> {
  const [ligne] = await base
    .select({ id: joueur.id, nom: joueur.nom })
    .from(joueur)
    .where(eq(joueur.id, joueurId))
    .limit(1);

  if (ligne === undefined) {
    return null;
  }

  const parties = await lireLesPartiesDUnJoueur(base, joueurId);

  return {
    joueur: ligne,
    familles: grouperParFamille(compterLesParties(joueurId, parties)),
  };
}
