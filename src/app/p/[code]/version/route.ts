import { NextResponse } from "next/server";
import { db } from "@/db";
import { cleDeLaRequete, lireLAppareil } from "@/lib/appareil/requete";
import { limiteDeRecherche } from "@/lib/partie/recherche";
import type { ReponseDeSondage } from "@/lib/partie/sondage";
import { chercherLaVersion } from "@/lib/partie/version";

/** Jamais mise en cache : une estampille gardée est une estampille périmée. */
export const dynamic = "force-dynamic";

/**
 * L'estampille de version d'une partie — **la seule chose que le poll lit**.
 *
 * Une route, et non une Server Action : c'est une lecture, appelée toutes les
 * trois secondes par chaque téléphone de la table, et une action ferait
 * traverser tout le protocole de rendu de Next pour rapporter un entier.
 *
 * Sous la **même limite de débit** que la recherche par code, pour la raison
 * qu'expose `chercherLaVersion` : c'est la lecture la moins chère qui dise « ce
 * code désigne-t-il une partie ? », donc l'oracle qu'un script d'énumération
 * choisirait. Seuls les échecs se comptent, si bien qu'une table qui sonde sa
 * propre partie ne s'enferme jamais elle-même.
 *
 * `404` sur un code inconnu et `429` sur une limite fermée, plutôt qu'un `200`
 * portant un état : le client n'a rien à faire de ces deux cas — il ne
 * rafraîchit pas — et un statut HTTP le dit sans lui apprendre un vocabulaire.
 */
export async function GET(
  _requete: Request,
  contexte: RouteContext<"/p/[code]/version">,
): Promise<NextResponse<ReponseDeSondage | null>> {
  const idAppareil = await lireLAppareil();
  const sondee = await chercherLaVersion(db, limiteDeRecherche, {
    code: (await contexte.params).code,
    cle: await cleDeLaRequete(idAppareil),
    maintenant: Date.now(),
  });

  switch (sondee.statut) {
    case "lue":
      return NextResponse.json({ version: sondee.version }, { status: 200 });
    case "inconnue":
      return NextResponse.json(null, { status: 404 });
    case "tropDeTentatives":
      return NextResponse.json(null, { status: 429 });
  }
}
