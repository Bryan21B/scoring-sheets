import { RefusDeCloture, type ResultatDeCloture } from "@/lib/manche/cloture";
import type { FinDePartie } from "@/lib/partie/fin";

/**
 * La fin qu'une clôture vient de provoquer, telle que l'estampille la porte.
 *
 * `cause` se relit et ne se devine pas : la clôture régulière estampille
 * `terminee`, mais celui qui appuie sur une manche d'une partie abandonnée
 * relit une fin qui n'est pas la sienne, et la lui annoncer autrement serait
 * lui mentir.
 */
export type FinAnnoncee = { statut: "finie"; cause: FinDePartie["cause"] };

/** Un refus de clôture, écrit pour être lu au-dessus de l'écran d'où il part. */
export type RefusAnnonce = { statut: "refusee"; message: string };

/**
 * Ce que l'écran de clôture a reçu du serveur, ou `null` quand il n'a rien à
 * annoncer.
 *
 * Trois états et pas quatre : la clôture qui ne termine rien **ne dit rien** —
 * quelqu'un vient d'agir, la manche est close, on passe à la suivante.
 *
 * À n'importer que **par type** depuis un composant client : ce module lit
 * `RefusDeCloture` à l'exécution, donc le module de clôture, donc Drizzle et le
 * schéma. Une valeur importée d'ici emporterait la base dans le téléphone.
 */
export type EtatDeCloture = FinAnnoncee | RefusAnnonce | null;

/**
 * Ce que la clôture annonce, **lu de la fin estampillée et de rien d'autre**.
 *
 * Le statut de la clôture n'entre pas dans la décision, et c'est voulu : le
 * second à appuyer n'a rien refermé — sa clôture est `dejaClose` — mais la
 * partie est finie et il doit le voir. C'est `fin` qui tranche, jamais qui a
 * gagné la course.
 *
 * **C'est la seule sortie de l'alerte de seuil.** Une page qui recalculerait
 * `fini` à l'affichage la ferait s'allumer puis s'éteindre au gré des
 * corrections, alors que `fini` ne lit que les manches closes. Et clore la
 * manche **est** la confirmation de fin de partie : il n'y a pas de second
 * écran « voulez-vous terminer », quelqu'un vient déjà d'agir et lui demander
 * deux fois serait le punir d'avoir compté. Voir
 * `docs/specs/2026-09-09-cycle-de-vie.md`.
 */
export function finAAnnoncer(resultat: ResultatDeCloture): FinAnnoncee | null {
  return resultat.fin === null ? null : { statut: "finie", cause: resultat.fin.cause };
}

/**
 * Le refus à montrer à la table, ou `null` s'il n'y a rien à lui dire.
 *
 * **Seul un {@link RefusDeCloture} se montre** : c'est le type qui dit « cette
 * phrase est écrite pour être lue ». Un rapport de champs Zod, une manche
 * disparue, une contrainte SQLite sont internes — les afficher n'aiderait
 * personne autour de la table tout en racontant la base — et `null` renvoie
 * l'appelant à les laisser remonter.
 */
export function refusAMontrer(erreur: unknown): RefusAnnonce | null {
  return erreur instanceof RefusDeCloture ? { statut: "refusee", message: erreur.message } : null;
}
