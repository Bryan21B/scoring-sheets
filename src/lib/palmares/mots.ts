/**
 * Les nombres du palmarès **mis en mots**, une seule fois pour les deux écrans.
 *
 * Le palmarès et la fiche de joueur comptent les mêmes choses — des parties, des
 * victoires, une proportion — et deux accords du pluriel écrits chacun de son
 * côté divergent le jour où l'un est corrigé seul. L'écart ne se verrait qu'à
 * l'écran, sur la ligne qu'on lit le moins souvent.
 *
 * Pur, et sans rien de React : c'est ce qui laisse un test l'épingler
 * directement, au lieu de le chercher dans du balisage.
 */

/** L'espace insécable qui tient le nombre et son signe sur la même ligne. */
const INSECABLE = "\u00a0";

/**
 * Un taux mis en mots : un pourcentage entier.
 *
 * Aucune décimale. Le taux est une moyenne sur une poignée de parties, et
 * écrire « 62,5 % » lui prêterait une précision que cinq soirées n'ont pas.
 *
 * Assemblé à la main plutôt que par `Intl.NumberFormat` : la sortie de celui-ci
 * varie d'une version d'ICU à l'autre — même raison qu'à l'horodatage du
 * journal — et un écran dont le texte dépend du runtime n'est pas vérifiable.
 */
export function pourcentage(taux: number): string {
  return `${Math.round(taux * 100)}${INSECABLE}%`;
}

/**
 * Un nombre de parties, au singulier près.
 *
 * « 1 parties » ferait douter du chiffre plus que de la grammaire, et zéro est
 * le cas ordinaire de qui vient d'arriver au roster — donc « 0 partie », qui est
 * bien le singulier en français.
 */
export function parties(combien: number): string {
  return combien > 1 ? `${combien} parties` : `${combien} partie`;
}

/** Un nombre de victoires, au singulier près, sur la même règle que les parties. */
export function victoires(combien: number): string {
  return combien > 1 ? `${combien} victoires` : `${combien} victoire`;
}
