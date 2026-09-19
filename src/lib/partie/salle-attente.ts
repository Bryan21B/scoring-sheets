import { and, eq, isNull } from "drizzle-orm";
import { z } from "zod";
import type { Base, Ecriture, Lecture } from "@/db/base";
import { appareil, joueur, manche, participant } from "@/db/schema";
import { idAppareilSchema } from "@/lib/appareil/cookie";
import { lierLAppareil } from "@/lib/appareil/lien";
import { consignerUnMouvementDeParticipant, type LigneDeParticipant } from "@/lib/journal/ligne";
import { journalEstVide } from "@/lib/partie/cycle";
import { exigerUnePartieOuverte } from "@/lib/partie/fin";
import { identiteSchema } from "@/lib/partie/identite";
import { assurerLeJoueur, resoudreIdentite } from "@/lib/roster/choix";
import type { Homonymie, JoueurConnu } from "@/lib/roster/noms";

/**
 * Ce que la salle d'attente sait de celui qui vient d'ouvrir le lien.
 *
 * Trois états et pas quatre : « déjà dedans », « on te reconnaît, tu n'es pas
 * dedans », « on ne te connaît pas ». Le quatrième qu'on serait tenté d'écrire
 * — « spectateur » — n'existe pas comme état : c'est ce que devient
 * {@link Arrivee.statut} `propose` quand la partie est gelée, et rien d'autre.
 */
export type Arrivee =
  | { statut: "participant"; joueur: JoueurConnu }
  | { statut: "propose"; joueur: JoueurConnu }
  | { statut: "inconnu" };

/** L’état de la partie du point de vue de l’arrivant : qui il est, et si c’est encore ouvert. */
export type EtatDeSalle = {
  /** La liste est fermée dès qu'une manche existe. Voir {@link estGelee}. */
  gelee: boolean;
  arrivee: Arrivee;
};

/**
 * Celui qui arrive est-il **de la partie** ?
 *
 * La ligne que le code seul ne franchit pas : le code donne la lecture,
 * l'écriture demande d'être participant. Nommée ici plutôt que recopiée dans
 * chaque écran qui offre un geste — trois copies divergent le jour où l'une est
 * corrigée seule, et l'écart ne se voit qu'à l'écran.
 *
 * `propose` n'en est pas : la proposition est **armée et non inscrite**, et
 * c'est précisément ce qui rend le spectateur possible.
 */
export function estDeLaPartie(salle: EtatDeSalle): boolean {
  return salle.arrivee.statut === "participant";
}

/**
 * La liste des participants est-elle fermée ?
 *
 * **Déduit de l'existence d'une manche**, jamais stocké : il n'y a pas de
 * bouton « démarrer », et une colonne d'état se désaccorderait de la réalité le
 * jour où une manche est supprimée — ce qui est précisément le geste qui dégèle.
 */
export async function estGelee(base: Lecture, partieId: number): Promise<boolean> {
  const [premiere] = await base
    .select({ id: manche.id })
    .from(manche)
    .where(eq(manche.partieId, partieId))
    .limit(1);

  return premiere !== undefined;
}

/**
 * Qui l'appareil dit être, et si cette personne est déjà de la partie.
 *
 * Le lien appareil → joueur est **global** : il se lit sans rien savoir de la
 * partie, et c'est ce qui fait qu'on ne repose jamais « qui es-tu ? » d'une
 * soirée à l'autre. La partie n'intervient qu'ensuite, pour dire si ce joueur y
 * a une place.
 *
 * Un participant **retiré** ne compte pas comme une place : son appareil
 * revient à l'état « peut rejoindre », sans que le lien global bouge.
 *
 * Tolère l'absence d'appareil : le cookie est posé par le proxy, jamais par la
 * page — Next refuse d'en écrire un hors action — et une requête peut donc
 * arriver ici sans lui.
 */
async function lireArrivee(
  base: Lecture,
  partieId: number,
  idAppareil: string | undefined,
): Promise<Arrivee> {
  if (idAppareil === undefined) {
    return { statut: "inconnu" };
  }

  const [reconnu] = await base
    .select({ id: joueur.id, nom: joueur.nom })
    .from(appareil)
    .innerJoin(joueur, eq(joueur.id, appareil.joueurId))
    .where(eq(appareil.id, idAppareil))
    .limit(1);

  if (reconnu === undefined) {
    return { statut: "inconnu" };
  }

  return {
    statut: (await estParticipant(base, partieId, reconnu.id)) ? "participant" : "propose",
    joueur: reconnu,
  };
}

