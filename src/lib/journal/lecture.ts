import { desc, eq } from "drizzle-orm";
import { alias } from "drizzle-orm/sqlite-core";
import type { Base } from "@/db/base";
import { joueur, journal } from "@/db/schema";
import { detailDeCorrectionSchema, detailDeSaisieSchema } from "@/lib/journal/ligne";
import {
  type DetailDuTiroir,
  etiquetteDAppareil,
  type Geste,
  type LigneDuTiroir,
  porteeDeLAdresse,
  sortDeLaRoutine,
  type VueDuTiroir,
} from "@/lib/journal/tiroir";
import type { ParametresDeRecherche } from "@/lib/partie/identite-url";

/**
 * Relit la colonne JSON sans jamais lever.
 *
 * `safeParse` et un repli sur « aucun détail » : une charge utile inconnue fait
 * une ligne moins bavarde, une exception ferait un tiroir qui refuse de
 * s'ouvrir. Entre les deux, le journal a un métier — être là le jour où un
 * score bouge tout seul — et une seule des deux issues le remplit.
 *
 * Le cas n'est pas théorique : le journal est append-only et ne se migre donc
 * **jamais**, si bien qu'une ligne garde pour toujours la forme de la version
 * qui l'a écrite.
 */
function sansDetail(): DetailDuTiroir {
  return { forme: "aucun" };
}

function lireUneValeur(charge: unknown): DetailDuTiroir {
  const saisie = detailDeSaisieSchema.safeParse(charge);

  return saisie.success ? { forme: "valeur", valeur: saisie.data.valeur } : sansDetail();
}

function lireUneCorrection(charge: unknown): DetailDuTiroir {
  const correction = detailDeCorrectionSchema.safeParse(charge);

  return correction.success ? { forme: "correction", ...correction.data } : sansDetail();
}

/**
 * Quelle charge utile chaque geste porte, **un par un et sans défaut**.
 *
 * Exhaustif par le type : ajouter un geste au schéma sans décider ici ce qu'on
 * en lit ne compile pas. C'est ce qui remplace un `else` — lequel relisait tout
 * geste non-`correction` comme une saisie, si bien qu'un geste futur portant sa
 * propre charge se serait fait lire comme une valeur au lieu d'être ignoré.
 *
 * `suppressionDeManche` est à `sansDetail` **faute d'écrivain** : la spec veut
 * qu'une suppression emporte les valeurs qu'elle efface, mais rien ne
 * l'écrit encore, et inventer ici la forme que prendra ce JSON serait deviner.
 */
const LECTURE_DU_DETAIL: Record<Geste, (charge: unknown) => DetailDuTiroir> = {
  saisie: lireUneValeur,
  correction: lireUneCorrection,
  suppressionDeManche: sansDetail,
  participantAjoute: sansDetail,
  participantRetire: sansDetail,
  abandon: sansDetail,
  reprise: sansDetail,
};

function lireLeDetail(geste: Geste, brut: string | null): DetailDuTiroir {
  if (brut === null) {
    return sansDetail();
  }

  try {
    return LECTURE_DU_DETAIL[geste](JSON.parse(brut));
  } catch {
    return sansDetail();
  }
}

/**
 * Toutes les lignes d'une partie, la plus récente en tête.
 *
 * L'ordre départage à égalité d'horodatage par l'identifiant : deux lignes
 * écrites dans la même transaction portent la même milliseconde, et un ordre
 * indéterminé ferait raconter l'histoire à l'envers une fois sur deux.
 *
 * Deux jointures sur `joueur` parce que la ligne porte **deux** joueurs qui ne
 * sont pas le même : celui qui agit, gravé, et celui que la case concerne. La
 * seconde est gauche — `abandon` et `reprise` ne concernent personne.
 */
