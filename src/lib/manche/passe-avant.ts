import type { JoueurId } from "@/lib/jeux/moteur";
import type { CaseDeManche } from "@/lib/manche/lecture";

/**
 * La case par laquelle la passe avant démarre — **une seule**.
 *
 * Elle **démarre sur soi et s'arrête là** : un écran, pas cinq. À 6 qui prend,
 * les cinq joueurs saisissent chacun la leur en même temps et volontairement,
 * si bien qu'enchaîner sur l'écran du voisin le doublerait au lieu de l'aider.
 * Rendre une case et non une file est ce qui rend cette propriété
 * irreprésentable autrement.
 *
 * Sur soi **même quand la case est déjà remplie** : corriger est le même geste
 * que saisir, on retape la ligne, et sauter sa propre case remplie enverrait
 * ailleurs quelqu'un qui vient précisément se corriger.
 *
 * Sans appareil rattaché à un participant — un spectateur, un téléphone qui
 * n'est de personne — elle démarre sur la **première case manquante**. Le
 * `null` en couvre les deux formes, puisque « l'appareil se déclare quelqu'un
 * qui n'est pas de la table » se lit ici exactement comme « il ne se déclare
 * personne ».
 *
 * Rend `undefined` quand il n'y a nulle part où démarrer : tout est rempli et
 * l'appareil n'est de personne. Ce n'est pas un cas limite, c'est le
 * récapitulatif qui prend la main.
 */
export function caseDeDepart(
  cases: readonly CaseDeManche[],
  joueurDeLAppareil: JoueurId | null,
): CaseDeManche | undefined {
  return (
    cases.find((une) => une.joueur.id === joueurDeLAppareil) ??
    cases.find((une) => une.valeur === null)
  );
}
