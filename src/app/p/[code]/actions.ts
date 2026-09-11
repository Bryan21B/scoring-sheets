"use server";

import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { db } from "@/db";
import { NOM_COOKIE_APPAREIL } from "@/lib/appareil/cookie";
import { lireLeJoueurDeLAppareil } from "@/lib/appareil/lecture";
import type { Agissant } from "@/lib/journal/ligne";
import { type EtatDeCloture, finAAnnoncer, refusAMontrer } from "@/lib/manche/annonce";
import { CLOTURE_HORS_TABLEE, cloturerLaManche } from "@/lib/manche/cloture";
import { suiteDuGeste } from "@/lib/manche/gestes";
import { ouvrirLaMancheSuivante } from "@/lib/manche/ouverture";
import { type RefusDEcriture, refusDe } from "@/lib/manche/refus";
import { ecrireLaCase } from "@/lib/manche/saisie";
import { adresseDePartie } from "@/lib/partie/adresse";
import {
  abandonnerLaPartie,
  RefusDeCycle,
  reprendreLaPartie,
  supprimerLaPartie,
} from "@/lib/partie/cycle";
import { PartieScellee, RepriseImpossible } from "@/lib/partie/fin";
import type { VueDePartie } from "@/lib/partie/lecture";
import { lirePartieParCode } from "@/lib/partie/lecture";
import { PAS_DE_LA_PARTIE } from "@/lib/partie/salle-attente";
import type { JoueurConnu } from "@/lib/roster/noms";

/** La partie que ce code désigne, ou un 404 : le code **est** l'adresse. */
async function exigerLaPartie(code: string): Promise<VueDePartie> {
  const partie = await lirePartieParCode(db, code);

  if (partie === null) {
    notFound();
  }

  return partie;
}

/**
 * Ouvre — ou **rejoint** — la manche suivante, et emmène sur sa saisie.
 *
 * Aucune clé d'idempotence n'est fabriquée ici : deux téléphones qui appuient
 * en même temps ont lu le même plus grand numéro, l'unicité `(partie, numéro)`
 * fait le reste, et les deux atterrissent sur la même adresse. C'est le
 * résultat que les deux voulaient, pas une erreur à montrer à l'un d'eux.
 *
 * `redirect` fonctionne en levant : il est appelé hors de tout `try`.
 */
export async function ouvrirLaMancheSuivanteAction(code: string): Promise<void> {
  const partie = await exigerLaPartie(code);
  const ouverte = await ouvrirLaMancheSuivante(db, partie.id);

  redirect(`/p/${partie.code}/manche/${ouverte.numero}`);
}

/**
 * Écrit une case : le refus **reste à l'écran**, le succès emmène au
 * récapitulatif.
 *
 * Le joueur agissant se résout **ici**, du cookie, et jamais du formulaire :
 * c'est ce qui empêche un envoi de désigner quelqu'un d'autre comme auteur de
 * sa ligne de journal. L'appareil part à côté, et le journal fige les deux.
 *
 * Elle **rend** le refus au lieu de rediriger dessus : le récapitulatif montre
 * bien l'état vrai, mais il ne montre pas le recul — et c'est le recul qui doit
 * être compris. La valeur arrivée revient donc là où l'on tapait, sans
 * navigation, avec la valeur tapée pour la reposer d'un appui.
 *
 * Une **désignation** renvoie à la passe avant plutôt qu'au récapitulatif :
 * « les désignations d'abord, puis les valeurs » ne tient que si le sorti nommé
 * appelle son total, et une manche d'Uno se saisit en deux gestes. La décision
 * est dans `suiteDuGeste`, pure et vérifiée à part ; la page qui ne trouve plus
 * rien à demander renvoie d'elle-même au récapitulatif.
 *
 * La forme est celle que `useActionState` attend, l'état précédent en premier
 * paramètre après ce que la page a lié. Il n'est pas lu : chaque envoi porte sa
 * propre condition dans ses champs cachés, et l'état d'avant ne rejuge rien.
 *
 * Le joueur que la case concerne voyage **avec le refus** : l'écran de
 * désignation n'a pas de case à lui avant d'en poser une, et ne saurait donc
 * pas de qui le refus parle. Il se relit de la tablée que la page tient déjà,
 * jamais du nom qu'un formulaire aurait envoyé.
 *
 * @throws si l'appareil ne se déclare **aucun** joueur. La passe avant s'ouvre
 * quand même à un tel appareil — elle démarre alors sur la première case
 * manquante, c'est le contrat — mais elle ne peut pas valider : le journal fige
 * un joueur agissant, et une ligne sans lui n'existe pas. Ce qui manque ici est
 * l'écran « qui es-tu ? » de l'arrivée par le code, qui lie l'appareil à un
 * joueur ; il a son ticket, et le fabriquer ici inventerait une identité.
 */