async function lireLesLignes(base: Base, partieId: number): Promise<LigneDuTiroir[]> {
  const agissant = alias(joueur, "agissant");
  const concerne = alias(joueur, "concerne");

  const lignes = await base
    .select({
      id: journal.id,
      geste: journal.geste,
      agissantId: agissant.id,
      agissantNom: agissant.nom,
      concerneId: concerne.id,
      concerneNom: concerne.nom,
      appareilId: journal.appareilId,
      mancheNumero: journal.mancheNumero,
      detail: journal.detail,
      ecritLe: journal.ecritLe,
    })
    .from(journal)
    .innerJoin(agissant, eq(agissant.id, journal.joueurAgissantId))
    .leftJoin(concerne, eq(concerne.id, journal.joueurConcerneId))
    .where(eq(journal.partieId, partieId))
    .orderBy(desc(journal.ecritLe), desc(journal.id));

  const etiquettes = etiqueterLesAppareils(lignes);

  return lignes.map((ligne) => ({
    id: ligne.id,
    geste: ligne.geste,
    agissant: { id: ligne.agissantId, nom: ligne.agissantNom },
    appareil: ligne.appareilId === null ? null : (etiquettes.get(ligne.appareilId) ?? null),
    joueurConcerne:
      ligne.concerneId === null || ligne.concerneNom === null
        ? null
        : { id: ligne.concerneId, nom: ligne.concerneNom },
    mancheNumero: ligne.mancheNumero,
    detail: lireLeDetail(ligne.geste, ligne.detail),
    ecritLe: ligne.ecritLe,
  }));
}

/**
 * Donne une étiquette à chaque appareil de la partie, du plus ancien au plus récent.
 *
 * Attribuée sur **toutes** les lignes et jamais sur celles qui restent après le
 * filtre : sinon « l'appareil B » de la vue par défaut serait « l'appareil C »
 * de la vue complète, et l'étiquette ne servirait plus à rapprocher deux lignes
 * — ce pour quoi elle existe.
 *
 * Le plus ancien prend « A », ce qui est l'ordre dans lequel on raconte
 * l'histoire, alors que les lignes se lisent à l'envers.
 */
function etiqueterLesAppareils(
  lignes: readonly { appareilId: string | null }[],
): Map<string, string> {
  const etiquettes = new Map<string, string>();

  for (const { appareilId } of [...lignes].reverse()) {
    if (appareilId !== null && !etiquettes.has(appareilId)) {
      etiquettes.set(appareilId, etiquetteDAppareil(etiquettes.size));
    }
  }

  return etiquettes;
}

/**
 * Ouvre le tiroir sur une partie, d'après ce que l'adresse en dit.
 *
 * Ne prend **aucune identité de lecteur**, et ne lit ni `participant` ni
 * `appareil` : quiconque peut lire la partie peut ouvrir le tiroir,
 * spectateurs compris. Un journal que seul le créateur pourrait ouvrir ne
 * réglerait pas une dispute autour de la table, ce qui est son unique métier.
 *
 * Ne lit pas non plus l'état de la partie. Une partie **scellée** n'a pas moins
 * de journal qu'une partie en cours — elle en a même plus, et c'est
 * précisément après coup qu'on vient y chercher pourquoi un score a bougé.
 *
 * Le filtre est appliqué **après** la lecture et non en SQL : la portée large
 * doit rendre exactement les mêmes lignes plus les autres, et deux requêtes
 * pour deux portées seraient deux endroits où l'ordre peut diverger. Le volume
 * ne plaide pas contre — quelques dizaines de lignes par partie.
 */
export async function lireLeTiroir(
  base: Base,
  partieId: number,
  recherche: ParametresDeRecherche,
): Promise<VueDuTiroir> {
  const portee = porteeDeLAdresse(recherche);

  if (portee === null) {
    return { etat: "ferme" };
  }

  const lignes = await lireLesLignes(base, partieId);

  return {
    etat: "ouvert",
    portee,
    lignes: portee === "tout" ? lignes : lignes.filter((ligne) => sortDeLaRoutine(ligne.geste)),
  };
}
