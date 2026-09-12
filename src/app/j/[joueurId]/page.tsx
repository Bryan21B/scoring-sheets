import { notFound } from "next/navigation";
import type { ReactElement } from "react";
import { z } from "zod";
import { FicheJoueur } from "@/components/fiche-joueur";
import { db } from "@/db";
import { lireLaFicheDeJoueur } from "@/lib/palmares/fiche";

/**
 * Jamais mise en cache : les compteurs bougent dès qu'une partie se termine, et
 * une fiche gardée montrerait une victoire de moins que le palmarès d'à côté.
 */
export const dynamic = "force-dynamic";

/**
 * L'identifiant du joueur, tel que l'adresse le porte.
 *
 * Coercitif parce qu'un segment d'URL est toujours une chaîne, et validé parce
 * qu'une adresse se bricole : `/j/abc` doit rendre un 404, pas une erreur de
 * base. Même frontière que partout ailleurs — toute entrée externe passe par un
 * schéma Zod avant d'atteindre la logique.
 */
const joueurIdSchema = z.coerce.number().int().positive();

/**
 * La fiche d'un joueur : ses compteurs, groupés par famille.
 *
 * Du câblage, et rien d'autre. `lireLaFicheDeJoueur` dit les compteurs, la forme
 * de l'écran vit dans `FicheJoueur`.
 *
 * Le 404 du framework et non un écran dédié, à la différence d'un code de partie
 * inconnu : un code se dicte à voix haute et se trompe d'une lettre, alors qu'on
 * n'arrive ici que par un lien du palmarès. Il n'y a rien à retaper sur place.
 */
export default async function PageDeFicheDeJoueur(
  props: PageProps<"/j/[joueurId]">,
): Promise<ReactElement> {
  const { joueurId } = await props.params;
  const demande = joueurIdSchema.safeParse(joueurId);

  if (!demande.success) {
    notFound();
  }

  const fiche = await lireLaFicheDeJoueur(db, demande.data);

  if (fiche === null) {
    notFound();
  }

  return <FicheJoueur fiche={fiche} />;
}
