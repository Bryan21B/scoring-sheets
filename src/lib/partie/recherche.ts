import type { Base } from "@/db/base";
import { lirePartieParCode, type VueDePartie } from "@/lib/partie/lecture";
import { creerLimiteur, LIMITE_DE_RECHERCHE, type Limiteur } from "@/lib/partie/limite-de-debit";

/**
 * Ce qu'une recherche par code rend, et les trois seuls écrans qu'elle appelle.
 *
 * « Inconnue » est un **état à part entière**, pas une absence : un code faux
 * doit s'afficher comme tel, et surtout jamais faire tomber sur la partie de
 * quelqu'un d'autre.
 */
export type RechercheDePartie =
  | { statut: "trouvee"; partie: VueDePartie }
  | { statut: "inconnue" }
  | { statut: "tropDeTentatives" };

/** Ce qu'il faut pour chercher : le code, d'où il vient, et quand. */
export type DemandeDeRecherche = {
  code: string;
  /** Ce qui identifie le demandeur — l'appareil, l'adresse — jamais le code. */
  cle: string;
  maintenant: number;
};

/**
 * La limite que la recherche par code partage à l'échelle du processus.
 *
 * Vit ici, à côté de la seule fonction qui la consulte : un limiteur exporté
 * plus largement finirait consulté par deux chemins avec deux politiques.
 */
export const limiteDeRecherche: Limiteur = creerLimiteur(LIMITE_DE_RECHERCHE);

/**
 * Retrouve une partie par son code, sous limite de débit.
 *
 * Le code donne la **lecture**, et rien d'autre : cette fonction ne demande
 * aucune identité et n'écrit rien. Elle est la seule porte par laquelle une
 * partie se trouve depuis l'extérieur, et c'est pour ça que la limite est ici
 * plutôt qu'à un écran — un deuxième chemin non limité annulerait le premier.
 *
 * La limite se referme sur les **échecs** seulement (voir {@link Limiteur}) et,
 * une fois fermée, refuse aussi le bon code : sinon elle se contournerait en
 * glissant un code connu entre deux tirages aveugles.
 *
 * Le limiteur et l'horloge sont des paramètres pour que la fenêtre se vérifie
 * sans attendre une minute ni partager d'état entre deux tests.
 */
export async function chercherPartieParCode(
  base: Base,
  limiteur: Limiteur,
  demande: DemandeDeRecherche,
): Promise<RechercheDePartie> {
  if (!limiteur.estOuvert(demande.cle, demande.maintenant)) {
    return { statut: "tropDeTentatives" };
  }

  const partie = await lirePartieParCode(base, demande.code);

  if (partie === null) {
    limiteur.noterUnEchec(demande.cle, demande.maintenant);

    return { statut: "inconnue" };
  }

  return { statut: "trouvee", partie };
}
