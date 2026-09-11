import { and, asc, eq, isNull } from "drizzle-orm";
import type { Lecture } from "@/db/base";
import { joueur, manche, participant, saisie } from "@/db/schema";
import type { Etat, Manche } from "@/lib/jeux/moteur";
import { evaluer } from "@/lib/jeux/moteur";
import type { Regles } from "@/lib/jeux/regles";
import type { ValeurDeCase } from "@/lib/manche/saisie";
import type { JoueurConnu } from "@/lib/roster/noms";

/**
 * Une case telle qu'un écran la reçoit : **le joueur qu'elle concerne**, et ce
 * qu'elle porte.
 *
 * Le joueur, et non son seul identifiant : une case vide se nomme par la
 * personne dont on attend la valeur, sans quoi le récapitulatif ne pourrait pas
 * dire qui manque. Et jamais l'auteur — aucune case n'en a d'attendu.
 */
export type CaseDeManche = {
  joueur: JoueurConnu;
  valeur: ValeurDeCase;
  /**
   * La case existe-t-elle, c'est-à-dire quelqu'un l'a-t-il **touchée** ?
   *
   * Vraie dès qu'une ligne de `saisie` existe, la vide comprise. C'est le seul
   * champ qui distingue « Paul est désigné, son total reste à taper » de « Paul
   * n'est pas désigné » : les deux portent `valeur` à `null`, et les confondre
   * rendrait toute manche d'Uno incomplète pour toujours.
   */
  touchee: boolean;
};

/**
 * Une manche telle que la passe avant et le récapitulatif la montrent.
 *
 * Elle porte **une case par participant**, la vide comprise : c'est ce qui
 * laisse la passe avant démarrer sur la première case manquante et le
 * récapitulatif nommer ce qui reste à taper. La complétude ne se lit pas ici,
 * elle se dérive du mode par le moteur.
 */
export type VueDeManche = {
  id: number;
  numero: number;
  cases: readonly CaseDeManche[];
};

/**
 * Les cases d'une manche : un par participant encore de la partie, dans
 * l'ordre de la tablée.
 *
 * Une jointure gauche depuis `participant`, et non depuis `saisie` : une case
 * n'existe en base qu'à partir du moment où elle est **touchée**, et lire les
 * saisies ne montrerait que ce qui a déjà été tapé — exactement l'inverse de ce
 * qu'on vient chercher. Un participant retiré sort de la liste, ses valeurs
 * déjà saisies restant en base intactes.
 */
async function lireLesCases(
  base: Lecture,
  partieId: number,
  mancheId: number,
): Promise<CaseDeManche[]> {
  const lignes = await base
    .select({ id: joueur.id, nom: joueur.nom, valeur: saisie.valeur, caseId: saisie.id })
    .from(participant)
    .innerJoin(joueur, eq(joueur.id, participant.joueurId))
    .leftJoin(saisie, and(eq(saisie.mancheId, mancheId), eq(saisie.joueurId, participant.joueurId)))
    .where(and(eq(participant.partieId, partieId), isNull(participant.retireLe)))
    .orderBy(asc(participant.id));

  // L'identifiant de la ligne de saisie ne sort que pour être jeté : il dit
  // que la case existe, ce que `valeur` ne peut pas dire puisqu'une case
  // touchée mais vide porte `NULL` comme une case absente.
  return lignes.map(({ id, nom, valeur, caseId }) => ({
    joueur: { id, nom },
    valeur,
    touchee: caseId !== null,
  }));
}

/**
 * Les mêmes cases, relues comme **le moteur** les lit.
 *
 * `participants` sort des cases elles-mêmes, et ce n'est pas un raccourci :
 * {@link lireLesCases} en produit exactement une par participant encore de la
 * partie, la vide comprise, si bien que les deux listes sont la même. La
 * recopier depuis une seconde requête laisserait deux lectures de l'effectif
 * diverger, ce que le moteur ne pourrait pas rattraper.
 *
 * Les **cases**, elles, ne sont que celles qui existent. Le moteur lit `null`
 * comme « touchée mais vide » — l'état qu'Uno traverse entre la désignation et
 * le total — et lui donner une case par participant lui ferait voir quatre
 * perdants en attente de total là où il n'y en a aucun : la manche ne serait
 * jamais complète, et Uno ne pourrait pas se clore. Le filtre est sans effet
 * aux deux autres modes, qui ne lisent que les cases portant un nombre.
 *
 * `close` reste un paramètre : la clôture est **déclarée** et ne se lit pas dans
 * les cases, ce que confondre les deux effacerait.
 */
export function mancheDuMoteur(cases: readonly CaseDeManche[], close: boolean): Manche {
  return {
    close,
    participants: cases.map(({ joueur }) => joueur.id),
    cases: cases
      .filter(({ touchee }) => touchee)
      .map(({ joueur, valeur }) => ({ joueurId: joueur.id, valeur })),
  };
}

