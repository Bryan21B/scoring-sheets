import type { ComponentProps } from "react";

/**
 * Ce que plusieurs écrans partagent, écrit une seule fois.
 *
 * Les classes vivent ici parce qu'elles sont **la même chose**, pas parce
 * qu'elles se ressemblent : la liste pleine largeur est le motif de l'app —
 * catalogue, roster, tablée — et un champ de nom se saisit pareil qu'on ouvre
 * une partie ou qu'on la rejoigne. Trois copies divergent le jour où l'une est
 * corrigée seule, et l'écart ne se voit qu'à l'écran.
 */

/**
 * Une action de formulaire, telle qu'une page câble la sienne.
 *
 * Le type est ici plutôt que recopié dans chaque composant qui écrit : tous les
 * gestes de l'app passent par un `form`, et une action serveur liée ou une
 * adresse en `GET` sont les deux seules formes qu'ils prennent.
 */
export type Action = ComponentProps<"form">["action"];

/** Le champ texte d'un nom de joueur. */
export const CHAMP_NOM =
  "h-10 w-full rounded-lg border border-border bg-background px-3 text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

/**
 * La liste pleine largeur : elle déborde des marges de la page pour que ses
 * séparateurs aillent d'un bord à l'autre, comme une liste d'application native.
 */
export const LISTE = "-mx-4 flex w-auto flex-col divide-y divide-border border-border border-y";
