import { desc, isNull } from "drizzle-orm";
import type { Base } from "@/db/base";
import { partie } from "@/db/schema";
import { lirePartieParCode, type VueDePartie } from "@/lib/partie/lecture";

/**
 * La partie que l'accueil montre, ou `null` quand rien ne tourne.
 *
 * **En cours** se lit `fin_le IS NULL`, et rien d'autre : il n'y a pas de
 * colonne de statut à trois valeurs, une partie terminée comme une partie
 * abandonnée portent une fin, et les deux sortent donc de l'accueil par la même
 * porte. C'est ce qui fait de l'abandon le balai de l'écran principal.
 *
 * **La plus récente**, quand plusieurs tournent. Le coût est assumé par le
 * design : une deuxième partie en cours n'est pas sur l'accueil, elle se
 * retrouve par son code — le champ « on t'a donné un code ? » reste sous la
 * partie précisément pour ça. L'identifiant départage deux parties ouvertes
 * dans la même milliseconde, sans quoi l'accueil vacillerait d'un chargement à
 * l'autre.
 *
 * Ne prend **aucune identité de lecteur** : comme la page d'une partie, l'accueil
 * montre la soirée en cours à qui ouvre l'application. Il n'y a pas de
 * créateur, donc rien à conditionner.
 *
 * Deux requêtes plutôt qu'une : celle-ci désigne, {@link lirePartieParCode}
 * lit. Recopier ici la construction d'une {@link VueDePartie} la ferait diverger
 * le jour où l'une des deux est corrigée seule.
 */
export async function lirePartieEnCours(base: Base): Promise<VueDePartie | null> {
  const [ligne] = await base
    .select({ code: partie.code })
    .from(partie)
    .where(isNull(partie.finLe))
    .orderBy(desc(partie.creeLe), desc(partie.id))
    .limit(1);

  return ligne === undefined ? null : lirePartieParCode(base, ligne.code);
}
