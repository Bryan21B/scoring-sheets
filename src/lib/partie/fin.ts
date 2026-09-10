import { and, eq, isNull } from "drizzle-orm";
import type { Ecriture, Lecture } from "@/db/base";
import { partie } from "@/db/schema";

/**
 * La fin d'une partie : absente, ou présente **d'un bloc**.
 *
 * Les trois colonnes bougent ensemble — un `CHECK` le tient en base — donc le
 * type les porte ensemble aussi : une fin à moitié écrite ne se représente pas.
 *
 * `cause` distingue les deux façons de finir. `terminee` est **estampillée par
 * l'écriture qui clôt la dernière manche**, qui calcule déjà `fini` ;
 * `abandonnee` est un acte, que rien ne déduit. C'est la seule exception à
 * « rien de ce qui se recalcule n'est stocké », et le **scellement** garantit
 * qu'elle ne peut pas diverger. Voir
 * `docs/adr/0006-la-fin-de-partie-est-estampillee.md`.
 */
export type FinDePartie = {
  le: Date;
  cause: "terminee" | "abandonnee";
  par: number;
};

/** La fin de cette partie, ou `null` si elle est encore en cours. */
export async function lireLaFin(base: Lecture, partieId: number): Promise<FinDePartie | null> {
  const [ligne] = await base
    .select({ le: partie.finLe, cause: partie.finCause, par: partie.finPar })
    .from(partie)
    .where(eq(partie.id, partieId))
    .limit(1);

  if (ligne === undefined) {
    throw new Error(`Aucune partie ${partieId}.`);
  }

  // Les trois ensemble ou aucune : le `CHECK` l'impose en base, et les relire
  // d'un bloc est ce qui empêche un appelant de croire à une fin sans auteur.
  if (ligne.le === null || ligne.cause === null || ligne.par === null) {
    return null;
  }

  return { le: ligne.le, cause: ligne.cause, par: ligne.par };
}

/**
 * Estampille la fin, **ou rend celle qui y est déjà**.
 *
 * La condition `fin_le IS NULL` est dans le SQL et non dans une relecture
 * préalable : deux clôtures simultanées ont toutes les deux calculé `fini` sur
 * une partie encore ouverte, et c'est le zéro ligne touchée qui départage. La
 * seconde ne réécrit donc ni la date, ni la cause, ni l'auteur — la partie ne se
 * termine qu'une fois, et le palmarès n'a qu'une date à lire.
 *
 * Exporté, alors que la clôture l'appelle déjà : c'est la moitié écriture du
 * geste, et la séparer est ce qui rend l'entrelacement de deux téléphones
 * reproductible dans un test au lieu d'être laissé au hasard de l'ordonnanceur.
 *
 * **Ne fait pas bouger l'estampille de version** : aucun déclencheur ne porte
 * sur `partie`, comme `src/db/triggers.sql` l'écrit. Ce n'est pas un trou pour
 * la fin régulière — la clôture de manche qui l'appelle écrit `manche` dans la
 * **même transaction**, et c'est cette écriture-là que les autres téléphones
 * voient passer.
 */
export async function estampillerLaFin(
  tx: Ecriture,
  partieId: number,
  fin: FinDePartie,
): Promise<FinDePartie> {
  const touchees = await tx
    .update(partie)
    .set({ finLe: fin.le, finCause: fin.cause, finPar: fin.par })
    .where(and(eq(partie.id, partieId), isNull(partie.finLe)))
    .returning({ id: partie.id });

  if (touchees.length > 0) {
    return fin;
  }

  const dejaLa = await lireLaFin(tx, partieId);

  if (dejaLa === null) {
    throw new Error(`La partie ${partieId} a refusé l'estampille sans porter de fin.`);
  }

  return dejaLa;
}
