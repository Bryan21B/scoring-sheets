"use server";

import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { db } from "@/db";
import { NOM_COOKIE_APPAREIL } from "@/lib/appareil/cookie";
import { lireLeJoueurDeLAppareil } from "@/lib/appareil/lecture";
import { type EtatDeCloture, finAAnnoncer, refusAMontrer } from "@/lib/manche/annonce";
import { CLOTURE_HORS_TABLEE, cloturerLaManche } from "@/lib/manche/cloture";
import { ouvrirLaMancheSuivante } from "@/lib/manche/ouverture";
import { type RefusDEcriture, refusDe } from "@/lib/manche/refus";
import { ecrireLaCase } from "@/lib/manche/saisie";
import { adresseDePartie } from "@/lib/partie/adresse";
import type { VueDePartie } from "@/lib/partie/lecture";
import { lirePartieParCode } from "@/lib/partie/lecture";

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
 * La forme est celle que `useActionState` attend, l'état précédent en premier
 * paramètre après ce que la page a lié. Il n'est pas lu : chaque envoi porte sa
 * propre condition dans ses champs cachés, et l'état d'avant ne rejuge rien.
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

  const refus = refusDe(
    await ecrireLaCase(db, {
      mancheId: formulaire.get("mancheId"),
      joueurConcerneId: formulaire.get("joueurConcerneId"),
      valeurMontree: formulaire.get("valeurMontree"),
      valeur: formulaire.get("valeur"),
      agissant: { joueurId: joueurAgissantId, appareilId: idAppareil ?? null },
    }),
  );

  if (refus !== null) {
    return refus;
  }

  redirect(`/p/${partie.code}/manche/${retour.numero}/recapitulatif`);
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
