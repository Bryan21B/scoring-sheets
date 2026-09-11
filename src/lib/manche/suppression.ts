import { and, asc, eq } from "drizzle-orm";
import { z } from "zod";
import type { Base, Ecriture } from "@/db/base";
import { manche, participant, saisie } from "@/db/schema";
import {
  agissantSchema,
  consignerUneSuppressionDeManche,
  type ValeurEffacee,
} from "@/lib/journal/ligne";
import { numeroDeMancheSchema } from "@/lib/manche/ouverture";

/**
 * Ce que la suppression demande : **quelle manche, par son numéro**, et qui agit.
 *
 * Le numéro et non l'identifiant, contrairement à la clôture ou à la saisie, et
 * ce n'est pas un détail de forme : `manche.id` n'a pas d'`AUTOINCREMENT`, si
 * bien que SQLite le **réattribue** après une suppression. Faire voyager
 * l'identifiant jusqu'au bouton qui supprime serait exactement le cas où on le
 * voit se réattribuer sous les doigts. `(partie, numéro)` est le couple que
 * l'unicité tient, celui que le journal garde et celui que l'adresse porte.
 *
 * Coercitif comme les autres frontières de formulaire, strict pour la même
 * raison : un champ inattendu est un formulaire qui a dérivé de son action.
 */
export const demandeDeSuppressionSchema = z.strictObject({
  numero: numeroDeMancheSchema,
  agissant: agissantSchema,
});

/** Une demande de suppression validée. */
export type DemandeDeSuppression = z.infer<typeof demandeDeSuppressionSchema>;

/**
 * Les deux issues d'une suppression, et il n'y en a pas de troisième.
 *
 * `dejaSupprimee` n'est pas un échec : celui qui appuie deux fois voulait une
 * manche disparue, et il en a une. C'est aussi ce que voit le second téléphone
 * quand le premier a supprimé pendant qu'il regardait le même écran — le trou
 * est là, il n'y a rien à lui annoncer.
 */
export type ResultatDeSuppression = { statut: "supprimee" | "dejaSupprimee" };

/**
 * Supprime une manche entière : on s'est trompé, on l'annule.
 *
 * **Un trou reste, les numéros ne se réutilisent jamais.** Supprimer la manche 2
 * sur cinq laisse 1, 3, 4, 5, et la manche suivante reste le plus grand numéro
 * plus un — voir {@link prochainNumeroDeManche}. Renuméroter réécrirait des
 * références que le journal a figées, et le trou est lui-même une information :
 * il s'est passé quelque chose.
 *
 * Les cases partent par la **cascade** que `saisie.manche_id` déclare. Les
 * totaux n'ont rien à faire de spécial : rien n'est stocké, tout se recalcule à
 * la lecture suivante.
 *
 * Le journal reçoit **une seule ligne**, qui emporte toutes les valeurs
 * effacées. Elle est lue **avant** l'effacement et écrite dans la **même
 * transaction** : après, il n'y aurait plus rien à lire, et hors transaction
 * une manche pourrait disparaître sans que sa ligne parte avec elle — ce que le
 * journal existe précisément pour empêcher.
 *
 * Les lignes antérieures de cette manche **restent** : le journal est
 * append-only, tenu par des déclencheurs, et une manche 1 supprimée puis
 * ressaisie s'y lit trois fois — saisie, supprimée, saisie.
 */
export async function supprimerLaManche(
  base: Base,
  partieId: number,
  brut: unknown,
): Promise<ResultatDeSuppression> {
  const demande = demandeDeSuppressionSchema.parse(brut);

  return base.transaction(async (tx) => {
    const valeurs = await lireLesValeurs(tx, partieId, demande.numero);

    if (!(await effacer(tx, partieId, demande.numero))) {
      return { statut: "dejaSupprimee" };
    }

    await consignerUneSuppressionDeManche(tx, {
      partieId,
      mancheNumero: demande.numero,
      valeurs,
      agissant: demande.agissant,
    });

    return { statut: "supprimee" };
  });
}

/**
 * Les cases que cette manche porte, dans l'ordre de la tablée.
 *
 * Seulement celles qui **existent** : une case que personne n'a touchée n'a
 * rien à effacer, et l'inscrire ferait dire au journal qu'on a perdu un vide
 * qui n'avait jamais été posé. La case touchée mais vide d'Uno, elle, y est —
 * sa ligne existe, et c'est elle qui portait la désignation.
 *
 * L'ordre est celui de `participant.id`, comme la grille : c'est ainsi que la
 * ligne se relira, et un ordre d'insertion des saisies ferait raconter la
 * manche dans l'ordre où les doigts sont passés plutôt que dans celui des
 * joueurs.
 */
async function lireLesValeurs(
  tx: Ecriture,
  partieId: number,
  numero: number,
): Promise<ValeurEffacee[]> {
  return tx
    .select({ joueurId: saisie.joueurId, valeur: saisie.valeur })
    .from(saisie)
    .innerJoin(manche, eq(manche.id, saisie.mancheId))
    .innerJoin(
      participant,
      and(eq(participant.partieId, partieId), eq(participant.joueurId, saisie.joueurId)),
    )
    .where(and(eq(manche.partieId, partieId), eq(manche.numero, numero)))
    .orderBy(asc(participant.id));
}

/**
 * L'effacement lui-même, dont la condition porte sur `(partie, numéro)`.
 *
 * Rend ce que la suppression a touché plutôt que de relire d'abord : zéro ligne
 * veut dire que quelqu'un est passé avant, et c'est la seule lecture de la
 * course qui ne puisse pas mentir. C'est elle qui garde le journal d'une
 * seconde ligne de suppression pour une manche qui n'a disparu qu'une fois.
 */
async function effacer(tx: Ecriture, partieId: number, numero: number): Promise<boolean> {
  const effacees = await tx
    .delete(manche)
    .where(and(eq(manche.partieId, partieId), eq(manche.numero, numero)))
    .returning({ id: manche.id });

  return effacees.length > 0;
}
