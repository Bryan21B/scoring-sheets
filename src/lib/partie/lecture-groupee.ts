import { and, asc, eq, inArray, isNull } from "drizzle-orm";
import type { Lecture } from "@/db/base";
import { joueur, manche, participant, saisie } from "@/db/schema";
import type { LigneDeGrille } from "@/lib/manche/lecture";
import type { JoueurConnu } from "@/lib/roster/noms";

/**
 * Lire **plusieurs parties d'un coup**, en un nombre de requêtes qui ne dépend
 * pas de leur nombre.
 *
 * `manche/lecture.ts` lit une partie à la fois, ce qui est exactement ce qu'il
 * faut pour l'écran d'une partie. L'historique en lit vingt et le palmarès les
 * lit toutes : appeler la lecture unitaire en boucle ferait grimper les requêtes
 * avec la liste, et c'est le seul défaut qui rend ces deux pages inutilisables
 * une fois la base garnie.
 *
 * Les deux agrégats passent donc par ici — trois lectures groupées, tablées,
 * manches et valeurs — puis reconstruisent les mêmes {@link LigneDeGrille} que
 * la lecture unitaire produit, pour finir sur le **même** `etatDesLignes`. Ce
 * qu'ils ne partagent pas est leur politique : l'historique ne totalise pas une
 * partie abandonnée, le palmarès ne lit qu'une partie terminée, et c'est chez
 * eux que ça se décide.
 */

/**
 * Range des lignes plates sous la clé qui les groupe, **dans l'ordre reçu**.
 *
 * L'ordre est le contrat, et pas un effet de bord : les tablées sortent dans
 * l'ordre de la tablée — celui que les colonnes d'une grille suivent — et les
 * manches dans l'ordre des numéros. Un regroupement qui rebattrait les lignes
 * ferait des colonnes qui changent de place d'une lecture à l'autre.
 *
 * Une seule requête à plat puis ce regroupement, plutôt qu'un `GROUP BY` ou une
 * requête par partie : c'est ce qui tient le nombre de requêtes constant quand
 * le nombre de parties grandit.
 */
export function grouper<Ligne, Valeur>(
  lignes: readonly Ligne[],
  cle: (ligne: Ligne) => number,
  valeur: (ligne: Ligne) => Valeur,
): Map<number, Valeur[]> {
  const groupes = new Map<number, Valeur[]>();

  for (const ligne of lignes) {
    const groupe = groupes.get(cle(ligne)) ?? [];

    groupe.push(valeur(ligne));
    groupes.set(cle(ligne), groupe);
  }

  return groupes;
}

/**
 * Les participants **encore** de chacune de ces parties, en une requête.
 *
 * Groupés dans l'ordre de la tablée, comme `lirePartieParCode` les rend, parce
 * que c'est cet ordre-là que les colonnes d'une grille suivent. Un participant
 * retiré n'y est pas : il ne compte ni dans l'effectif affiché, ni au
 * classement, ni dans le vecteur de rangs du palmarès — et ses valeurs déjà
 * saisies restent en base intactes.
 */
export async function lireLesTablees(
  base: Lecture,
  partieIds: readonly number[],
): Promise<Map<number, JoueurConnu[]>> {
  if (partieIds.length === 0) {
    return new Map();
  }

  const lignes = await base
    .select({ partieId: participant.partieId, id: joueur.id, nom: joueur.nom })
    .from(participant)
    .innerJoin(joueur, eq(joueur.id, participant.joueurId))
    .where(and(inArray(participant.partieId, partieIds), isNull(participant.retireLe)))
    .orderBy(asc(participant.id));

  return grouper(
    lignes,
    (ligne) => ligne.partieId,
    ({ id, nom }) => ({ id, nom }),
  );
}

/** Une manche lue en groupe, avec la partie dont elle relève. */
export type MancheGroupee = { id: number; partieId: number; numero: number; close: boolean };

/**
 * Toutes les manches de ces parties, en une requête.
 *
 * Le tri est global et non par partie : `numero` croissant à l'intérieur d'un
 * même `partie_id` est tout ce dont le regroupement a besoin, et un `ORDER BY`
 * par partie n'existe pas en SQL.
 */
export async function lireLesManches(
  base: Lecture,
  partieIds: readonly number[],
): Promise<MancheGroupee[]> {
  if (partieIds.length === 0) {
    return [];
  }

  const lignes = await base
    .select({
      id: manche.id,
      partieId: manche.partieId,
      numero: manche.numero,
      closeLe: manche.closeLe,
    })
    .from(manche)
    .where(inArray(manche.partieId, partieIds))
    .orderBy(asc(manche.partieId), asc(manche.numero));

  return lignes.map((ligne) => ({
    id: ligne.id,
    partieId: ligne.partieId,
    numero: ligne.numero,
    close: ligne.closeLe !== null,
  }));
}

/**
 * Les valeurs saisies de toutes ces manches, indexées par manche puis par joueur.
 *
 * Une seule requête pour la page entière : c'est le contraire d'une lecture par
 * partie, et c'est ce qui empêche ces agrégats de coûter en requêtes ce qu'ils
 * coûtent en lignes.
 */
export async function lireLesValeurs(
  base: Lecture,
  mancheIds: readonly number[],
): Promise<Map<number, Map<number, number | null>>> {
  const valeurs = new Map<number, Map<number, number | null>>();

  if (mancheIds.length === 0) {
    return valeurs;
  }

  const lignes = await base
    .select({ mancheId: saisie.mancheId, joueurId: saisie.joueurId, valeur: saisie.valeur })
    .from(saisie)
    .where(inArray(saisie.mancheId, mancheIds));

  for (const ligne of lignes) {
    const parJoueur = valeurs.get(ligne.mancheId) ?? new Map<number, number | null>();

    parJoueur.set(ligne.joueurId, ligne.valeur);
    valeurs.set(ligne.mancheId, parJoueur);
  }

  return valeurs;
}

/**
 * Les lignes de grille d'une partie, reconstruites depuis la lecture groupée.
 *
 * Une case par participant, la vide comprise, exactement comme la jointure
 * gauche de `lireLesCases` les rend une partie à la fois — et, comme elle,
 * chacune dit si elle a été **touchée**. Ce n'est pas un détail de forme : à
 * Uno, une case absente et une case touchée mais vide portent toutes deux
 * `null`, et les confondre rendrait toute manche d'Uno incomplète, donc toute
 * partie d'Uno sans vainqueur et sans classement.
 */
export function lignesDeGrille(
  manches: readonly MancheGroupee[],
  tablee: readonly JoueurConnu[],
  valeurs: ReadonlyMap<number, ReadonlyMap<number, number | null>>,
): LigneDeGrille[] {
  return manches.map((une) => ({
    numero: une.numero,
    close: une.close,
    cases: tablee.map((joueur) => ({
      joueur,
      valeur: valeurs.get(une.id)?.get(joueur.id) ?? null,
      touchee: valeurs.get(une.id)?.has(joueur.id) ?? false,
    })),
  }));
}
