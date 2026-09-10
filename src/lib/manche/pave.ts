/**
 * Les dix touches du pavé, dans l'ordre où elles se posent à l'écran.
 *
 * Le zéro est en bas, seul, comme sur un clavier de téléphone : la main sait
 * déjà où il est, et le déplacer coûterait une erreur par manche.
 */
export const CHIFFRES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 0] as const;

/**
 * Ce que le pavé porte : une **suite de chiffres**, jamais un nombre.
 *
 * Un `number | null` ne saurait pas distinguer « rien tapé » de « zéro tapé »
 * sans un drapeau à côté, et un zéro est une manche réussie à 6 qui prend, pas
 * une case vide. La chaîne dit les deux sans rien ajouter.
 */
export type Tapee = string;

/** Rien de tapé : ni un zéro, ni une valeur. */
const RIEN = "";

/**
 * Ajoute un chiffre, ou **ne fait rien** si le nombre sortait des bornes.
 *
 * Le refus est sec et muet : pas de boîte de dialogue, pas de message qui
 * s'ouvre sous les doigts. Un chiffre de trop ne prend pas, la valeur déjà
 * tapée reste intacte, et la table continue — c'est l'écran qu'on ouvre trente
 * fois dans une soirée, il ne peut pas se permettre d'interrompre.
 *
 * Aucune borne basse à vérifier : les trois modes ont `min` à `0` littéralement,
 * et une suite de chiffres ne descend pas sous zéro. Une borne basse ici serait
 * une branche qui ne peut pas s'exécuter.
 */
export function appuyerUnChiffre(tapee: Tapee, chiffre: number, max: number): Tapee {
  // Un zéro de tête n'est pas une valeur, c'est un état transitoire : « 0 » puis
  // « 5 » veut dire cinq, jamais zéro-cinq.
  const candidate = (tapee === "0" ? RIEN : tapee) + String(chiffre);

  return Number(candidate) > max ? tapee : candidate;
}

/** Efface le dernier chiffre. Un champ déjà vide le reste. */
export function effacerUnChiffre(tapee: Tapee): Tapee {
  return tapee.slice(0, -1);
}

/**
 * L'inverse de {@link valeurDuPave} : ce qu'une case déjà remplie affiche au
 * pavé, et ce que le champ caché porte.
 *
 * Ici et non dans le composant : la conversion a deux sens, et en laisser une
 * moitié à l'écran ferait dériver l'aller du retour le jour où le vide change
 * de représentation.
 */
export function enTapee(valeur: number | null): Tapee {
  return valeur === null ? RIEN : String(valeur);
}

/**
 * Le nombre tapé, ou `null` tant que rien ne l'est.
 *
 * `null` et non zéro : la case vide et la case à zéro sont deux états
 * différents, et les confondre écrirait une manche réussie à la place d'une
 * case qu'on n'a pas encore remplie.
 */
export function valeurDuPave(tapee: Tapee): number | null {
  return tapee === RIEN ? null : Number(tapee);
}
