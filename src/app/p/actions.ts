"use server";

import { redirect } from "next/navigation";
import { db } from "@/db";
import type { IdAppareil } from "@/lib/appareil/cookie";
import { assurerLAppareil, cleDeLaRequete } from "@/lib/appareil/requete";
import { adresseDuCodeTape } from "@/lib/partie/adresse";
import { lireIdentiteDuFormulaire } from "@/lib/partie/identite";
import { chercherPartieParCode, limiteDeRecherche } from "@/lib/partie/recherche";
import {
  ajouterParticipant,
  RefusDArrivee,
  rejoindrePartie,
  retirerParticipant,
} from "@/lib/partie/salle-attente";
import type { Homonymie } from "@/lib/roster/noms";

/**
 * Ce qui s'affiche quand une action de la salle d'attente est refusée.
 *
 * **Seul un {@link RefusDArrivee} se montre** : c'est le type qui dit « cette
 * phrase est écrite pour être lue ». Tout le reste est interne — un rapport de
 * champs Zod, « aucun joueur 404 au roster », une contrainte SQLite — et
 * l'afficher n'aiderait personne tout en racontant la base.
 */
function messageDeRefus(erreur: unknown): string {
  return erreur instanceof RefusDArrivee
    ? erreur.message
    : "Le geste n’a pas abouti. Recharge la partie et recommence.";
}

/** La question de l'homonyme, posée là où la liste est déjà sous les yeux. */
function messageDHomonyme(homonymie: Homonymie): string {
  return `${homonymie.nom} existe déjà. Si c’est elle, prends-la dans la liste ; sinon, donne un nom distinctif.`;
}

/** L'adresse de la partie, avec la phrase à afficher au-dessus. */
function retourALaPartie(code: string, message?: string): string {
  const adresse = adresseDuCodeTape(code) ?? "/";

  return message === undefined
    ? adresse
    : `${adresse}?${new URLSearchParams({ erreur: message }).toString()}`;
}

/**
 * Le cadre commun aux trois actions : l'appareil, la partie visée, le refus.
 *
 * La recherche passe par {@link chercherPartieParCode} et non par une lecture
 * directe : sinon une action d'écriture serait un **deuxième chemin non
 * limité** pour découvrir une partie, et la limite posée sur la lecture ne
 * vaudrait plus rien.
 *
 * `redirect` est appelé **hors** du `try` : il fonctionne en levant, et
 * l'attraper transformerait chaque navigation réussie en erreur.
 */
async function agirSurLaPartie(
  formulaire: FormData,
  geste: (partieId: number, idAppareil: IdAppareil) => Promise<string | undefined>,
): Promise<void> {
  const code = String(formulaire.get("code") ?? "");
  const idAppareil = await assurerLAppareil();
  let destination: string;

  try {
    const trouvee = await chercherPartieParCode(db, limiteDeRecherche, {
      code,
      cle: await cleDeLaRequete(idAppareil),
      maintenant: Date.now(),
    });

    // Ni « inconnue » ni « trop de tentatives » n'ont de phrase à porter ici :
    // la page les affiche déjà, chacune dans son état dédié.
    destination =
      trouvee.statut === "trouvee"
        ? retourALaPartie(code, await geste(trouvee.partie.id, idAppareil))
        : retourALaPartie(code);
  } catch (erreur) {
    destination = retourALaPartie(code, messageDeRefus(erreur));
  }

  redirect(destination);
}

/**
 * Entrer dans la partie : s'ajouter à la tablée, ou réclamer sa place.
 *
 * C'est la seule écriture que le code seul autorise, et le domaine la borne au
 * gel — voir `rejoindrePartie`.
 */
export async function rejoindreAction(formulaire: FormData): Promise<void> {
  await agirSurLaPartie(formulaire, async (partieId, idAppareil) => {
    const resultat = await rejoindrePartie(db, partieId, {
      idAppareil,
      identite: lireIdentiteDuFormulaire(formulaire),
    });

    return resultat.statut === "desambiguiser" ? messageDHomonyme(resultat) : undefined;
  });
}

/** Ajouter à la tablée quelqu'un qui n'a pas de téléphone. */
export async function ajouterParticipantAction(formulaire: FormData): Promise<void> {
  await agirSurLaPartie(formulaire, async (partieId, idAppareil) => {
    const resultat = await ajouterParticipant(db, partieId, {
      idAppareil,
      identite: lireIdentiteDuFormulaire(formulaire),
    });

    return resultat.statut === "desambiguiser" ? messageDHomonyme(resultat) : undefined;
  });
}

/** Retirer quelqu'un de la tablée, tant que la partie n'a pas commencé. */
export async function retirerParticipantAction(formulaire: FormData): Promise<void> {
  await agirSurLaPartie(formulaire, async (partieId, idAppareil) => {
    await retirerParticipant(db, partieId, {
      idAppareil,
      joueurId: String(formulaire.get("joueurId") ?? ""),
    });

    return undefined;
  });
}