/**
 * Tout ce que l'écran d'une partie doit savoir avant de proposer quoi que ce
 * soit : est-ce encore ouvert, et qui arrive.
 *
 * Ne prend **aucune décision d'écriture** et n'en fait aucune : la proposition
 * « Rejoindre en tant que Marie » est pré-sélectionnée et **non inscrite**, et
 * c'est cette lecture sans effet qui rend le spectateur possible.
 */
export async function lireSalleDAttente(
  base: Base,
  partieId: number,
  idAppareil: string | undefined,
): Promise<EtatDeSalle> {
  return {
    gelee: await estGelee(base, partieId),
    arrivee: await lireArrivee(base, partieId, idAppareil),
  };
}

/**
 * Ce que l'écran d'arrivée envoie : de quel appareil, et qui il se déclare.
 *
 * Strict, comme la création : un champ inattendu est un formulaire qui a dérivé
 * de son action, et le refuser vaut mieux que l'ignorer.
 */
export const arriveeSchema = z.strictObject({
  idAppareil: idAppareilSchema,
  identite: identiteSchema,
});

/**
 * Le même schéma sert à l'ajout d'un joueur sans téléphone : l'envoi a la même
 * forme, et seul le geste diffère — là-bas l'identité est celle de l'appareil,
 * ici celle de quelqu'un d'autre, et c'est l'écriture qui en tire les
 * conséquences en ne repointant pas l'appareil.
 */

/**
 * Ce que l'arrivée rend.
 *
 * **Deux gestes distincts**, et c'est le gel qui les sépare : *rejoindre*
 * ajoute un participant et devient interdit dès la première manche ; *réclamer*
 * n'ajoute personne — l'appareil se lie à une place déjà là — et reste donc
 * permis sur une partie gelée. Sans cette distinction, Paul, ajouté par Marie à
 * la création puis ouvrant le lien après la manche 1, serait spectateur de sa
 * propre partie.
 */
export type ResultatDArrivee =
  | { statut: "rejoint"; joueurId: number }
  | { statut: "reclame"; joueurId: number }
  | Homonymie;

/**
 * Un refus **écrit pour être lu** au-dessus de l'écran d'arrivée.
 *
 * Il sépare ce qui se montre — « la partie a commencé » — de ce qui ne regarde
 * que le serveur : « aucun joueur 404 au roster » vient d'un envoi forgé,
 * n'aide personne et raconte la base.
 */
export class RefusDArrivee extends Error {
  override readonly name = "RefusDArrivee";
}

/** La phrase du gel, la seule que la salle d'attente ait à dire. */
const PARTIE_COMMENCEE =
  "La partie a commencé : la liste des joueurs est fermée. Supprime la manche 1 pour l’ouvrir à nouveau.";

/**
 * Ce joueur a-t-il une place **vivante** dans cette partie ?
 *
 * « Vivante » exclut le participant retiré : sa ligne reste — c'est ce qui
 * garde ses valeurs et lui permet de revenir sans se dédoubler — mais il n'est
 * plus de la partie, et son appareil revient donc à l'état « peut rejoindre ».
 *
 * Exportée parce que **les gestes du cycle de vie posent la même question** :
 * abandonner, reprendre et supprimer demandent d'être de la tablée, exactement
 * comme la salle d'attente. Une seconde lecture écrite là-bas divergerait de
 * celle-ci le jour où « vivante » gagne une nuance.
 */
export async function estParticipant(
  base: Lecture,
  partieId: number,
  joueurId: number,
): Promise<boolean> {
  const [place] = await base
    .select({ id: participant.id })
    .from(participant)
    .where(
      and(
        eq(participant.partieId, partieId),
        eq(participant.joueurId, joueurId),
        isNull(participant.retireLe),
      ),
    )
    .limit(1);

  return place !== undefined;
}

