import type { EntreeCatalogue } from "@/lib/jeux/catalogue";
import type { Fin } from "@/lib/jeux/regles";
import { resoudreRegles } from "@/lib/jeux/resolution";

/**
 * La condition de fin **imprimée** pour un effectif donné, ou `null` hors des
 * bornes du jeu.
 *
 * C'est ce qui pré-remplit le champ du seuil, et c'est pourquoi elle dépend de
 * l'effectif : à Dnup, deux joueurs ne jouent pas avec des jetons mais en
 * manches gagnées. Montrer 4 jetons là serait montrer une règle qui ne sera pas
 * appliquée.
 *
 * Passe par `resoudreRegles` plutôt que de relire `finSelonJoueurs` : deux
 * lectures de la même surcharge divergeraient le jour où l'une est corrigée
 * seule. Le refus hors bornes y est une exception ; ici c'est un `null`, parce
 * que l'écran de la tablée traverse cet état à chaque frappe dans le champ du
 * nombre de joueurs.
 */
export function finImprimee(entree: EntreeCatalogue, nombreDeJoueurs: number): Fin | null {
  try {
    return resoudreRegles(entree, { nombreDeJoueurs }).fin;
  } catch {
    return null;
  }
}

/**
 * Écrit une condition de fin comme on la dit à la table.
 *
 * L'unité du jeu ne sert qu'au seuil : une manche est une manche à 6 qui prend
 * comme à Uno, et « 2 têtes de bœuf gagnées » ne veut rien dire.
 */
export function libelleDeFin(fin: Fin, unite: EntreeCatalogue["unite"]): string {
  const mot = fin.valeur === 1 ? unite.un : unite.plusieurs;

  switch (fin.type) {
    case "seuil":
      return `${fin.valeur} ${mot}`;
    case "manchesFixes":
      return `${fin.valeur} ${fin.valeur === 1 ? "manche" : "manches"}`;
    case "manchesGagnees":
      return `${fin.valeur} ${fin.valeur === 1 ? "manche gagnée" : "manches gagnées"}`;
  }
}