export async function ecrireLaCaseAction(
  retour: { code: string; numero: number },
  _precedent: RefusDEcriture | null,
  formulaire: FormData,
): Promise<RefusDEcriture | null> {
  const partie = await exigerLaPartie(retour.code);
  const bocal = await cookies();
  const idAppareil = bocal.get(NOM_COOKIE_APPAREIL)?.value;
  const joueurAgissantId = await lireLeJoueurDeLAppareil(db, idAppareil);

  if (joueurAgissantId === null) {
    throw new Error("Cet appareil ne se déclare aucun joueur : il n'y a personne pour écrire.");
  }

  const joueurConcerneId = formulaire.get("joueurConcerneId");
  const resultat = await ecrireLaCase(db, {
    mancheId: formulaire.get("mancheId"),
    joueurConcerneId,
    valeurMontree: formulaire.get("valeurMontree"),
    valeur: formulaire.get("valeur"),
    agissant: { joueurId: joueurAgissantId, appareilId: idAppareil ?? null },
  });

  if (resultat.statut === "refusee") {
    return refusDe(resultat, concerne(partie, joueurConcerneId));
  }

  const manche = `/p/${partie.code}/manche/${retour.numero}`;

  redirect(
    suiteDuGeste(partie.regles, resultat.valeur) === "passeAvant"
      ? manche
      : `${manche}/recapitulatif`,
  );
}

/**
 * Le participant que cette case concerne, relu de la tablée.
 *
 * `ecrireLaCase` a déjà refusé un joueur étranger à la partie quand cette
 * fonction s'exécute : elle ne garde donc aucune garde, et lever ici serait
 * doubler une frontière qui a déjà tranché. Elle ne sert qu'à **nommer** —
 * l'écran de refus dit « la case de Paul », et un identifiant nu ne se lit pas.
 */
function concerne(partie: VueDePartie, joueurConcerneId: FormDataEntryValue | null): JoueurConnu {
  const trouve = partie.participants.find(
    (participant) => String(participant.id) === String(joueurConcerneId),
  );

  if (trouve === undefined) {
    throw new Error(`Le joueur ${joueurConcerneId} n'est pas de la partie ${partie.code}.`);
  }

  return trouve;
}

/**
 * Clôt une manche : la **déclaration** qu'elle est finie, et la confirmation de
 * fin de partie s'il y a une fin à confirmer.
 *
 * Le joueur qui clôt se résout **ici**, du cookie, et jamais du formulaire :
 * `manche.close_par` et `partie.fin_par` se gravent, et laisser un envoi les
 * désigner reviendrait à laisser signer la fin d'une soirée au nom d'un autre.
 *
 * Elle ne rend un état que lorsqu'il y a quelque chose à dire — la partie vient
 * de finir, ou la clôture est refusée. Une clôture qui ne termine rien renvoie
 * à la partie, d'où part la manche suivante : il n'y a pas de second écran
 * « voulez-vous terminer », quelqu'un vient déjà d'agir.
 *
 * `redirect` fonctionne en levant : il est appelé hors de tout `try`.
 *
 * @throws ce que la clôture lève et qui n'est pas écrit pour être lu — une
 * manche disparue, une contrainte : cela remonte à la frontière d'erreur au
 * lieu d'être recopié à la table.
 */
export async function cloturerLaMancheAction(
  code: string,
  _precedent: EtatDeCloture,
  formulaire: FormData,
): Promise<EtatDeCloture> {
  const partie = await exigerLaPartie(code);
  const bocal = await cookies();
  const joueurId = await lireLeJoueurDeLAppareil(db, bocal.get(NOM_COOKIE_APPAREIL)?.value);

  // Ne s'être choisi personne et s'être choisi quelqu'un d'une autre soirée
  // sont la même situation vue de la partie : on n'est pas de la tablée.
  if (joueurId === null) {
    return { statut: "refusee", message: CLOTURE_HORS_TABLEE };
  }

  let annonce: EtatDeCloture;

  try {
    annonce = finAAnnoncer(
      await cloturerLaManche(db, {
        mancheId: formulaire.get("mancheId"),
        parJoueurId: joueurId,
      }),
    );
  } catch (erreur) {
    annonce = refusAMontrer(erreur);

    if (annonce === null) {
      throw erreur;
    }
  }

  if (annonce !== null) {
    return annonce;
  }

  redirect(adresseDePartie(partie.code));
}

