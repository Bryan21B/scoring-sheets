import type { GestesDuTiroir } from "@/components/tiroir-journal";

/**
 * Le tiroir qui ne range rien : ce que `sortiesDePartie` rend au spectateur,
 * et sur une partie terminée.
 *
 * Ici plutôt que recopié dans chaque écran qui rend un tiroir — trois copies
 * sous deux noms, c'est le nom qui finit par diverger, et un test qui cherche
 * l'absence d'un bouton dans le balisage de l'autre fixture ne le dirait pas.
 */
export const AUCUNE_SORTIE: GestesDuTiroir = {
  abandonner: undefined,
  reprendre: undefined,
  supprimer: undefined,
};
