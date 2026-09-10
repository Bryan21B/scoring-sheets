import { z } from "zod";

/**
 * Le protocole du sondage : ce qui passe entre le navigateur et la route, et la
 * décision qu'il déclenche.
 *
 * Séparé de `src/lib/partie/version.ts`, qui lit la base, parce que **ce module
 * part dans le navigateur** : le composant client du poll l'importe, et un
 * module qui touche Drizzle ou le schéma emporterait tout cela dans le paquet
 * servi au téléphone. Rien ici n'a de dépendance serveur.
 */

/**
 * Trois secondes entre deux sondages.
 *
 * Le chiffre est **mesuré**, pas choisi au doigt mouillé :
 * `docs/adr/0003-polling-plutot-que-push.md` le chiffre à environ 18 000
 * invocations et 40 000 lignes lues par soirée, deux ordres de grandeur sous
 * les plafonds du plan gratuit. Le descendre à une seconde triple la facture
 * pour gagner deux secondes sur une table de cartes.
 *
 * Il vit ici, et non dans le composant qui l'appelle, pour être relu par un
 * test : un nombre écrit dans un `useEffect` ne se vérifie pas.
 */
export const INTERVALLE_DE_POLL_MS = 3000;

/**
 * Ce que la route du sondage renvoie. Validé à l'arrivée comme toute entrée
 * externe : le navigateur reçoit du JSON, et un `version` absent ou textuel
 * ferait comparer un `undefined` à un nombre — donc rafraîchir en boucle.
 */
export const reponseDeSondageSchema = z.object({
  version: z.number().int().nonnegative(),
});

/** La réponse du sondage, dérivée de son schéma plutôt qu'écrite deux fois. */
export type ReponseDeSondage = z.infer<typeof reponseDeSondageSchema>;

/**
 * L'estampille a-t-elle bougé depuis le rendu qu'on a sous les yeux ?
 *
 * **Différente**, et non « plus grande » : une base restaurée ou une partie
 * recréée peut faire reculer le compteur, et rafraîchir de trop coûte une
 * lecture là où ne pas rafraîchir coûte une soirée fausse.
 *
 * Pure, et séparée du composant qui l'appelle, parce que c'est **la** décision
 * du poll : « inchangée, on ne fait rien ; changée, on rafraîchit ». Un `!==`
 * noyé dans un `useEffect` ne se vérifie pas.
 */
export function doitRafraichir(connue: number, lue: number): boolean {
  return connue !== lue;
}