/**
 * Consigne un mouvement de tablée **si le journal a déjà une histoire**.
 *
 * La règle de la spec, tenue à un seul endroit : « journal non vide, on
 * journalise ». Tant qu'il est vide, bouger la liste *est* la salle d'attente —
 * rien n'a été marqué, il n'y a aucune conséquence à tracer, et la partie se
 * supprime encore. Une fois qu'il porte une ligne, la même liste qui bouge
 * devient une correction de l'histoire, et le taire ferait apparaître Paul dans
 * la manche 2 sans que rien ne dise quand il est arrivé.
 *
 * La condition se lit **dans le journal lui-même** plutôt que dans un état « la
 * partie a commencé » : supprimer la manche 1 dégèle la liste sans vider le
 * journal, et c'est exactement le cas que cette fonction existe pour couvrir.
 * Voir `docs/specs/2026-09-09-journal.md`.
 *
 * `journalEstVide` vient de `cycle.ts`, qui la pose déjà pour la suppression de
 * partie : deux lectures de la même question divergeraient le jour où l'une est
 * corrigée seule. La ligne, elle, est une {@link LigneDeParticipant} — celle du
 * module qui l'écrit, jamais une forme recopiée ici.
 */
async function consignerSiLHistoireACommence(
  tx: Ecriture,
  ligne: LigneDeParticipant,
): Promise<void> {
  if (await journalEstVide(tx, ligne.partieId)) {
    return;
  }

  await consignerUnMouvementDeParticipant(tx, ligne);
}

/**
 * Inscrit un joueur, ou rend sa place à celui qui s'était retiré.
 *
 * `onConflictDoUpdate` et non une insertion sèche : l'unicité `(partie,
 * joueur)` porte aussi les participants retirés, dont la ligne reste pour que
 * leurs valeurs déjà saisies ne bougent pas. Revenir dans la partie est donc un
 * `retire_le` remis à `null`, jamais une deuxième ligne.
 */
async function inscrire(tx: Ecriture, partieId: number, joueurId: number): Promise<void> {
  await tx
    .insert(participant)
    .values({ partieId, joueurId })
    .onConflictDoUpdate({
      target: [participant.partieId, participant.joueurId],
      set: { retireLe: null },
    });
}

/**
 * Entre dans une partie depuis son code : on s'ajoute, ou on réclame sa place.
 *
 * C'est la **seule écriture que le code seul autorise**, et elle est bornée par
 * le gel : ailleurs, écrire demande d'être participant. Sans elle il n'y aurait
 * aucune façon d'en devenir un.
 *
 * L'ordre des gestes est la garantie que « refusé » veut dire « rien n'a
 * bougé » : la validation, la résolution de l'identité contre le roster, puis
 * le gel — et seulement ensuite la moindre écriture. Un nom neuf tapé sur une
 * partie commencée ne laisse donc pas un joueur orphelin au roster.
 *
 * **L'arrivée se journalise dès que le journal est non vide**, et pas avant.
 * Le cas n'est pas théorique : supprimer la manche 1 **dégèle** la liste sans
 * vider le journal, si bien qu'une manche 1 ressaisie à six joueurs au lieu de
 * cinq doit porter une ligne disant que Paul est arrivé. Voir
 * {@link consignerSiLHistoireACommence}, qui tient la condition.
 *
 * **Réclamer n'écrit rien** : l'appareil se lie à une place déjà là, la tablée
 * ne bouge pas, et « Paul est arrivé » serait faux. Seul *rejoindre* ajoute
 * quelqu'un, donc seul lui laisse une trace.
 *
 * Celui qui arrive est **sa propre main** : personne d'autre n'a appuyé, et
 * c'est la seule des trois écritures de ce module où l'agissant et le concerné
 * sont le même joueur.
 *
 * @throws {@link PartieScellee} si la partie porte une fin — scellée, elle ne
 * bouge plus, et le dire vaut mieux que de parler d'une manche 1 à supprimer qui
 * ne se supprimera jamais.
 * @throws {@link RefusDArrivee} si la partie est gelée et que le joueur n'y a
 * pas déjà de place. Une `ZodError` ou une `Error` nue pour tout le reste :
 * cookie malformé, joueur inexistant, base qui ne répond pas.
 */
