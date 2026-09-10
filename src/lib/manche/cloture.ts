import { and, eq, isNull } from "drizzle-orm";
import { z } from "zod";
import type { Base, Ecriture } from "@/db/base";
import { manche, partie } from "@/db/schema";
import { estComplete } from "@/lib/jeux/moteur";
import { parseRegles, type Regles } from "@/lib/jeux/regles";
import { evaluerLaPartie, lireLaManche, mancheDuMoteur } from "@/lib/manche/lecture";
import { estampillerLaFin, type FinDePartie, lireLaFin } from "@/lib/partie/fin";

/**
 * Ce que la clôture demande : quelle manche, et qui la déclare finie.
 *
 * Coercitif parce que la source est un champ caché de formulaire, qui n'envoie
 * jamais que des chaînes. Strict comme les autres frontières : un champ
 * inattendu est un formulaire qui a dérivé de son action.
 *
 * Pas d'`agissant` ici, contrairement à une saisie : la clôture **n'est pas un
 * geste du journal** — elle ne déplace aucune valeur — et `manche.close_par` ne
 * garde donc qu'un joueur, sans l'appareil d'où c'est parti.
 */
export const demandeDeClotureSchema = z.strictObject({
  mancheId: z.coerce.number().int().positive(),
  parJoueurId: z.coerce.number().int().positive(),
});

/** Une demande de clôture validée. */
export type DemandeDeCloture = z.infer<typeof demandeDeClotureSchema>;

/**
 * Les deux issues d'une clôture, et il n'y en a pas de troisième.
 *
 * `dejaClose` n'est pas un échec : le second à appuyer voulait une manche close,
 * et il en a une. Il n'y a rien à lui annoncer.
 */
export type ResultatDeCloture = {
  statut: "close" | "dejaClose";
  /**
   * La fin de la partie si cette clôture vient de la provoquer, `null` sinon.
   *
   * C'est **la seule sortie de l'alerte de seuil** : elle part d'ici et de nulle
   * part ailleurs. Une page qui la recalculerait à l'affichage la ferait
   * s'allumer puis s'éteindre au gré des corrections, alors que `fini` ne lit
   * que les manches closes.
   */
  fin: FinDePartie | null;
};

/**
 * Un refus **écrit pour être lu**, au-dessus de l'écran d'où part la clôture.
 *
 * Nommé comme {@link RefusDArrivee} l'est en salle d'attente, et pour la même
 * raison : ce qui se montre à la table est séparé de ce qui ne regarde que le
 * serveur.
 */
export class RefusDeCloture extends Error {
  override readonly name = "RefusDeCloture";
}

/** La phrase d'une manche qu'il reste à remplir. */
const MANCHE_INCOMPLETE =
  "Il manque des valeurs à cette manche : une manche incomplète se répare, elle ne se clôt pas.";

/** Ce que la clôture doit relire avant de décider quoi que ce soit. */
type ContexteDeCloture = {
  partieId: number;
  numero: number;
  regles: Regles;
  /** `null` tant que personne n'a déclaré la manche finie. */
  closeLe: Date | null;
};

/**
 * Relit la manche, sa clôture, sa partie et l'instantané de règles.
 *
 * Une seule requête plutôt que deux : la clôture a besoin des quatre en même
 * temps, et les séparer laisserait la manche se fermer entre les deux lectures.
 *
 * @throws si la manche n'existe pas — un écran ne propose que des manches lues à
 * l'instant, donc un id absent est un envoi forgé ou une manche supprimée sous
 * les doigts, pas un cas à afficher.
 */
async function lireLeContexte(tx: Ecriture, mancheId: number): Promise<ContexteDeCloture> {
  const [ligne] = await tx
    .select({
      partieId: manche.partieId,
      numero: manche.numero,
      closeLe: manche.closeLe,
      regles: partie.regles,
    })
    .from(manche)
    .innerJoin(partie, eq(partie.id, manche.partieId))
    .where(eq(manche.id, mancheId))
    .limit(1);

  if (ligne === undefined) {
    throw new Error(`Aucune manche ${mancheId}.`);
  }

  return {
    partieId: ligne.partieId,
    numero: ligne.numero,
    closeLe: ligne.closeLe,
    regles: parseRegles(ligne.regles),
  };
}

