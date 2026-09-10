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

/**
 * Une action serveur qui **rend un état à l'écran**, telle que `useActionState`
 * la veut : l'état précédent, le formulaire, le nouvel état.
 *
 * Générique et posée ici, à côté de {@link Action}, parce que c'est la même
 * chose vue de l'autre bout : un `form` dont le geste a quelque chose à
 * répondre. Les modules de domaine n'ont pas à porter une forme dictée par
 * React, et deux copies de cette signature — une par écran qui refuse quelque
 * chose — divergeraient le jour où l'une gagne un paramètre.
 */
export type ActionServeur<Etat> = (precedent: Etat, formulaire: FormData) => Promise<Etat>;

/** Le champ texte d'un nom de joueur. */
export const CHAMP_NOM =
  "h-10 w-full rounded-lg border border-border bg-background px-3 text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

/**
 * La liste pleine largeur : elle déborde des marges de la page pour que ses
 * séparateurs aillent d'un bord à l'autre, comme une liste d'application native.
 */
export const LISTE = "-mx-4 flex w-auto flex-col divide-y divide-border border-border border-y";