/**
 * Le cadre commun aux trois gestes du cycle de vie : qui agit, et où l'on va.
 *
 * Le joueur agissant se résout **ici**, du cookie, et jamais du formulaire :
 * `partie.fin_par` se grave et la ligne de journal fige son auteur — laisser un
 * envoi les désigner reviendrait à signer l'arrêt d'une soirée au nom d'un
 * autre. L'appareil part à côté, parce que le joueur seul ne distingue pas deux
 * téléphones qui se déclarent la même personne.
 *
 * Un appareil qui ne se déclare **aucun** joueur reçoit la phrase du
 * spectateur : ne s'être choisi personne et s'être choisi quelqu'un d'une autre
 * soirée sont la même situation vue de la partie.
 *
 * `redirect` est appelé **hors** du `try` : il fonctionne en levant, et
 * l'attraper transformerait chaque navigation réussie en erreur.
 */
async function agirSurLeCycle(
  code: string,
  geste: (partieId: number, agissant: Agissant) => Promise<void>,
  apres: (code: string) => string,
): Promise<void> {
  const partie = await exigerLaPartie(code);
  const bocal = await cookies();
  const idAppareil = bocal.get(NOM_COOKIE_APPAREIL)?.value;
  const joueurId = await lireLeJoueurDeLAppareil(db, idAppareil);
  let destination: string;

  if (joueurId === null) {
    return redirect(avecRefus(partie.code, PAS_DE_LA_PARTIE));
  }

  try {
    await geste(partie.id, { joueurId, appareilId: idAppareil ?? null });
    destination = apres(partie.code);
  } catch (erreur) {
    destination = avecRefus(partie.code, refusDuCycle(erreur));
  }

  redirect(destination);
}

/**
 * L'adresse de la partie, avec la phrase à afficher au-dessus.
 *
 * Le refus **revient sur la partie** plutôt que de disparaître : les deux
 * écrans de `/p/<code>` savent le montrer, et c'est précisément quand la partie
 * vient de changer d'état sous un autre téléphone qu'il explique quelque chose.
 */
function avecRefus(code: string, message: string): string {
  return `${adresseDePartie(code)}?${new URLSearchParams({ erreur: message }).toString()}`;
}

/**
 * Ce qui s'affiche quand un geste du cycle de vie est refusé.
 *
 * Les trois classes qui se montrent, et rien d'autre : `RefusDeCycle` pour le
 * spectateur et le journal non vide, `PartieScellee` et `RepriseImpossible`
 * pour les deux sens de la fin. Tout le reste est interne — un rapport de champs
 * Zod, une contrainte SQLite — et l'afficher n'aiderait personne tout en
 * racontant la base.
 */
function refusDuCycle(erreur: unknown): string {
  return erreur instanceof RefusDeCycle ||
    erreur instanceof PartieScellee ||
    erreur instanceof RepriseImpossible
    ? erreur.message
    : "Le geste n’a pas abouti. Recharge la partie et recommence.";
}

/**
 * Abandonne la partie : elle quitte l'accueil, et son journal reste.
 *
 * Le retour se fait sur `/p/<code>`, qui montre désormais la fiche de la partie
 * scellée — d'où part la reprise, si quelqu'un s'est trompé de bouton.
 */
export async function abandonnerLaPartieAction(code: string): Promise<void> {
  await agirSurLeCycle(
    code,
    async (partieId, agissant) => {
      await abandonnerLaPartie(db, partieId, agissant);
    },
    (code) => adresseDePartie(code),
  );
}

/** Reprend une partie abandonnée : elle redevient la soirée en cours. */
export async function reprendreLaPartieAction(code: string): Promise<void> {
  await agirSurLeCycle(
    code,
    async (partieId, agissant) => {
      await reprendreLaPartie(db, partieId, agissant);
    },
    (code) => adresseDePartie(code),
  );
}

/**
 * Supprime une partie dont le journal est vide, et rentre à l'accueil.
 *
 * L'accueil et non la partie : il n'y a plus de partie à cette adresse, et y
 * revenir donnerait un 404 pour toute confirmation.
 */
export async function supprimerLaPartieAction(code: string): Promise<void> {
  await agirSurLeCycle(
    code,
    async (partieId, agissant) => {
      await supprimerLaPartie(db, partieId, agissant);
    },
    () => "/",
  );
}
