import { eq } from "drizzle-orm";
import type { Base } from "@/db/base";
import { partie } from "@/db/schema";
import { codeSchema } from "@/lib/partie/code";
import type { Limiteur } from "@/lib/partie/limite-de-debit";
import type { DemandeDeRecherche } from "@/lib/partie/recherche";

/**
 * La requête du poll, isolée pour que son **plan d'exécution** s'atteste.
 *
 * Une ligne, une colonne, l'index unique du code : c'est la promesse de
 * l'ADR 0003 — « il lit une ligne indexée » — et la seule façon de la tenir
 * dans le temps est de pouvoir la vérifier sur le plan que SQLite en tire,
 * plutôt que sur la prose au-dessus de la fonction.
 *
 * `version` seule, jamais la ligne entière : l'instantané de règles est un JSON
 * de plusieurs centaines d'octets, relu toutes les trois secondes par cinq
 * téléphones pour être jeté.
 */
export function selectionDeVersion(base: Base, code: string) {
  return base
    .select({ version: partie.version })
    .from(partie)
    .where(eq(partie.code, code))
    .limit(1);
}

/**
 * L'estampille que porte la partie de ce code, ou `null`.
 *
 * `null` couvre les deux absences — code malformé, code que personne ne porte —
 * comme {@link lirePartieParCode} : « ce code n'existe pas » est la même réponse
 * pour qui se trompe d'une lettre et pour qui invente.
 *
 * **L'estampille n'est jamais un jeton d'écriture.** Elle sert à comparer deux
 * lectures et à rien d'autre ; le garde-fou de l'écriture concurrente porte sur
 * la case, et une condition portée par la partie ferait échouer quatre joueurs
 * sur cinq à 6 qui prend.
 */
export async function lireLaVersion(base: Base, codeBrut: string): Promise<number | null> {
  const code = codeSchema.safeParse(codeBrut);

  if (!code.success) {
    return null;
  }

  const [ligne] = await selectionDeVersion(base, code.data);

  return ligne?.version ?? null;
}

/**
 * Ce que le sondage rend, et les trois seules réponses qu'il connaît.
 *
 * « Inconnue » est un état à part entière, comme pour la recherche : un code
 * faux se dit, il ne se confond pas avec une estampille absente.
 */
export type SondageDeVersion =
  | { statut: "lue"; version: number }
  | { statut: "inconnue" }
  | { statut: "tropDeTentatives" };

/**
 * Lit l'estampille sous la **même limite de débit** que la recherche par code.
 *
 * Le partage n'est pas une économie, c'est la condition pour que la limite
 * existe : ce sondage est la lecture la moins chère qui dise « ce code
 * désigne-t-il une partie ? », donc exactement l'oracle qu'un script
 * d'énumération choisirait. Un deuxième chemin non limité annulerait le
 * premier.
 *
 * Seuls les **échecs** se comptent, ce que {@link Limiteur} porte déjà : une
 * table de cinq téléphones qui sondent leur propre partie toutes les trois
 * secondes ne tâtonne pas, et ne doit jamais s'enfermer elle-même.
 */
export async function chercherLaVersion(
  base: Base,
  limiteur: Limiteur,
  demande: DemandeDeRecherche,
): Promise<SondageDeVersion> {
  if (!limiteur.estOuvert(demande.cle, demande.maintenant)) {
    return { statut: "tropDeTentatives" };
  }

  const version = await lireLaVersion(base, demande.code);

  if (version === null) {
    limiteur.noterUnEchec(demande.cle, demande.maintenant);

    return { statut: "inconnue" };
  }

  return { statut: "lue", version };
}
