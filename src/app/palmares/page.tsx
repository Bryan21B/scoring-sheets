import type { ReactElement } from "react";
import { Palmares } from "@/components/palmares";
import { db } from "@/db";
import { CATALOGUE } from "@/lib/jeux/catalogue";
import { lirePalmares } from "@/lib/palmares/lecture";

/**
 * Jamais mise en cache : une partie finit pendant la soirée, et un taux gardé
 * serait celui d'avant la dernière manche — au moment précis où l'on vient voir
 * ce qu'elle a changé.
 */
export const dynamic = "force-dynamic";

/**
 * Le palmarès : la liste des joueurs, et l'entrée des fiches de joueur.
 *
 * Du câblage, et rien d'autre. Le lecteur dit les lignes, leur ordre et le
 * plancher (`palmares/lecture.ts`), la forme de l'écran vit dans `Palmares`.
 * Rien ne se décide ici.
 *
 * Aucun paramètre d'adresse, à la différence de l'historique : il n'y a **rien à
 * filtrer**. Filtrer le palmarès par jeu donnerait un taux par (joueur, jeu), et
 * la recherche classement a mesuré que 7 à 9 parties par joueur, par entrée et
 * par an ne suffisent à rien — ce qui va par jeu, ce sont les compteurs de la
 * fiche, qui sont des faits.
 */
export default async function PagePalmares(): Promise<ReactElement> {
  return <Palmares vue={await lirePalmares(db)} entrees={Object.values(CATALOGUE)} />;
}
