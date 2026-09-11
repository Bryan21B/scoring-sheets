import type { JoueurId } from "@/lib/jeux/moteur";
import type { Regles } from "@/lib/jeux/regles";
import {
  bornesDeSaisie,
  candidatsADesigner,
  caseQuiSeTape,
  gestesAttendus,
  questionDeDesignation,
  valeurDeLaDesignation,
} from "@/lib/manche/gestes";
import type { CaseDeManche } from "@/lib/manche/lecture";
import type { Tapee } from "@/lib/manche/pave";
import type { JoueurConnu } from "@/lib/roster/noms";

/**
 * L'écran par lequel la passe avant démarre — **un seul**.
 *
 * Deux écrans et pas trois, parce qu'il n'y a que deux espèces de gestes : on
 * tape une **valeur** dans une case, ou on **désigne** un joueur. Le refus, lui,
 * n'est pas un départ : il arrive après un envoi et remplace ce qui l'a produit.
 *
 * Rendre un écran et non une file est ce qui rend « un écran, pas cinq »
 * irreprésentable autrement.
 */
export type DepartDePasseAvant =
  | {
      ecran: "valeur";
      caseASaisir: CaseDeManche;
      /** La borne haute du pavé, telle que l'instantané de règles la fige. */
      max: number;
    }
  | {
      ecran: "designation";
      /** Le rang qu'on nomme : `1` puis `2`, comme la colonne les encode. */
      rang: number;
      /** « Qui est sorti ? », « Deuxième sorti ? » — la question, telle quelle. */
      question: string;
      /** Ce que la case du désigné portera : le rang au podium, le vide à Uno. */
      valeur: Tapee;
      /** Ceux qu'on peut nommer, ceux qui tiennent déjà un rang en moins. */
      candidats: readonly JoueurConnu[];
    };

/**
 * Par où la passe avant démarre, **selon le mode**, ou nulle part.
 *
 * Elle **démarre sur soi et s'arrête là**, dans les trois cas : c'est
 * {@link caseQuiSeTape} qui porte cette règle, et elle est lue en premier. À 6
 * qui prend, chacun compte devant soi et l'écran s'ouvre sur sa propre case,
 * remplie comprise — corriger est le même geste que saisir. À Uno, la seule
 * valeur de la manche est le total du sorti, et elle est sienne s'il est le
 * sorti. À Dnup, rien ne se compte devant soi.
 *
 * Faute d'une case à soi, elle prend **le premier geste que la manche attend**.
 * Là où la manche ne porte qu'un geste pour toute la table — Uno et Dnup — les
 * cinq téléphones tombent donc sur le même écran : la passe avant ne se
 * distribue qu'à 6 qui prend, et elle ne se distribue pas parce qu'un jeu le
 * déclare mais parce qu'il y a **plus d'une valeur** à compter.
 *
 * Rend `undefined` quand il n'y a nulle part où démarrer : plus rien n'est
 * attendu, et l'appareil n'a pas de case à corriger. Ce n'est pas un cas limite,
 * c'est le récapitulatif qui prend la main.
 */
export function departDeLaPasseAvant(
  regles: Regles,
  cases: readonly CaseDeManche[],
  joueurDeLAppareil: JoueurId | null,
): DepartDePasseAvant | undefined {
  const bornes = bornesDeSaisie(regles);
  const sienne = caseQuiSeTape(regles, cases, joueurDeLAppareil);

  // Les bornes et la case vont ensemble : un mode qui fait taper une valeur en
  // a forcément, et `podium` — le seul qui n'en a pas — n'ouvre jamais de pavé.
  if (bornes !== null && sienne !== undefined) {
    return { ecran: "valeur", caseASaisir: sienne, max: bornes.max };
  }

  const [attendu] = gestesAttendus(regles, cases);

  if (attendu === undefined) {
    return undefined;
  }

  if (attendu.geste === "valeur") {
    const caseASaisir = cases.find((une) => une.joueur.id === attendu.joueur.id);

    return caseASaisir === undefined || bornes === null
      ? undefined
      : { ecran: "valeur", caseASaisir, max: bornes.max };
  }

  return {
    ecran: "designation",
    rang: attendu.rang,
    question: questionDeDesignation(regles, attendu.rang),
    valeur: valeurDeLaDesignation(regles, attendu.rang),
    candidats: candidatsADesigner(regles, cases),
  };
}
