import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import {
  assurerIdAppareil,
  NOM_COOKIE_APPAREIL,
  OPTIONS_COOKIE_APPAREIL,
} from "@/lib/appareil/cookie";

/**
 * Pose le cookie d'appareil **dès le premier chargement**, avant toute
 * identification, et le **réémet à chaque requête**.
 *
 * La réémission n'est pas une rotation : la valeur déjà présente est rendue
 * telle quelle, et seule sa date d'expiration repart de zéro. C'est ce qui rend
 * les quatre cents jours réels plutôt que théoriques — un appareil qui revient
 * chaque semaine n'expire jamais.
 *
 * L'identifiant est aussi réinjecté dans les cookies de la requête transmise,
 * pour que le rendu du **même** chargement voie déjà l'appareil. Sans ça, la
 * toute première page servie à un navigateur vierge le croirait sans cookie.
 *
 * Le cookie ne porte aucun lien vers un joueur : ce lien vit dans la table
 * `appareil`, et il ne s'écrit qu'au moment où quelqu'un se choisit. Rien n'est
 * donc créé en base ici — un passage de robot ne laisse pas de ligne derrière
 * lui.
 *
 * `proxy` et non `middleware` : Next 16 a renommé la convention, et le nom
 * `middleware` y est déprécié.
 */
export default function proxy(request: NextRequest): NextResponse {
  const idAppareil = assurerIdAppareil(request.cookies.get(NOM_COOKIE_APPAREIL)?.value);

  request.cookies.set(NOM_COOKIE_APPAREIL, idAppareil);

  const response = NextResponse.next({ request });

  response.cookies.set(NOM_COOKIE_APPAREIL, idAppareil, OPTIONS_COOKIE_APPAREIL);

  return response;
}

/**
 * Tout sauf ce qui n'est pas une navigation : les fichiers de build, les
 * images optimisées et la favicon n'ont aucune identité à porter, et les
 * exclure évite un `Set-Cookie` par ressource sur chaque page.
 */
export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
