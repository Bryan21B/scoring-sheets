import type { ReactElement } from "react";
import { Historique } from "@/components/historique";
import { db } from "@/db";
import { CATALOGUE } from "@/lib/jeux/catalogue";
import { lireLHistorique } from "@/lib/partie/historique";
import { filtreDeLAdresse } from "@/lib/partie/historique-url";

/**
 * Jamais mise en cache : une partie finit pendant la soirée, et une page gardée
 * montrerait l'historique d'avant la dernière manche — au moment précis où l'on
 * vient y chercher celle qu'on vient de terminer.
 */
export const dynamic = "force-dynamic";

/**
 * L'historique : la liste des parties finies, et l'entrée des fiches.
 *
 * Du câblage, et rien d'autre. L'adresse dit le filtre (`historique-url.ts`),
 * le lecteur dit les lignes (`historique.ts`), la forme de l'écran vit dans
 * `Historique`. Rien ne se décide ici — pas même le nombre de lignes, que le
 * plafond de l'adresse a déjà borné.
 */
export default async function PageDHistorique(
  props: PageProps<"/historique">,
): Promise<ReactElement> {
  const filtre = filtreDeLAdresse(await props.searchParams);

  return (
    <Historique
      vue={await lireLHistorique(db, filtre)}
      filtre={filtre}
      entrees={Object.values(CATALOGUE)}
    />
  );
}
