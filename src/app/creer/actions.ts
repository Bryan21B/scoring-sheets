"use server";

import { redirect } from "next/navigation";
import { db } from "@/db";
import { assurerLAppareil } from "@/lib/appareil/requete";
import { jeuIdSchema } from "@/lib/jeux/catalogue";
import { adresseDePartie } from "@/lib/partie/adresse";
import { creerPartie, RefusDeCreation } from "@/lib/partie/creation";
import { lireIdentiteDuFormulaire } from "@/lib/partie/identite";
import { ecrireIdentiteChoisie } from "@/lib/partie/identite-url";

/**
 * Ce qui s'affiche quand la création est refusée.
 *
 * **Seul un {@link RefusDeCreation} se montre.** C'est le type qui dit « cette
 * phrase est écrite pour être lue » — les bornes du jeu, le seuil hors bornes.
 * Tout le reste est interne : un rapport de champs Zod, « aucun joueur 404 au
 * roster », une contrainte SQLite. Les afficher n'aiderait personne et
 * raconterait la base.
 */
function messageDeRefus(erreur: unknown): string {
  return erreur instanceof RefusDeCreation
    ? erreur.message
    : "La partie n’a pas pu être ouverte. Reprends la tablée.";
}

/** Les champs à remettre dans l'adresse pour que l'écran se retrouve tel quel. */
const CHAMPS_A_GARDER = ["joueurId", "nom", "nombreDeJoueurs", "finValeur"] as const;

/**
 * L'adresse de la tablée, refus affiché et écran conservé.
 *
 * Tout ce qui avait été tapé y revient : un refus coûte une correction, jamais
 * une ressaisie complète, et l'identité choisie à l'écran précédent ne se perd
 * pas en route.
 */
function retourALaTablee(jeuId: string, formulaire: FormData, erreur: unknown): string {
  const recherche = new URLSearchParams({ erreur: messageDeRefus(erreur) });

  for (const cle of CHAMPS_A_GARDER) {
    const valeur = formulaire.get(cle);

    if (typeof valeur === "string" && valeur !== "") {
      recherche.set(cle, valeur);
    }
  }

  return `/creer/${jeuId}/tablee?${recherche.toString()}`;
}

/**
 * Ouvre la partie, et emmène sur sa page.
 *
 * Trois sorties, et une seule écrit : la partie créée, la question de
 * l'homonyme qui renvoie à « qui es-tu ? », et le refus qui revient à la tablée
 * avec sa raison. `redirect` est appelé **hors** du `try` : il fonctionne en
 * levant, et l'attraper transformerait chaque navigation réussie en erreur.
 */
export async function creerPartieAction(formulaire: FormData): Promise<void> {
  const jeuId = jeuIdSchema.safeParse(formulaire.get("jeuId"));

  if (!jeuId.success) {
    redirect("/");
  }

  const identite = lireIdentiteDuFormulaire(formulaire);
  let destination: string;

  try {
    const resultat = await creerPartie(db, {
      idAppareil: await assurerLAppareil(),
      jeuId: jeuId.data,
      nombreDeJoueurs: formulaire.get("nombreDeJoueurs"),
      finValeur: formulaire.get("finValeur"),
      identite,
    });

    destination =
      resultat.statut === "creee"
        ? adresseDePartie(resultat.code)
        : `/creer/${jeuId.data}?${ecrireIdentiteChoisie({ mode: "nouveau", nom: resultat.nom })}`;
  } catch (erreur) {
    destination = retourALaTablee(jeuId.data, formulaire, erreur);
  }

  redirect(destination);
}