/**
 * La manche a-t-elle reçu tout ce que son mode de saisie attend ?
 *
 * La complétude vient du **moteur** et n'est jamais recalculée ici : elle se
 * dérive du mode, et une seconde définition divergerait de la première le jour
 * où un mode gagne une subtilité.
 */
async function estCompleteEnBase(tx: Ecriture, contexte: ContexteDeCloture): Promise<boolean> {
  const vue = await lireLaManche(tx, contexte.partieId, contexte.numero);

  if (vue === null) {
    throw new Error(`La manche ${contexte.numero} de la partie ${contexte.partieId} a disparu.`);
  }

  return estComplete(contexte.regles, mancheDuMoteur(vue.cases, false));
}

/**
 * Pose la date et l'auteur de clôture, **à condition que la manche soit encore
 * ouverte**.
 *
 * La condition est dans le SQL et non dans une relecture préalable : deux
 * téléphones qui appuient en même temps ont tous les deux lu une manche ouverte,
 * et c'est le zéro ligne touchée qui départage. Le second n'écrase donc ni la
 * date ni l'auteur du premier.
 */
async function fermer(tx: Ecriture, demande: DemandeDeCloture): Promise<boolean> {
  const touchees = await tx
    .update(manche)
    .set({ closeLe: new Date(), closePar: demande.parJoueurId })
    .where(and(eq(manche.id, demande.mancheId), isNull(manche.closeLe)))
    .returning({ id: manche.id });

  return touchees.length > 0;
}

/**
 * La partie est-elle finie maintenant que cette manche est close ? Si oui,
 * estampille la fin **dans la même transaction**.
 *
 * L'évaluation se fait après l'écriture de `close_le` et dans sa transaction :
 * le moteur voit donc la manche que l'on vient de fermer, et que personne
 * d'autre ne voit encore. C'est ce qui fait de la clôture la **confirmation de
 * fin de partie** — il n'y a pas de second écran « voulez-vous terminer ».
 *
 * Les trois conditions de fin passent par cette porte-là, sans traitement
 * particulier : `seuil`, `manchesFixes` et `manchesGagnees` sont trois branches
 * du moteur, jamais trois chemins d'écriture.
 */
async function estampillerSiFinie(
  tx: Ecriture,
  contexte: ContexteDeCloture,
  demande: DemandeDeCloture,
): Promise<FinDePartie | null> {
  const etat = await evaluerLaPartie(tx, contexte.partieId, contexte.regles);

  if (!etat.fini) {
    return null;
  }

  return estampillerLaFin(tx, contexte.partieId, {
    le: new Date(),
    cause: "terminee",
    par: demande.parJoueurId,
  });
}

/**
 * Clôt une manche : la **déclaration** qu'elle est finie.
 *
 * Elle se déclare, elle ne se déduit pas de la complétude — une manche complète
 * attend encore qu'on la close, et c'est cet intervalle qui laisse corriger.
 *
 * **Idempotente** : clore une manche déjà close ne fait rien et n'annonce rien.
 *
 * @throws {@link RefusDeCloture} sur une manche incomplète.
 */
export async function cloturerLaManche(base: Base, brut: unknown): Promise<ResultatDeCloture> {
  const demande = demandeDeClotureSchema.parse(brut);

  return base.transaction(async (tx) => {
    const contexte = await lireLeContexte(tx, demande.mancheId);

    if (contexte.closeLe !== null) {
      return { statut: "dejaClose", fin: await lireLaFin(tx, contexte.partieId) };
    }

    if (!(await estCompleteEnBase(tx, contexte))) {
      throw new RefusDeCloture(MANCHE_INCOMPLETE);
    }

    if (!(await fermer(tx, demande))) {
      return { statut: "dejaClose", fin: await lireLaFin(tx, contexte.partieId) };
    }

    return { statut: "close", fin: await estampillerSiFinie(tx, contexte, demande) };
  });
}
