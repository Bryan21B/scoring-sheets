import type { ReactElement } from "react";
import { ouvrirLaMancheSuivanteAction } from "@/app/p/[code]/actions";
import { Accueil } from "@/components/accueil";
import { SondageDePartie } from "@/components/sondage-de-partie";
import { db } from "@/db";
import { CATALOGUE } from "@/lib/jeux/catalogue";
import { lireLaGrille } from "@/lib/manche/lecture";
import { lirePartieEnCours } from "@/lib/partie/en-cours";

/**
 * Jamais mise en cache, et `use cache` y est **interdit** : l'accueil montre une
 * partie qui bouge sous cinq téléphones, et un cache partagé servirait du
 * périmé aux autres joueurs sans qu'aucune invalidation ne les atteigne. Voir
 * `docs/adr/0003-polling-plutot-que-push.md`.
 */
export const dynamic = "force-dynamic";

/**
 * L'accueil : **la partie en cours**, ou le catalogue quand rien ne tourne.
 *
 * Ce n'est que du câblage — la forme des deux écrans vit dans `Accueil`, la
 * question « qu'est-ce qui tourne ? » dans `lirePartieEnCours`, et les totaux
 * dans le moteur. Rien ne se décide ici.
 *
 * La grille et l'estampille sortent de la **même passe de rendu** : le sondage
 * compare à `partie.version` telle qu'elle était quand ces valeurs-ci ont été
 * lues, si bien qu'une écriture arrivée entre les deux se rattrape au battement
 * suivant plutôt que de passer inaperçue.
 */
export default async function PageDAccueil(): Promise<ReactElement> {
  const entrees = Object.values(CATALOGUE);
  const partie = await lirePartieEnCours(db);

  if (partie === null) {
    return <Accueil entrees={entrees} enCours={null} />;
  }

  return (
    <Accueil
      entrees={entrees}
      enCours={{
        partie,
        grille: await lireLaGrille(db, partie.id, partie.regles),
        ouvrirLaMancheSuivante: ouvrirLaMancheSuivanteAction.bind(null, partie.code),
      }}
      sondage={<SondageDePartie code={partie.code} version={partie.version} />}
    />
  );
}
