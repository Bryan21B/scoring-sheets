import { and, eq, max } from "drizzle-orm";
import { z } from "zod";
import type { Base } from "@/db/base";
import { manche } from "@/db/schema";

/**
 * Le numéro d'une manche, tel qu'une adresse le porte.
 *
 * Coercitif parce qu'un segment d'URL n'est jamais qu'une chaîne, et strict sur
 * le reste : un numéro négatif ou décimal ne désigne aucune manche, et le
 * refuser vaut mieux que de rendre une page vide.
 */
export const numeroDeMancheSchema = z.coerce.number().int().positive();

/** Une manche ouverte, ou rejointe : l'écran qui suit n'a besoin que de ça. */
export type MancheOuverte = {
  id: number;
  numero: number;
};

/** Le numéro que porte la première manche d'une partie. */
const PREMIER_NUMERO = 1;

/**
 * Le numéro que « la manche suivante » désigne : le plus grand plus un.
 *
 * Le plus grand, et non le nombre de manches : supprimer la manche 2 laisse un
 * **trou**, et compter les lignes ferait ressortir un numéro déjà porté par le
 * journal — qui garde le numéro nu, précisément parce qu'il ne se réutilise pas.
 *
 * Exporté, alors que {@link ouvrirLaMancheSuivante} l'appelle déjà : c'est la
 * moitié de lecture du geste, et la séparer est ce qui rend l'entrelacement de
 * deux téléphones reproductible dans un test au lieu d'être laissé au hasard de
 * l'ordonnanceur.
 */
export async function prochainNumeroDeManche(base: Base, partieId: number): Promise<number> {
  const [ligne] = await base
    .select({ dernier: max(manche.numero) })
    .from(manche)
    .where(eq(manche.partieId, partieId));

  const dernier = ligne?.dernier;

  return dernier === null || dernier === undefined ? PREMIER_NUMERO : dernier + 1;
}

/**
 * Ouvre la manche portant ce numéro, ou **rejoint** celle qui le porte déjà.
 *
 * L'idempotence est tenue par l'unicité `(partie, numéro)`, pas par une clé
 * fabriquée côté client : deux téléphones qui appuient en même temps ont lu le
 * même plus grand numéro, donc visent la même manche. Le second n'insère rien
 * et relit la ligne du premier — ce n'est pas une erreur à montrer, c'est le
 * résultat que les deux voulaient.
 *
 * `onConflictDoNothing` puis relecture, et non une transaction : la contrainte
 * fait le travail, et une transaction ne rendrait pas la course moins réelle.
 *
 * @throws si la ligne reste introuvable après un conflit — cela voudrait dire
 * que la contrainte a refusé pour une autre raison que celle-ci, ce qui est une
 * base cassée et non un cas à traiter.
 */
export async function ouvrirLaMancheAuNumero(
  base: Base,
  partieId: number,
  numero: number,
): Promise<MancheOuverte> {
  const [ouverte] = await base
    .insert(manche)
    .values({ partieId, numero })
    .onConflictDoNothing({ target: [manche.partieId, manche.numero] })
    .returning({ id: manche.id });

  if (ouverte !== undefined) {
    return { id: ouverte.id, numero };
  }

  const [rejointe] = await base
    .select({ id: manche.id })
    .from(manche)
    .where(and(eq(manche.partieId, partieId), eq(manche.numero, numero)))
    .limit(1);

  if (rejointe === undefined) {
    throw new Error(`La manche ${numero} de la partie ${partieId} n'a pu être ni ouverte ni lue.`);
  }

  return { id: rejointe.id, numero };
}

/** Ouvre — ou rejoint — la manche suivante de cette partie. */
export async function ouvrirLaMancheSuivante(base: Base, partieId: number): Promise<MancheOuverte> {
  return ouvrirLaMancheAuNumero(base, partieId, await prochainNumeroDeManche(base, partieId));
}
