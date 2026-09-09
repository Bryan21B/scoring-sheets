import { z } from "zod";
import { tirerAuHasard } from "@/lib/aleatoire";

/** Le nom du cookie serveur qui porte l'identité d'appareil. */
export const NOM_COOKIE_APPAREIL = "appareil";

/**
 * Quatre cents jours, en secondes — le plafond de Chrome et de Firefox.
 *
 * Safari iOS n'impose aucun plafond à un `Set-Cookie` serveur ; c'est le
 * stockage écrit en JavaScript que l'ITP rabote à sept jours, et c'est
 * exactement pourquoi ce cookie est `HttpOnly` et pourquoi rien n'est écrit
 * côté client. La réémission à chaque requête remet le compteur à zéro partout.
 */
export const DUREE_COOKIE_APPAREIL = 400 * 24 * 60 * 60;

/**
 * Les drapeaux du cookie d'appareil, en un seul objet partagé par la seule
 * frontière qui l'écrit.
 *
 * `sameSite: "lax"` est load-bearing : arriver depuis un lien envoyé par
 * messagerie est une **navigation cross-site**, et `strict` ne transmettrait
 * alors pas le cookie — l'appareil paraîtrait vierge précisément dans le
 * parcours principal.
 */
export const OPTIONS_COOKIE_APPAREIL = {
  httpOnly: true,
  secure: true,
  sameSite: "lax",
  path: "/",
  maxAge: DUREE_COOKIE_APPAREIL,
} as const satisfies {
  httpOnly: boolean;
  secure: boolean;
  sameSite: "lax";
  path: string;
  maxAge: number;
};

/** Longueur de l'identifiant, en caractères. 21 × 6 bits = 126 bits d'entropie. */
const LONGUEUR_ID = 21;

/** 64 symboles : le tirage y est sans biais, `tirerAuHasard` le vérifie. */
const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_-";

/**
 * Valide la valeur relue du cookie.
 *
 * Frontière de confiance : un cookie se bricole à la main, et sa valeur finit
 * en clé primaire de la table `appareil`. Une forme inconnue est refusée, pas
 * rabotée.
 */
export const idAppareilSchema = z.string().regex(new RegExp(`^[A-Za-z0-9_-]{${LONGUEUR_ID}}$`));

/** Un identifiant d'appareil, tel que le cookie le porte. */
export type IdAppareil = z.infer<typeof idAppareilSchema>;

/**
 * Tire une valeur **opaque** : elle ne dit rien de l'appareil, et le lien vers
 * un joueur vit en base, jamais dans le cookie.
 *
 * Aucune empreinte de navigateur n'entre ici, et c'est une décision : Safari 26
 * interdit d'écrire du stockage persistant aux scripts qu'il reconnaît comme
 * empreintes, si bien qu'en chercher une coûterait l'identifiant qu'on essaie
 * de garder. Voir `docs/adr/0004`.
 */
export function creerIdAppareil(): IdAppareil {
  return tirerAuHasard(ALPHABET, LONGUEUR_ID);
}

/**
 * Rend l'identifiant à écrire dans la réponse : celui qui est déjà là, ou un
 * neuf.
 *
 * Rendre l'existant tel quel est ce qui fait de la réémission une prolongation
 * et non une rotation — un identifiant qui changerait à chaque requête ne
 * reconnaîtrait jamais personne.
 */
export function assurerIdAppareil(valeurRecue: string | undefined): IdAppareil {
  const parsed = idAppareilSchema.safeParse(valeurRecue);

  return parsed.success ? parsed.data : creerIdAppareil();
}