/**
 * Relit une manche et toutes ses cases, par la clé qui la désigne vraiment.
 *
 * `(partie, numéro)` et non l'identifiant : c'est le couple que l'unicité tient,
 * celui que le journal garde et celui que l'adresse porte. L'identifiant de
 * manche n'est ordonné par rien et désigné par personne ; le faire voyager
 * jusqu'à l'écran ne servirait qu'à le voir se réattribuer après une suppression.
 *
 * Rend `null` plutôt que de lever quand la manche n'existe pas : une manche
 * supprimée pendant qu'on avait son adresse ouverte est un cas réel, et la page
 * n'a rien de mieux à faire qu'un 404.
 */
export async function lireLaManche(
  base: Lecture,
  partieId: number,
  numero: number,
): Promise<VueDeManche | null> {
  const [ligne] = await base
    .select({ id: manche.id })
    .from(manche)
    .where(and(eq(manche.partieId, partieId), eq(manche.numero, numero)))
    .limit(1);

  if (ligne === undefined) {
    return null;
  }

  return { id: ligne.id, numero, cases: await lireLesCases(base, partieId, ligne.id) };
}

/**
 * Une ligne de la grille : une manche, et ce que chaque joueur y a marqué.
 *
 * Elle porte **une case par participant**, la vide comprise, comme
 * {@link VueDeManche} — c'est ce qui laisse la grille montrer un trou plutôt
 * qu'un zéro, et un zéro est une manche réussie à 6 qui prend.
 *
 * `close` est la clôture **déclarée** relue de la base, jamais la complétude
 * dérivée : la grille l'affiche, elle ne la calcule pas.
 */
export type LigneDeGrille = {
  numero: number;
  close: boolean;
  cases: readonly CaseDeManche[];
};

/**
 * La feuille de score entière : les manches en lignes, et l'état du moteur.
 *
 * Les deux voyagent ensemble parce qu'ils sortent de **la même lecture** : les
 * séparer ferait relire les mêmes manches deux fois pour un écran qui montre
 * les valeurs et les totaux côte à côte, avec le risque qu'une écriture se
 * glisse entre les deux et qu'un total ne corresponde pas aux cases affichées.
 *
 * Les colonnes ne sont pas ici : les joueurs viennent de la {@link VueDePartie}
 * que l'écran tient déjà, et les recopier ferait deux listes de participants à
 * garder d'accord.
 */
export type VueDeGrille = {
  manches: readonly LigneDeGrille[];
  etat: Etat;
};

/**
 * Ce que le moteur tire d'une feuille **déjà lue**.
 *
 * La traduction des lignes de grille vers les manches du moteur vit ici et
 * nulle part ailleurs. {@link lireLaGrille} lit une partie à la fois ; l'historique
 * en lit vingt d'un coup, en quelques requêtes groupées, et ne peut donc pas
 * passer par elle — mais il finit au même endroit, sur cette fonction-ci. Deux
 * traductions des mêmes lignes divergeraient le jour où l'une est corrigée
 * seule, et un vainqueur d'historique ne correspondrait plus aux totaux de la
 * fiche qu'on ouvre en tapant dessus.
 */
export function etatDesLignes(regles: Regles, lignes: readonly LigneDeGrille[]): Etat {
  return evaluer(
    regles,
    lignes.map((ligne) => mancheDuMoteur(ligne.cases, ligne.close)),
  );
}

/**
 * La feuille de score d'une partie : ses manches, et ce que le moteur en tire.
 *
 * Ce module traduit des lignes en manches et s'arrête là : rien de ce que le
 * moteur calcule n'est stocké, et un total additionné en SQL serait un second
 * décompte à garder d'accord avec le premier.
 *
 * Une **seule lecture** pour les valeurs et pour les totaux : les séparer
 * relirait les mêmes manches deux fois pour un écran qui montre les deux côte à
 * côte, avec le risque qu'une écriture se glisse entre et qu'un total ne
 * corresponde pas aux cases affichées.
 *
 * L'effectif sort des cases elles-mêmes, par {@link mancheDuMoteur}, et non
 * d'une seconde requête.
 *
 * Prend une {@link Lecture} : la clôture d'une manche appelle l'évaluation
 * **dans sa propre transaction**, pour calculer `fini` sur une manche qu'elle
 * vient de fermer et que personne d'autre ne voit encore.
 */
export async function lireLaGrille(
  base: Lecture,
  partieId: number,
  regles: Regles,
): Promise<VueDeGrille> {
  const lignes = await base
    .select({ id: manche.id, numero: manche.numero, closeLe: manche.closeLe })
    .from(manche)
    .where(eq(manche.partieId, partieId))
    .orderBy(asc(manche.numero));

  const grille: LigneDeGrille[] = [];

  for (const ligne of lignes) {
    grille.push({
      numero: ligne.numero,
      close: ligne.closeLe !== null,
      cases: await lireLesCases(base, partieId, ligne.id),
    });
  }

  return { manches: grille, etat: etatDesLignes(regles, grille) };
}

/**
 * L'état de la partie seul, pour les écrans qui n'ont pas la grille à montrer.
 *
 * Passe par {@link lireLaGrille} plutôt que de relire les manches à sa façon :
 * deux traductions des mêmes lignes vers le moteur divergeraient le jour où
 * l'une est corrigée seule.
 */
export async function evaluerLaPartie(
  base: Lecture,
  partieId: number,
  regles: Regles,
): Promise<Etat> {
  return (await lireLaGrille(base, partieId, regles)).etat;
}
