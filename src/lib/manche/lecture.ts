import { and, asc, eq, isNull } from "drizzle-orm";
import type { Base } from "@/db/base";
import { joueur, manche, participant, saisie } from "@/db/schema";
import type { Etat, JoueurId, Manche } from "@/lib/jeux/moteur";
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
async function lireLesCases(base: Base, partieId: number, mancheId: number) {
  return base
    .select({ id: joueur.id, nom: joueur.nom, valeur: saisie.valeur })
    .from(participant)
    .innerJoin(joueur, eq(joueur.id, participant.joueurId))
    .leftJoin(saisie, and(eq(saisie.mancheId, mancheId), eq(saisie.joueurId, participant.joueurId)))
    .where(and(eq(participant.partieId, partieId), isNull(participant.retireLe)))
    .orderBy(asc(participant.id));
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
  base: Base,
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

  const cases = await lireLesCases(base, partieId, ligne.id);

  return {
    id: ligne.id,
    numero,
    cases: cases.map(({ id, nom, valeur }) => ({ joueur: { id, nom }, valeur })),
  };
}

/**
 * L'état de la partie, **calculé par le moteur** et jamais ici.
 *
 * Ce module traduit des lignes en manches et s'arrête là : rien de ce que le
 * moteur calcule n'est stocké, et un total additionné en SQL serait un second
 * décompte à garder d'accord avec le premier.
 *
 * L'effectif courant est recopié sur toutes les manches, ce que le moteur
 * autorise explicitement — il en lit l'**intersection**, si bien que l'effectif
 * historique et l'effectif courant recopié donnent le même résultat.
 */
export async function evaluerLaPartie(base: Base, partieId: number, regles: Regles): Promise<Etat> {
  const participants: JoueurId[] = (
    await base
      .select({ joueurId: participant.joueurId })
      .from(participant)
      .where(and(eq(participant.partieId, partieId), isNull(participant.retireLe)))
      .orderBy(asc(participant.id))
  ).map((ligne) => ligne.joueurId);

  const lignes = await base
    .select({ id: manche.id, closeLe: manche.closeLe })
    .from(manche)
    .where(eq(manche.partieId, partieId))
    .orderBy(asc(manche.numero));

  const manches: Manche[] = [];

  for (const ligne of lignes) {
    const cases = await lireLesCases(base, partieId, ligne.id);

    manches.push({
      close: ligne.closeLe !== null,
      participants,
      cases: cases.map(({ id, valeur }) => ({ joueurId: id, valeur })),
    });
  }

  return evaluer(regles, manches);
}