export async function rejoindrePartie(
  base: Base,
  partieId: number,
  saisie: unknown,
): Promise<ResultatDArrivee> {
  const donnees = arriveeSchema.parse(saisie);
  const choix = await resoudreIdentite(base, donnees.identite);

  if (choix.statut === "desambiguiser") {
    return choix;
  }

  const maintenant = new Date();

  return base.transaction(async (tx) => {
    await exigerUnePartieOuverte(tx, partieId);

    const reclame =
      choix.statut === "connu" && (await estParticipant(tx, partieId, choix.joueurId));

    if (!reclame && (await estGelee(tx, partieId))) {
      throw new RefusDArrivee(PARTIE_COMMENCEE);
    }

    const joueurId = await assurerLeJoueur(tx, choix, maintenant);

    await lierLAppareil(tx, donnees.idAppareil, joueurId, maintenant);

    if (reclame) {
      return { statut: "reclame", joueurId };
    }

    await inscrire(tx, partieId, joueurId);

    await consignerSiLHistoireACommence(tx, {
      partieId,
      geste: "participantAjoute",
      joueurConcerneId: joueurId,
      agissant: { joueurId, appareilId: donnees.idAppareil },
    });

    return { statut: "rejoint", joueurId };
  });
}

/** Ce que l'ajout rend. « Déjà là » n'est pas une erreur : la liste est bonne. */
export type ResultatDAjout =
  | { statut: "ajoute"; joueurId: number }
  | { statut: "dejaLa"; joueurId: number }
  | Homonymie;

/**
 * Ce qu'on dit à qui a le code sans jouer — au bandeau comme au refus.
 *
 * Une seule phrase pour les deux : l'écran l'affiche d'avance, le serveur la
 * renvoie si l'écriture arrive quand même. Deux formulations feraient croire à
 * deux situations différentes.
 */
export const PAS_DE_LA_PARTIE = "Tu regardes cette partie, tu n’y joues pas.";

/**
 * Exige que l'appareil agissant soit celui d'un participant vivant.
 *
 * C'est la ligne que le code seul ne franchit pas : **le code donne la lecture,
 * l'écriture demande d'être participant**. Le lien appareil → joueur reste une
 * déclaration et non une preuve — entre amis, ce qu'on arrête ici est un
 * spectateur qui touche à la liste, pas une fraude.
 *
 * Rend le joueur agissant, que la ligne de journal **fige** : le relire plus
 * tard depuis l'appareil réécrirait l'histoire de ce téléphone à chaque fois
 * qu'il se repointe.
 *
 * @throws {@link RefusDArrivee} si l'appareil n'est de la partie.
 */
async function exigerUneMainDeLaPartie(
  tx: Ecriture,
  partieId: number,
  idAppareil: string,
): Promise<number> {
  const [place] = await tx
    .select({ joueurId: participant.joueurId })
    .from(participant)
    .innerJoin(appareil, eq(appareil.joueurId, participant.joueurId))
    .where(
      and(
        eq(participant.partieId, partieId),
        isNull(participant.retireLe),
        eq(appareil.id, idAppareil),
      ),
    )
    .limit(1);

  if (place === undefined) {
    throw new RefusDArrivee(PAS_DE_LA_PARTIE);
  }

  return place.joueurId;
}

/**
 * Ajoute à la tablée quelqu'un qui n'a pas de téléphone.
 *
 * C'est le mode **« un seul téléphone au milieu de la table »**, pris en charge
 * de plein droit : le participant ajouté n'a aucun lien vers un appareil, et il
 * réclamera sa place s'il ouvre le lien plus tard. L'appareil de celui qui
 * ajoute, lui, ne bouge pas — sans quoi Marie saisirait la soirée sous le nom
 * de Paul.
 *
 * Il n'y a **pas de rôle de créateur** : n'importe quel participant ajoute,
 * comme n'importe lequel saisit n'importe quelle case. Inventer un rôle ici en
 * créerait un pour une seule fonctionnalité.
 *
 * **L'ajout se consigne dès que le journal est non vide**, l'agissant étant
 * celui qui tient le téléphone et le concerné celui qu'on assoit — voir
 * {@link consignerSiLHistoireACommence}. « Déjà là » n'écrit rien : la liste
 * n'a pas bougé.
 *
 * @throws {@link PartieScellee} si la partie porte une fin.
 * @throws {@link RefusDArrivee} si la partie est gelée, ou si l'appareil n'est
 * pas celui d'un participant.
 */
