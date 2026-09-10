/**
 * L'adresse que la plateforme a **résolue elle-même**.
 *
 * Vercel la pose devant l'application et l'écrase si le client l'envoie, ce qui
 * est la condition pour s'y fier : un en-tête que le client pourrait écrire ne
 * compterait rien du tout.
 */
export const EN_TETE_ADRESSE_REELLE = "x-real-ip";

/** La chaîne des relais traversés. Le client en écrit le **premier** maillon. */
export const EN_TETE_ADRESSE = "x-forwarded-for";

/** Ce que les en-têtes d'une requête disent de sa provenance. */
export type AdressesDeRequete = {
  /** `x-real-ip`, posée par la plateforme. */
  reelle: string | null;
  /** `x-forwarded-for`, allongée à chaque relais. */
  transmise: string | null;
};

/** Le dernier maillon non vide d'une chaîne de relais, ou rien. */
function dernierMaillon(chaine: string | null): string | undefined {
  const maillons = (chaine ?? "")
    .split(",")
    .map((maillon) => maillon.trim())
    .filter((maillon) => maillon !== "");

  return maillons.at(-1);
}

/**
 * Ce qui identifie le demandeur pour la limite de débit, et rien d'autre.
 *
 * L'adresse d'abord, l'appareil ensuite : un script qui énumère des codes
 * n'accepte pas les cookies, et une clé qui ne serait que le cookie lui
 * donnerait un compteur neuf à chaque tentative. Le repli sur l'appareil existe
 * pour le développement, où il n'y a aucun mandataire devant.
 *
 * **Le dernier maillon de `x-forwarded-for`, jamais le premier.** L'en-tête
 * s'allonge à chaque relais et c'est le client qui en écrit la gauche : lire à
 * gauche rendrait la limite contournable en changeant une chaîne à chaque
 * requête. Celui de droite est le seul maillon que notre propre mandataire a
 * constaté. `x-real-ip`, que la plateforme écrase, passe avant lui.
 *
 * Les deux espaces sont **préfixés** pour ne jamais se confondre : sans ça, un
 * cookie forgé à la forme d'une adresse userait le compteur de quelqu'un
 * d'autre.
 *
 * Une table entière derrière la même adresse partage un compteur, et c'est sans
 * conséquence : seuls les **échecs** s'y comptent, et une table connaît son code.
 */
export function cleDOrigine(adresses: AdressesDeRequete, idAppareil: string | undefined): string {
  const adresse = dernierMaillon(adresses.reelle) ?? dernierMaillon(adresses.transmise);

  if (adresse !== undefined) {
    return `ip:${adresse}`;
  }

  return idAppareil === undefined ? "sans-origine" : `appareil:${idAppareil}`;
}
