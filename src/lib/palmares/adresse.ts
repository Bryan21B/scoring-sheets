/**
 * Les adresses de la seconde paire, écrites **une seule fois** dans le dépôt.
 *
 * Séparées de la lecture pour que les écrans n'aient rien à importer de la base :
 * un composant de présentation reçoit des props, et tirer Drizzle dans son graphe
 * de modules pour y lire un chemin de deux lettres serait payer une dépendance
 * pour une chaîne. Même partage que `partie/historique-url.ts` et son lecteur.
 */

/** La liste des joueurs. L'autre moitié de la paire est l'historique. */
export const ADRESSE_PALMARES = "/palmares";

/**
 * La fiche d'un joueur, désignée par son **identifiant du roster**.
 *
 * Pas un code Crockford comme une partie : ce code-là existe parce qu'une partie
 * se dicte au téléphone et s'envoie par messagerie, alors qu'une fiche de joueur
 * se rejoint par la liste qui la précède. Lui donner un code coûterait une
 * colonne et une unicité pour une adresse que personne ne recopie.
 *
 * Prend un nombre et non un joueur : la page de la fiche relit le joueur depuis
 * l'identifiant de toute façon, et exiger un `JoueurConnu` ici obligerait tout
 * appelant à en tenir un pour écrire un lien.
 */
export function adresseDeFicheDeJoueur(joueurId: number): string {
  return `/j/${joueurId}`;
}
