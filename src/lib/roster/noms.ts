import { z } from "zod";

/**
 * Un nom de joueur, tel qu'il arrive du champ « nouveau nom ».
 *
 * Le plafond est celui d'une liste qu'on relit debout, pas une contrainte de
 * stockage : au-delà, la ligne du roster déborde et ne se lit plus.
 */
export const nomSchema = z.string().trim().min(1).max(60);

/** Ce que le roster montre d'un joueur au moment de se choisir. */
export type JoueurConnu = { id: number; nom: string };

/**
 * Ce que l'interface doit faire d'un nom tapé.
 *
 * Deux issues seulement, et jamais un refus : un homonyme n'est pas une erreur,
 * c'est une question. Deux personnes peuvent vraiment s'appeler Marie, et
 * refuser serait faux.
 */
export type DecisionDeNom = { statut: "creer"; nom: string } | Homonymie;

/**
 * La question qu'un nom déjà porté pose : « c'est elle, ou une autre Marie ? »
 *
 * Nommée et exportée parce qu'elle traverse trois couches sans changer de
 * forme — la décision, le résultat de la création, l'écran — et qu'une forme
 * recopiée trois fois diverge le jour où l'une est corrigée seule.
 */
export type Homonymie = { statut: "desambiguiser"; nom: string; homonymes: JoueurConnu[] };

/**
 * Réduit un nom à ce qui sert à le comparer : casse et accents indifférents.
 *
 * Comparer largement fait poser la question plus souvent, jamais moins — et
 * c'est le bon côté de l'erreur : la question coûte un geste, le doublon
 * silencieux coûte une liste illisible pour toujours.
 */
function pourComparer(nom: string): string {
  return nom
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLocaleLowerCase("fr");
}

/** Deux noms désignent-ils la même étiquette, à la casse et aux accents près ? */
export function memeNom(a: string, b: string): boolean {
  return pourComparer(a) === pourComparer(b);
}

/**
 * Décide ce qu'un nom tapé déclenche : la création, ou la question.
 *
 * Ne crée rien et ne touche à rien — c'est la décision seule, pour que l'écran
 * et l'écriture la lisent au même endroit et ne puissent pas diverger.
 *
 * Aucun suffixe automatique n'est proposé : « Marie (2) » tranche à la place de
 * l'humain, et c'est l'humain qui relira la liste.
 */
export function evaluerNom(nom: string, roster: readonly JoueurConnu[]): DecisionDeNom {
  const homonymes = roster.filter((joueur) => memeNom(joueur.nom, nom));

  return homonymes.length === 0
    ? { statut: "creer", nom }
    : { statut: "desambiguiser", nom, homonymes };
}
