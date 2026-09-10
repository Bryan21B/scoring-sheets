import { enTapee, type Tapee } from "@/lib/manche/pave";
import type { ResultatDEcriture, ValeurDeCase } from "@/lib/manche/saisie";

/**
 * Ce qu'un refus laisse à l'écran, et rien de plus.
 *
 * **L'auteur n'y est pas.** « La case porte maintenant 8 » suffit à comprendre
 * et à décider ; nommer Léa demanderait au chemin d'écriture d'aller lire le
 * journal pour composer sa phrase, alors que le journal est une trace qu'on
 * consulte, jamais une pièce du flux. Il est à un appui de là pour qui veut
 * savoir qui. Voir `docs/specs/2026-09-09-ecriture-concurrente.md`.
 *
 * `valeurTapee` vient du **serveur** et non d'un état de client : c'est ce qui
 * laisse l'écran de refus se rendre sans que rien n'ait à survivre au
 * remplacement de la saisie par lui.
 */
export type RefusDEcriture = {
  /** Ce que la case porte maintenant — le vide compris, qui est une valeur. */
  valeurArrivee: ValeurDeCase;
  /** Ce qui venait d'être tapé, gardé sous la main pour un seul appui. */
  valeurTapee: number;
};

/**
 * L'action serveur d'une saisie, telle que `useActionState` la veut.
 *
 * Ici plutôt que dans le module d'action : une action serveur n'exporte que des
 * fonctions asynchrones, et l'écran qui la reçoit en prop a besoin de sa forme.
 */
export type ActionDEcriture = (
  precedent: RefusDEcriture | null,
  formulaire: FormData,
) => Promise<RefusDEcriture | null>;

/**
 * Le refus à montrer, ou `null` quand il n'y a rien à arrêter.
 *
 * Les deux issues qui passent ne montrent **aucun écran** : l'écrasement informé
 * obtient ce qu'il demandait, et l'écriture sans effet aussi. Annoncer un
 * conflit dont le résultat est celui qu'on voulait serait absurde.
 */
export function refusDe(resultat: ResultatDEcriture): RefusDEcriture | null {
  return resultat.statut === "refusee"
    ? { valeurArrivee: resultat.valeurArrivee, valeurTapee: resultat.valeurRefusee }
    : null;
}

/** Ce que le formulaire de réapplication repose, et sous quelle condition. */
export type Reapplication = {
  /** La **valeur arrivée** devient la nouvelle condition : on écrit en la voyant. */
  valeurMontree: Tapee;
  /** La valeur tapée, inchangée : c'est elle qu'on voulait poser. */
  valeur: Tapee;
};

/**
 * Repose la valeur tapée **par dessus celle qui est arrivée**.
 *
 * C'est ce qui fait du second appui un écrasement **informé** et non une
 * seconde tentative périmée : la case a été relue, elle est montrée, et écrire
 * par dessus est exactement ce que la politique laisse passer. Repartir de la
 * valeur d'origine ferait un refus de plus, indéfiniment.
 */
export function reappliquer(refus: RefusDEcriture): Reapplication {
  return { valeurMontree: enTapee(refus.valeurArrivee), valeur: enTapee(refus.valeurTapee) };
}
