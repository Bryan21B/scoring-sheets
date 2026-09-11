import type { Base, Ecriture } from "@/db/base";
import { type Agissant, agissantSchema, consignerUnGesteDePartie } from "@/lib/journal/ligne";
import {
  effacerLaFin,
  estampillerLaFin,
  exigerUnePartieAbandonnee,
  exigerUnePartieOuverte,
  type FinDePartie,
} from "@/lib/partie/fin";
import { estParticipant, PAS_DE_LA_PARTIE } from "@/lib/partie/salle-attente";

/**
 * Les gestes qui font **sortir une partie de l'écran d'accueil, ou l'y ramènent**.
 *
 * Ils sont ensemble parce que le domaine les tient ensemble : l'abandon est le
 * balai, la reprise le défait, et la suppression est la seule autre sortie —
 * réservée à la partie qui n'a rien à protéger. Voir
 * `docs/specs/2026-09-09-cycle-de-vie.md`.
 *
 * Ce qu'ils **n'ont pas** en commun avec les autres écritures : ils ne touchent
 * aucune case, et ce sont les seuls qui changent ce que les autres ont le droit
 * de faire.
 */

/**
 * Un refus **écrit pour être lu**, au-dessus de l'écran d'où part le geste.
 *
 * Une classe et non une `Error` nue, comme {@link RefusDArrivee} et
 * {@link RefusDeCloture} : elle sépare ce qui se montre à la table — « tu
 * regardes cette partie », « cette partie a un journal » — de ce qui ne regarde
 * que le serveur et raconterait la base.
 *
 * Une seule pour les trois gestes, parce qu'un seul écran les porte : le tiroir.
 */
export class RefusDeCycle extends Error {
  override readonly name = "RefusDeCycle";
}

/**
 * Exige que l'agissant soit de la tablée.
 *
 * **N'importe quel participant** abandonne, reprend et supprime : il n'y a pas
 * de rôle de créateur dans ce design, et en inventer un pour ces gestes-ci en
 * créerait un pour une seule fonctionnalité.
 *
 * Ce n'est **pas de l'autorisation** — l'identité est une déclaration, jamais
 * une preuve, et rien n'empêche de repointer son téléphone. Ce qui se vérifie
 * est une **appartenance**, et une appartenance se lit en base. Ce qu'on arrête
 * ici est le spectateur qui arrête la soirée des autres, pas une fraude.
 *
 * La phrase est celle de la salle d'attente, et non une seconde : deux
 * formulations feraient croire à deux situations différentes.
 *
 * @throws {@link RefusDeCycle} si le joueur agissant n'a pas de place vivante.
 */
async function exigerUnParticipant(
  tx: Ecriture,
  partieId: number,
  agissant: Agissant,
): Promise<void> {
  if (!(await estParticipant(tx, partieId, agissant.joueurId))) {
    throw new RefusDeCycle(PAS_DE_LA_PARTIE);
  }
}

/**
 * Abandonne la partie : la **fin sans vainqueur**, et le balai de l'accueil.
 *
 * L'auteur arrive sous la forme d'un {@link Agissant}, résolu du cookie par
 * l'action serveur et jamais du formulaire : `partie.fin_par` se grave, et
 * laisser un envoi le désigner reviendrait à signer l'arrêt d'une soirée au nom
 * d'un autre.
 *
 * La ligne de journal part dans la **même transaction** que l'estampille, et ce
 * n'est pas qu'une question de trace : aucun déclencheur ne porte sur `partie`,
 * donc c'est cette ligne-là qui fait bouger l'estampille de version. Séparées,
 * les autres téléphones verraient une partie close sans l'avoir appris.
 *
 * @throws {@link RefusDeCycle} si l'agissant n'est pas de la tablée.
 * @throws {@link PartieScellee} si la partie porte déjà une fin — on n'abandonne
 * ni une partie terminée, ni une partie déjà abandonnée.
 */
export async function abandonnerLaPartie(
  base: Base,
  partieId: number,
  brut: unknown,
): Promise<FinDePartie> {
  const agissant = agissantSchema.parse(brut);

  return base.transaction(async (tx) => {
    await exigerUnParticipant(tx, partieId, agissant);
    await exigerUnePartieOuverte(tx, partieId);

    const fin = await estampillerLaFin(tx, partieId, {
      le: new Date(),
      cause: "abandonnee",
      par: agissant.joueurId,
    });

    await consignerUnGesteDePartie(tx, { partieId, geste: "abandon", agissant });

    return fin;
  });
}

/**
 * Reprend une partie abandonnée : **efface l'abandon** et la rend en cours.
 *
 * Elle n'existe que pour une partie abandonnée. Une partie régulièrement
 * terminée ne se rouvre pas : vouloir continuer au-delà du seuil, c'est vouloir
 * changer le seuil, et l'instantané de règles est figé à la création exprès.
 *
 * **Le gel survit.** Rien ici ne touche aux manches, et le gel se déduit de leur
 * existence : la tablée d'une partie reprise est celle qu'elle avait en
 * s'arrêtant, ce qui est la seule lecture honnête d'une soirée qu'on rallume.
 *
 * **Idempotente** : reprendre une partie que quelqu'un vient de reprendre ne
 * fait rien et n'annonce rien — la partie est ouverte, c'est ce que les deux
 * voulaient. La seconde n'écrit alors pas de ligne, sans quoi le journal
 * raconterait deux réouvertures là où il n'y en a eu qu'une.
 *
 * @throws {@link RefusDeCycle} si l'agissant n'est pas de la tablée.
 * @throws {@link RepriseImpossible} si la partie est en cours, ou terminée.
 */
export async function reprendreLaPartie(
  base: Base,
  partieId: number,
  brut: unknown,
): Promise<void> {
  const agissant = agissantSchema.parse(brut);

  await base.transaction(async (tx) => {
    await exigerUnParticipant(tx, partieId, agissant);
    await exigerUnePartieAbandonnee(tx, partieId);

    if (!(await effacerLaFin(tx, partieId))) {
      return;
    }

    await consignerUnGesteDePartie(tx, { partieId, geste: "reprise", agissant });
  });
}