export async function ajouterParticipant(
  base: Base,
  partieId: number,
  saisie: unknown,
): Promise<ResultatDAjout> {
  const donnees = arriveeSchema.parse(saisie);
  const choix = await resoudreIdentite(base, donnees.identite);

  if (choix.statut === "desambiguiser") {
    return choix;
  }

  const maintenant = new Date();

  return base.transaction(async (tx) => {
    const agissantId = await exigerUneMainDeLaPartie(tx, partieId, donnees.idAppareil);

    await exigerUnePartieOuverte(tx, partieId);

    // « Déjà là » ne bouge pas la liste, donc n'écrit pas de ligne : la tablée
    // est celle qu'on voulait, et annoncer une arrivée serait faux.
    if (choix.statut === "connu" && (await estParticipant(tx, partieId, choix.joueurId))) {
      return { statut: "dejaLa", joueurId: choix.joueurId };
    }

    if (await estGelee(tx, partieId)) {
      throw new RefusDArrivee(PARTIE_COMMENCEE);
    }

    const joueurId = await assurerLeJoueur(tx, choix, maintenant);

    await inscrire(tx, partieId, joueurId);

    await consignerSiLHistoireACommence(tx, {
      partieId,
      geste: "participantAjoute",
      joueurConcerneId: joueurId,
      agissant: { joueurId: agissantId, appareilId: donnees.idAppareil },
    });

    return { statut: "ajoute", joueurId };
  });
}

/**
 * Ce que le retrait envoie : de quel appareil, et qui s'en va.
 *
 * Coercitif sur `joueurId` parce que sa source est un champ caché de
 * formulaire, qui n'envoie jamais que des chaînes.
 */
export const retraitSchema = z.strictObject({
  idAppareil: idAppareilSchema,
  joueurId: z.coerce.number().int().positive(),
});

/**
 * Retire quelqu'un de la tablée, tant que la partie n'a pas commencé.
 *
 * Le participant **garde sa ligne**, marquée d'un `retire_le` : c'est ce qui
 * permet de revenir sans se dédoubler, et c'est la même colonne qui, après le
 * gel, laissera ses valeurs déjà saisies en place. Ici il n'y en a aucune — la
 * salle d'attente est justement l'état où rien n'a encore été marqué.
 *
 * **Le lien appareil → joueur n'est pas touché.** Partir d'une partie n'est pas
 * cesser d'être Zoé : son appareil revient simplement à l'état « peut
 * rejoindre », et la partie suivante ne lui redemandera pas qui elle est.
 *
 * N'importe quel participant retire n'importe lequel, y compris celui qui n'a
 * pas de téléphone pour le faire lui-même — c'est le pendant de l'ajout, et
 * sans lui le mode « un seul téléphone » n'aurait pas de marche arrière.
 *
 * Retirer quelqu'un qui n'est déjà plus là ne fait rien, ligne de journal
 * comprise : la liste est celle qu'on voulait, il n'y a rien à annoncer.
 *
 * **Le geste se consigne dès que le journal est non vide.** Ce n'est pas une
 * contradiction avec « ici il n'y a aucune valeur saisie » : supprimer la
 * manche 1 dégèle la liste sans vider le journal, et c'est précisément là que
 * la trace compte. Voir {@link consignerSiLHistoireACommence}.
 *
 * @throws {@link PartieScellee} si la partie porte une fin.
 * @throws {@link RefusDArrivee} si la partie est gelée, ou si l'appareil n'est
 * pas celui d'un participant.
 */
export async function retirerParticipant(
  base: Base,
  partieId: number,
  saisie: unknown,
): Promise<void> {
  const donnees = retraitSchema.parse(saisie);
  const maintenant = new Date();

  await base.transaction(async (tx) => {
    const agissantId = await exigerUneMainDeLaPartie(tx, partieId, donnees.idAppareil);

    await exigerUnePartieOuverte(tx, partieId);

    if (await estGelee(tx, partieId)) {
      throw new RefusDArrivee(PARTIE_COMMENCEE);
    }

    const bouges = await tx
      .update(participant)
      .set({ retireLe: maintenant })
      .where(
        and(
          eq(participant.partieId, partieId),
          eq(participant.joueurId, donnees.joueurId),
          isNull(participant.retireLe),
        ),
      )
      .returning({ id: participant.id });

    // Personne n'a bougé : il était déjà parti, la liste est celle qu'on
    // voulait, et une seconde ligne raconterait deux retraits pour un seul.
    // C'est le zéro ligne touchée qui le dit, et non une relecture préalable —
    // deux téléphones qui appuient ensemble ont tous les deux vu Paul à table.
    if (bouges.length === 0) {
      return;
    }

    await consignerSiLHistoireACommence(tx, {
      partieId,
      geste: "participantRetire",
      joueurConcerneId: donnees.joueurId,
      agissant: { joueurId: agissantId, appareilId: donnees.idAppareil },
    });
  });
}
