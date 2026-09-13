import type { FinDePartie } from "@/lib/partie/fin";
import { INTERVALLE_DE_SONDAGE_MS } from "@/lib/partie/sondage";

/**
 * Ce que la fin d'une partie déclenche chez celui qui la regarde — la décision,
 * jamais l'animation.
 *
 * Ce module ne connaît ni canevas, ni bibliothèque, ni navigateur : il répond à
 * « des confettis, oui ou non, et combien ? » à partir de l'estampille de fin,
 * de qui regarde et de l'heure. C'est le seul endroit où cette question se
 * tranche, et c'est ce qui la rend vérifiable — une condition écrite dans un
 * `useEffect` ne s'atteste qu'à l'œil, et une fête ne se rejoue pas pour
 * vérifier.
 */

/**
 * La fenêtre pendant laquelle la fin est **encore en train d'arriver**.
 *
 * **Deux battements de sondage, et non un.** Le temps réel de cette application
 * est un poll de trois secondes (`docs/adr/0003`) : le téléphone qui clôt la
 * manche voit la fin tout de suite, les quatre autres ne l'apprennent qu'à leur
 * battement suivant — jusqu'à trois secondes plus tard — et le rendu que ce
 * battement déclenche coûte encore un aller-retour. Une fenêtre d'exactement un
 * battement ferait donc tomber les confettis chez celui qui a compté et chez
 * personne d'autre, ce qui est précisément le contraire de « la partie s'est
 * finie pour toute la table ».
 *
 * Dérivée de {@link INTERVALLE_DE_SONDAGE_MS} et non écrite en dur : le jour où
 * l'intervalle du poll bouge, la fenêtre le suit, sans quoi elle deviendrait
 * une constante qui ne veut plus rien dire.
 */
export const FENETRE_DE_FETE_MS = 2 * INTERVALLE_DE_SONDAGE_MS;

/**
 * Ce qui tombe chez le vainqueur.
 *
 * Le nombre est franchement plus grand que celui de la table, pas marginalement :
 * la différence doit se voir d'un téléphone à l'autre autour de la même table,
 * et deux salves à dix pièces d'écart se ressembleraient.
 */
export const PIECES_POUR_LE_VAINQUEUR = 180;

/**
 * Ce qui tombe chez les autres participants.
 *
 * Franc et non symbolique : la partie s'est finie pour eux aussi. Ce qui les
 * distingue du vainqueur est la densité, jamais l'absence.
 */
export const PIECES_POUR_LA_TABLE = 60;

/**
 * La fête, ou son absence.
 *
 * Deux branches et pas un nombre qui vaudrait zéro : « aucune » et « une salve
 * vide » ne sont pas la même chose, et un `0` laisserait un appelant monter
 * quand même le canevas d'un lien rouvert trois jours plus tard.
 */
export type Fete = { statut: "aucune" } | { statut: "tombe"; pieces: number };

/** Ce qu'on rend quand il n'y a rien à fêter — une seule valeur, jamais recopiée. */
const AUCUNE: Fete = { statut: "aucune" };

/**
 * Les confettis tombent-ils, et à quelle densité ?
 *
 * Quatre conditions, dans cet ordre, et toutes nécessaires :
 *
 * - **La partie doit être régulièrement terminée.** Un abandon n'a pas de
 *   vainqueur — c'est la même décision de domaine que l'historique, qui n'en
 *   nomme aucun — et fêter une soirée qu'on vient de ranger serait une moquerie.
 *   C'est aussi ce qui empêche une reprise suivie d'un nouvel abandon de tirer
 *   une salve à chaque aller-retour.
 * - **Celui qui regarde doit être de la tablée.** Le code donne la lecture, et
 *   un passant peut ouvrir le lien dans la minute : la partie ne s'est pas finie
 *   pour lui.
 * - **La fin doit être fraîche**, au sens de {@link FENETRE_DE_FETE_MS}. C'est
 *   le critère « un lien rouvert plus tard donne le même écran sans confettis »,
 *   et il est écrit comme une fenêtre plutôt que comme un drapeau parce qu'il
 *   n'y a rien à stocker : la fête n'est pas un état de la partie, c'est une
 *   lecture de son âge.
 * - **Une estampille dans le futur reste fraîche.** Elle ne peut venir que d'une
 *   horloge qui a bougé, jamais d'un lien rouvert, et refuser la fête là ferait
 *   rater la seule qui comptait.
 *
 * `maintenant` est un nombre et non une horloge : la décision se rejoue à
 * n'importe quelle date dans un test, ce qu'un `Date.now()` interne interdirait.
 */
export function feteDeLaFin(entree: {
  fin: FinDePartie;
  /** Celui qui regarde a-t-il une place vivante dans cette partie ? */
  deLaPartie: boolean;
  /** Est-il sur la marche de tête — seul, ou à égalité, les deux se fêtent pareil ? */
  vainqueur: boolean;
  /** L'horloge du rendu, en millisecondes depuis l'époque. */
  maintenant: number;
}): Fete {
  const { fin, deLaPartie, vainqueur, maintenant } = entree;

  if (fin.cause !== "terminee" || !deLaPartie) {
    return AUCUNE;
  }

  if (maintenant - fin.le.getTime() > FENETRE_DE_FETE_MS) {
    return AUCUNE;
  }

  return {
    statut: "tombe",
    pieces: vainqueur ? PIECES_POUR_LE_VAINQUEUR : PIECES_POUR_LA_TABLE,
  };
}
