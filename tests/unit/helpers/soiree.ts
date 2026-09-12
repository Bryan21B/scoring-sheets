import { and, eq } from "drizzle-orm";
import type { Base } from "@/db/base";
import { joueur, participant } from "@/db/schema";
import { creerIdAppareil } from "@/lib/appareil/cookie";
import { type JeuId, trouverEntree } from "@/lib/jeux/catalogue";
import { cloturerLaManche } from "@/lib/manche/cloture";
import { ouvrirLaMancheSuivante } from "@/lib/manche/ouverture";
import { ecrireLaCase } from "@/lib/manche/saisie";
import { creerPartie } from "@/lib/partie/creation";
import { estampillerLaFin } from "@/lib/partie/fin";
import { finImprimee } from "@/lib/partie/tablee";
import type { JoueurConnu } from "@/lib/roster/noms";

/**
 * Une soirée entière, **écrite par les chemins réels** : le même casting de
 * partie en partie, et des parties vraiment jouées puis finies.
 *
 * Ce que `partie-de-test.ts` ne sait pas faire, et pourquoi ce fichier existe :
 * ses parties naissent d'un **nom tapé**, ce qui déclenche la désambiguïsation
 * d'homonymes dès la deuxième soirée. Le palmarès, lui, ne veut mesurer que ça —
 * les mêmes joueurs sur plusieurs parties — donc les joueurs sont inscrits une
 * fois et rejoints ensuite par `{ mode: "roster" }`, qui est exactement la porte
 * qu'emprunte « c'est elle » à l'écran.
 *
 * Aucune manche, aucune case et aucune clôture n'est posée à la main :
 * `ouvrirLaMancheSuivante`, `ecrireLaCase`, `cloturerLaManche` et
 * `estampillerLaFin` font le travail, si bien que les agrégats sont vérifiés
 * contre de vraies données et non contre l'idée qu'on s'en fait.
 */

/** Le roster, inscrit une fois pour toutes les parties de la soirée. */
export async function inscrireLeRoster(
  base: Base,
  noms: readonly string[],
): Promise<JoueurConnu[]> {
  const inscrits: JoueurConnu[] = [];

  for (const nom of noms) {
    const [ligne] = await base
      .insert(joueur)
      .values({ nom, creeLe: new Date() })
      .returning({ id: joueur.id });

    if (ligne === undefined) {
      throw new Error(`Insertion du joueur ${nom} sans id rendu.`);
    }

    inscrits.push({ id: ligne.id, nom });
  }

  return inscrits;
}

/**
 * Les manches d'une partie : une ligne par manche, une valeur par joueur de la
 * tablée, `null` pour une case qu'on ne touche pas.
 *
 * Ce que la valeur **signifie** dépend du mode de saisie du jeu — le nombre
 * compté devant soi, le total unique crédité au gagnant, le rang au podium —
 * exactement comme la colonne `saisie.valeur` le laisse au mode.
 */
export type ManchesDeTest = readonly (readonly (number | null)[])[];

/** Ce qu'une partie de test demande : qui joue, à quoi, comment, et quand ça finit. */
export type SoireeDeTest = {
  joueurs: readonly JoueurConnu[];
  finLe: Date;
  manches?: ManchesDeTest;
  jeuId?: JeuId;
  cause?: "terminee" | "abandonnee";
  /**
   * Ceux qui quittent la table **une fois les manches écrites**.
   *
   * Posé par une écriture directe, et c'est assumé : le retrait après le gel
   * n'a pas encore de chemin d'écriture — `retirerParticipant` refuse une partie
   * commencée — alors que la colonne, elle, existe et porte déjà tout ce dont
   * les agrégats dépendent. Même arbitrage que l'abandon estampillé à la main
   * dans `ecrans-historique.test.tsx` avant que le geste n'existe.
   */
  retires?: readonly JoueurConnu[];
};

/** La partie une fois finie, par les deux clés qui la désignent. */
export type PartieJouee = { partieId: number; code: string };

/**
 * Ouvre une partie avec ce casting, joue ses manches, et estampille sa fin.
 *
 * Le seuil de fin est celui **imprimé pour cet effectif** plutôt qu'une constante
 * recopiée : à Dnup, deux joueurs se jouent en manches gagnées et non en jetons,
 * et un `66` écrit en dur ici ouvrirait une partie sur des règles que la table ne
 * joue pas.
 *
 * **Les manches doivent rester sous la condition de fin** quand le test lit la
 * date. Une clôture qui franchit le seuil estampille la partie elle-même, à
 * l'horloge du serveur, et `estampillerLaFin` ne réécrit jamais une fin déjà
 * posée — `finLe` serait alors ignoré silencieusement. Deux manches à *6 qui
 * prend — cartes spéciales*, qui s'arrête à deux manches fixes, suffisent à
 * tomber dedans.
 */
export async function jouerUnePartie(base: Base, soiree: SoireeDeTest): Promise<PartieJouee> {
  const { joueurs, finLe } = soiree;
  const premier = joueurs[0];

  if (premier === undefined) {
    throw new Error("Une partie de test a besoin d'au moins un joueur.");
  }

  const jeuId = soiree.jeuId ?? "6-qui-prend";
  const fin = finImprimee(trouverEntree(jeuId), joueurs.length);

  if (fin === null) {
    throw new Error(`${jeuId} ne se joue pas à ${joueurs.length} joueurs.`);
  }

  const idAppareil = creerIdAppareil();
  const resultat = await creerPartie(base, {
    idAppareil,
    jeuId,
    nombreDeJoueurs: String(joueurs.length),
    finValeur: String(fin.valeur),
    identite: { mode: "roster", joueurId: String(premier.id) },
  });

  if (resultat.statut !== "creee") {
    throw new Error(`Création attendue, reçu « ${resultat.statut} ».`);
  }

  for (const autre of joueurs.slice(1)) {
    await base.insert(participant).values({ partieId: resultat.partieId, joueurId: autre.id });
  }

  for (const valeurs of soiree.manches ?? []) {
    const manche = await ouvrirLaMancheSuivante(base, resultat.partieId);

    for (const [rang, valeur] of valeurs.entries()) {
      const concerne = joueurs[rang];

      if (valeur === null || concerne === undefined) {
        continue;
      }

      await ecrireLaCase(base, {
        mancheId: manche.id,
        joueurConcerneId: concerne.id,
        valeurMontree: null,
        valeur,
        agissant: { joueurId: premier.id, appareilId: idAppareil },
      });
    }

    await cloturerLaManche(base, { mancheId: manche.id, parJoueurId: premier.id });
  }

  for (const parti of soiree.retires ?? []) {
    await retirerDeLaTablee(base, resultat.partieId, parti.id);
  }

  await base.transaction((tx) =>
    estampillerLaFin(tx, resultat.partieId, {
      le: finLe,
      cause: soiree.cause ?? "terminee",
      par: premier.id,
    }),
  );

  return { partieId: resultat.partieId, code: resultat.code };
}

/**
 * Marque un participant comme parti, **ses valeurs déjà saisies intactes**.
 *
 * L'écriture directe est le sujet du test et non un raccourci : c'est l'état que
 * le schéma décrit — « garde les valeurs saisies, sort de la complétude et du
 * classement » — et il faut pouvoir le produire pour vérifier qu'il n'entre pas
 * dans le vecteur de rangs.
 */
export async function retirerDeLaTablee(
  base: Base,
  partieId: number,
  joueurId: number,
): Promise<void> {
  await base
    .update(participant)
    .set({ retireLe: new Date() })
    .where(and(eq(participant.partieId, partieId), eq(participant.joueurId, joueurId)));
}
