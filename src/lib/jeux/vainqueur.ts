import type { JoueurId } from "@/lib/jeux/moteur";

/**
 * Qui a gagné une partie : **la tête du classement, à condition d'y être seule**.
 *
 * Le moteur ne nomme jamais de gagnant — il constate l'ordre et sort son
 * classement en groupes de rang — et c'est ici, une seule fois dans le dépôt,
 * que « premier tout seul » se lit. Un groupe de deux en tête ne se départage
 * nulle part : la partie a eu lieu, personne ne l'a gagnée.
 *
 * Une fonction partagée et non deux lectures voisines, parce que trois écrans
 * posent la même question et qu'ils doivent y répondre pareil : la ligne
 * d'historique qui écrit « Marie l'emporte », le compteur de victoires de la
 * fiche de joueur, et le taux du palmarès qui lit le même classement. Deux
 * définitions de « gagner une partie » divergeraient le jour où l'une est
 * corrigée seule, et la fiche afficherait alors cinq victoires à côté d'un taux
 * qui en compte quatre.
 *
 * `null` plutôt qu'`undefined`, à l'inverse de `gagnantDeManche` : celui-là dit
 * « rien ne le désigne » à l'intérieur du moteur, celui-ci est une absence qui
 * traverse des lignes jusqu'à un écran, où elle se rend en toutes lettres.
 */
export function vainqueurDuClassement(
  classement: readonly (readonly JoueurId[])[],
): JoueurId | null {
  const tete = classement[0];

  if (tete === undefined || tete.length !== 1) {
    return null;
  }

  return tete[0] ?? null;
}
