import { z } from "zod";
import { type JeuId, jeuIdSchema } from "@/lib/jeux/catalogue";
import type { FiltreDHistorique } from "@/lib/partie/historique";
import { type ParametresDeRecherche, premierParametre } from "@/lib/partie/identite-url";

/**
 * La part **pure** de l'historique : son adresse, son filtre, sa page.
 *
 * Séparée de `historique.ts` pour que les écrans n'aient rien à importer de la
 * base — un composant de présentation reçoit des props, et tirer Drizzle dans
 * son graphe de modules pour y lire un nom de paramètre serait payer une
 * dépendance pour une chaîne de trois lettres. Même partage que le tiroir du
 * journal entre `journal/tiroir.ts` et `journal/lecture.ts`.
 */

/** L'adresse de la liste, écrite une seule fois dans le dépôt. */
export const ADRESSE_HISTORIQUE = "/historique";

/**
 * Combien de parties une page montre.
 *
 * Aucune numérotation : à dix joueurs, l'historique entier tient sous le pouce,
 * et un « voir plus » suffira le jour improbable où il déborde. Vingt lignes,
 * c'est déjà plusieurs mois de soirées.
 */
export const PAGE_DHISTORIQUE = 20;

/**
 * Le plafond de ce qu'une adresse peut demander d'un coup.
 *
 * `?voir=999999999` se tape à la main, et le servir ferait lire toute la table
 * pour un écran que personne ne déroulera. Le plafond est large — dix fois une
 * page — parce qu'il borne un abus, pas un usage.
 */
const PLAFOND_DHISTORIQUE = PAGE_DHISTORIQUE * 10;

/** Le jeu demandé. Le seul filtre : par joueur, c'est la fiche de joueur. */
const PARAM_JEU = "jeu";

/** Combien de lignes montrer. Le « voir plus » augmente ce nombre. */
const PARAM_VOIR = "voir";

/**
 * Le nombre de lignes demandé, ramené dans les bornes.
 *
 * `catch` plutôt qu'un refus : une adresse se bricole, et un historique qui
 * casse pour un `?voir=beaucoup` coûte infiniment plus cher que la page qu'il
 * n'a pas su lire.
 */
const combienSchema = z.coerce
  .number()
  .int()
  .min(1)
  .max(PLAFOND_DHISTORIQUE)
  .catch(PAGE_DHISTORIQUE);

/**
 * Ce que l'adresse demande à l'historique.
 *
 * Tolérant sur les deux axes : un jeu inconnu rend la liste entière plutôt que
 * de lever, comme `porteeDeLAdresse` ouvre le tiroir sur sa vue par défaut. Un
 * filtre qu'on ne sait pas lire ne doit pas valoir un écran cassé — au pire il
 * montre plus que demandé, ce qui se corrige d'un appui.
 */
export function filtreDeLAdresse(recherche: ParametresDeRecherche): FiltreDHistorique {
  const jeu = jeuIdSchema.safeParse(premierParametre(recherche[PARAM_JEU]));

  return {
    jeuId: jeu.success ? jeu.data : null,
    combien: combienSchema.parse(premierParametre(recherche[PARAM_VOIR])),
  };
}

/**
 * L'adresse qui déroule **une page de plus**, ou `null` quand il n'y en a plus.
 *
 * Le plafond se lit ici et nulle part ailleurs : c'est le même nombre qui borne
 * ce qu'une adresse peut demander, et un « voir plus » qui le dépasserait
 * écrirait `?voir=220` — que {@link filtreDeLAdresse} ramène à la page par
 * défaut, si bien que le lien **rétrécirait** la liste au lieu de l'allonger.
 * Le dernier pas s'arrête donc pile sur le plafond, et après lui il n'y a plus
 * de lien du tout.
 *
 * `null` plutôt qu'une adresse inerte : c'est l'écran qui décide de ne rien
 * montrer, et il ne peut pas se tromper sur une valeur qu'il n'a pas à comparer.
 */
export function adresseDeLaPageSuivante(filtre: FiltreDHistorique): string | null {
  if (filtre.combien >= PLAFOND_DHISTORIQUE) {
    return null;
  }

  return adresseDeLHistorique(
    filtre.jeuId,
    Math.min(filtre.combien + PAGE_DHISTORIQUE, PLAFOND_DHISTORIQUE),
  );
}

/**
 * L'autre sens : l'adresse de l'historique sous ce filtre et cette page.
 *
 * Les valeurs par défaut ne s'écrivent pas — `/historique` tout court est la
 * liste entière — pour que l'adresse qu'on partage soit la plus courte qui dise
 * la même chose. Elle ne reconduit aucun autre paramètre : il n'y en a pas
 * d'autre sur cet écran, et en inventer un ici le figerait.
 */
export function adresseDeLHistorique(
  jeuId: JeuId | null,
  combien: number = PAGE_DHISTORIQUE,
): string {
  const parametres = new URLSearchParams();

  if (jeuId !== null) {
    parametres.set(PARAM_JEU, jeuId);
  }

  if (combien !== PAGE_DHISTORIQUE) {
    parametres.set(PARAM_VOIR, String(combien));
  }

  const suite = parametres.toString();

  return suite === "" ? ADRESSE_HISTORIQUE : `${ADRESSE_HISTORIQUE}?${suite}`;
}
