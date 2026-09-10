import type { CaseDeManche } from "@/lib/manche/lecture";
import type { JoueurConnu } from "@/lib/roster/noms";

/**
 * La table de trois qui sert de décor aux écrans de manche.
 *
 * Trois joueurs et pas deux : il en faut un troisième pour qu'« une case déjà
 * remplie, une vide, une autre encore » se distingue d'un simple couple.
 */
export const MARIE: JoueurConnu = { id: 1, nom: "Marie" };
export const PAUL: JoueurConnu = { id: 2, nom: "Paul" };
export const LEA: JoueurConnu = { id: 3, nom: "Léa" };

/** Les trois, dans l'ordre de la tablée. */
export const TABLEE = [MARIE, PAUL, LEA] as const;

/**
 * Celle qui est au roster **sans être de la partie**.
 *
 * Elle vit ici plutôt que dans chaque écran qui en a besoin : deux Zoé
 * déclarées séparément prendraient deux identifiants, et un test finirait par
 * chercher la place de l'une dans le balisage de l'autre.
 */
export const ZOE: JoueurConnu = { id: 4, nom: "Zoé" };

/**
 * Les cases de la tablée, une par joueur, dans l'ordre.
 *
 * Les valeurs manquantes sont vides, ce qui laisse écrire `casesDeLaTablee(8)`
 * pour « Marie a saisi, les deux autres pas encore ».
 */
export function casesDeLaTablee(...valeurs: readonly (number | null)[]): CaseDeManche[] {
  return TABLEE.map((joueur, rang) => ({ joueur, valeur: valeurs[rang] ?? null }));
}
