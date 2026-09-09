import { z } from "zod";
import type { EntreeCatalogue } from "@/lib/jeux/catalogue";
import { type Fin, finValeurSchema, type Regles } from "@/lib/jeux/regles";

/**
 * Ce qu'une table décide à l'ouverture, et qui ne se rejoue plus ensuite.
 *
 * Le nombre de joueurs est lu **une fois** : sans cela, un joueur qui arrive ou
 * qui s'en va ferait basculer la condition de fin en plein jeu.
 */
export type OuvertureDePartie = {
  /** L'effectif de la table, borné par `joueursMin` et `joueursMax` du jeu. */
  nombreDeJoueurs: number;
  /**
   * « Ce soir on s'arrête à 30 » — le seul champ surchargeable, et la règle
   * imprimée l'autorise explicitement. Chaque champ ouvert de plus serait un
   * contrôle de plus sur un écran qu'on traverse debout, et deux parties du
   * même jeu qui ne se comparent plus dans l'historique.
   */
  finValeur?: number | undefined;
};

/**
 * Résout les règles d'une entrée pour une table donnée, et rend l'instantané
 * que la partie fige.
 *
 * C'est le seul endroit où `varianteSelonJoueurs` et la surcharge de seuil sont
 * lues : après cet appel, plus rien ne dépend du nombre de joueurs ni du
 * catalogue. Deux gestes le garantissent — l'instantané se construit champ par
 * champ plutôt que par rest, si bien qu'un champ ajouté au catalogue demain n'y
 * entre pas par accident ; et il est cloné, parce que `as const` ne gèle rien à
 * l'exécution et qu'une partie qui tiendrait le catalogue par référence
 * pourrait le réécrire pour toutes les autres.
 *
 * La variante se lit **une seule fois**, et chacun de ses champs remplace le
 * sien : à Dnup, deux joueurs prennent la saisie sans jetons et la fin en
 * manches gagnées du même coup. Surcharger la fin sans la saisie figerait dans
 * la partie un barème que la table ne jouera jamais, et l'instantané ne se
 * rattrape pas.
 *
 * @throws si l'effectif sort des bornes du jeu, ou si la surcharge n'est pas un
 * entier ≥ 1. Les deux sont des refus secs : une partie ouverte sur des règles
 * approximatives se découvre au moment du décompte, quand il est trop tard.
 */
export function resoudreRegles(entree: EntreeCatalogue, ouverture: OuvertureDePartie): Regles {
  const { classement, saisie, fin, joueursMin, joueursMax, varianteSelonJoueurs } = entree.regles;
  const { nombreDeJoueurs, finValeur } = ouverture;

  const effectifSchema = z.number().int().min(joueursMin).max(joueursMax);

  if (!effectifSchema.safeParse(nombreDeJoueurs).success) {
    throw new Error(
      `${entree.nom} se joue de ${joueursMin} à ${joueursMax} joueurs, pas à ${nombreDeJoueurs}.`,
    );
  }

  const variante = varianteSelonJoueurs?.[nombreDeJoueurs];

  return structuredClone({
    classement,
    saisie: variante?.saisie ?? saisie,
    fin: surcharger(variante?.fin ?? fin, finValeur),
    joueursMin,
    joueursMax,
  });
}

/**
 * Applique la surcharge à une fin **déjà résolue** pour l'effectif : « on
 * s'arrête à 3 » à deux joueurs à Dnup vaut trois manches gagnées, pas trois
 * jetons. Le type de fin vient du jeu, jamais de la table.
 */
function surcharger(fin: Fin, finValeur: number | undefined): Fin {
  if (finValeur === undefined) {
    return fin;
  }

  if (!finValeurSchema.safeParse(finValeur).success) {
    throw new Error(`Une fin de partie se surcharge par un entier ≥ 1, pas par ${finValeur}.`);
  }

  return { ...fin, valeur: finValeur };
}
