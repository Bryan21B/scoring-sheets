import { z } from "zod";
import { tirerAuHasard } from "@/lib/aleatoire";

/**
 * L'alphabet de Crockford : les trente-deux symboles qui restent une fois
 * retirés `I`, `L`, `O` et `U`.
 *
 * Le code d'une partie se **dicte à voix haute** au reste de la table, et c'est
 * ce retrait qui rend la dictée possible : plus de « zéro ou O ? », plus de
 * « un, i ou L ? ». `U` sort pour une autre raison — il évite qu'un tirage
 * écrive un mot qu'on ne veut pas dicter.
 */
export const ALPHABET_CROCKFORD = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";

/**
 * Six caractères : 2³⁰ combinaisons pour quelques centaines de parties.
 *
 * Aucun caractère de contrôle en septième position — la base porte déjà
 * l'unicité, et elle dit mieux qu'une somme de contrôle qu'un code est faux.
 */
export const LONGUEUR_CODE = 6;

/**
 * Ce que la dictée abîme, et que la normalisation répare.
 *
 * Les quatre lettres retirées de l'alphabet ne sont pas refusées à la saisie :
 * quelqu'un qui entend « O » tape `O`, et le renvoyer à un code inconnu serait
 * lui faire payer une confusion que le format existe pour absorber.
 */
const CONFUSIONS: Record<string, string> = { O: "0", I: "1", L: "1" };

/**
 * Ramène ce qui a été tapé ou collé sur la forme unique gardée en base.
 *
 * Les espaces et les tirets tombent parce qu'un code dicté se retape avec des
 * respirations — « A1B, 2C3 » — et que ces séparateurs ne portent rien.
 */
export function normaliserCode(brut: string): string {
  return brut
    .toUpperCase()
    .replace(/[\s-]/g, "")
    .replace(/[OIL]/g, (lettre) => CONFUSIONS[lettre] ?? lettre);
}

/**
 * Valide un code venu de l'extérieur — lien partagé, champ « rejoindre » — en
 * le normalisant d'abord.
 *
 * Normaliser avant de valider, et non l'inverse : `oil123` est un code juste
 * mal transcrit, pas un code faux.
 */
export const codeSchema = z
  .string()
  .transform(normaliserCode)
  .pipe(z.string().regex(new RegExp(`^[${ALPHABET_CROCKFORD}]{${LONGUEUR_CODE}}$`)));

/** Le code d'une partie, sous sa forme normalisée. */
export type CodeDePartie = z.output<typeof codeSchema>;

/**
 * Tire un code au hasard. L'unicité n'est pas de son ressort : c'est la base
 * qui la porte, et `genererCodeUnique` qui la consulte.
 */
export function genererCode(): CodeDePartie {
  return tirerAuHasard(ALPHABET_CROCKFORD, LONGUEUR_CODE);
}

/**
 * Le nombre de tirages avant d'abandonner.
 *
 * À 2³⁰ combinaisons pour quelques centaines de parties, huit collisions
 * d'affilée ne sont pas une base pleine : c'est une base qui répond mal. Une
 * boucle sans borne transformerait cette panne en requête qui ne revient jamais.
 */
const TENTATIVES_MAX = 8;

/**
 * Tire un code que la base ne porte pas encore.
 *
 * Prend le test d'existence en paramètre plutôt que d'ouvrir une connexion :
 * la boucle de régénération est de la logique, et elle se vérifie sans base.
 *
 * @throws après {@link TENTATIVES_MAX} collisions consécutives.
 */
export async function genererCodeUnique(
  estPris: (code: CodeDePartie) => Promise<boolean>,
): Promise<CodeDePartie> {
  for (let tentative = 0; tentative < TENTATIVES_MAX; tentative += 1) {
    const code = genererCode();

    if (!(await estPris(code))) {
      return code;
    }
  }

  throw new Error(
    `Aucun code libre après ${TENTATIVES_MAX} tirages : la base répond « déjà pris » à tout.`,
  );
}
