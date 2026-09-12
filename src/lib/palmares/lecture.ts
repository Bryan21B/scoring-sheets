import { and, eq, isNotNull, isNull } from "drizzle-orm";
import type { Base, Lecture } from "@/db/base";
import { participant, partie } from "@/db/schema";
import { type JeuId, jeuIdSchema } from "@/lib/jeux/catalogue";
import type { JoueurId } from "@/lib/jeux/moteur";
import { parseRegles } from "@/lib/jeux/regles";
import { etatDesLignes } from "@/lib/manche/lecture";
import { ordonnerLePalmares, tauxDUnePartie, type VueDePalmares } from "@/lib/palmares/taux";
import {
  grouper,
  lignesDeGrille,
  lireLesManches,
  lireLesTablees,
  lireLesValeurs,
} from "@/lib/partie/lecture-groupee";
import { listerLeRoster } from "@/lib/roster/lecture";

/**
 * Ce que les deux agrégats du palmarès lisent en base, et c'est **la même
 * chose** : le classement de chaque partie terminée.
 *
 * Le taux du palmarès et les compteurs de la fiche de joueur posent deux
 * questions différentes à un seul objet — qui a battu qui, et à quel jeu. Les
 * faire partir de deux lectures laisserait un « 5 victoires » de fiche cesser de
 * correspondre au taux affiché à côté du même nom, sans que rien ne proteste.
 *
 * Rien n'est stocké : le classement se recalcule depuis les manches à chaque
 * lecture, par le même `etatDesLignes` que la fiche d'une partie. C'est ce qui
 * fait que changer la formule ne demande aucune migration.
 */

/**
 * Une partie terminée, réduite à ce que les agrégats en lisent.
 *
 * **`classement` et non les totaux** : le taux comme les victoires se lisent
 * dans l'ordre, jamais dans les points, et un jeu sans score du tout — Dnup ne
 * distribue que des jetons, et pas même à deux joueurs — n'a rien d'autre à
 * offrir.
 */
export type PartieClassee = {
  partieId: number;
  jeuId: JeuId;
  finLe: Date;
  /** Les groupes de rang du moteur. Un participant retiré n'y figure pas. */
  classement: readonly (readonly JoueurId[])[];
};

/**
 * Les parties **terminées**, et rien d'autre.
 *
 * `fin_cause = 'terminee'` porte la décision de domaine : une partie abandonnée
 * ne pèse sur aucun agrégat, parce que la compter en parties jouées sans jamais
 * la compter en victoires creuserait le taux de chacun d'un montant qui dépend
 * de **qui** a quitté la table.
 *
 * `fin_le IS NOT NULL` est redondant avec elle — le `CHECK` de la base tient les
 * trois colonnes de fin ensemble — et c'est pourtant lui qui compte : c'est la
 * condition qui rend l'**index partiel** `partie_fin_le_idx` utilisable, donc ce
 * qui laisse les parties encore en cours hors du parcours. Sans elle, le
 * planificateur relirait la table entière.
 *
 * Aucun `ORDER BY` : l'ordre du palmarès est celui des taux calculés, pas celui
 * d'une colonne, et un tri demandé ici serait un tri payé pour rien.
 *
 * Exportée pour que le plan d'exécution se vérifie sur **la** requête de
 * l'application : une requête recopiée dans un test prouverait qu'un index
 * existe, jamais qu'il sert.
 */
export function requeteDesPartiesTerminees(base: Lecture) {
  return base
    .select({ id: partie.id, jeuId: partie.jeuId, regles: partie.regles, finLe: partie.finLe })
    .from(partie)
    .where(and(isNotNull(partie.finLe), eq(partie.finCause, "terminee")));
}

/**
 * Les parties terminées **où ce joueur figure encore**.
 *
 * Une jointure sur `participant`, qui porte l'index `participant_joueur_id_idx`
 * déclaré pour exactement cet usage — la fiche d'un joueur et ses compteurs.
 * Lire toutes les parties puis jeter celles où il n'est pas ferait relire les
 * manches de toute la base pour une fiche.
 *
 * `retire_le IS NULL` est la même règle qu'ailleurs, appliquée une fois de plus :
 * un participant retiré ne figure pas au classement final, donc la partie n'est
 * pas la sienne, donc elle n'entre ni dans ses compteurs ni dans son taux.
 */
export function requeteDesPartiesDUnJoueur(base: Lecture, joueurId: number) {
  return base
    .select({ id: partie.id, jeuId: partie.jeuId, regles: partie.regles, finLe: partie.finLe })
    .from(partie)
    .innerJoin(participant, eq(participant.partieId, partie.id))
    .where(
      and(
        eq(participant.joueurId, joueurId),
        isNull(participant.retireLe),
        isNotNull(partie.finLe),
        eq(partie.finCause, "terminee"),
      ),
    );
}

/** Une partie terminée telle que la première requête la rend, avant le moteur. */
type PartieTerminee = { id: number; jeuId: string; regles: string; finLe: Date | null };

/**
 * Fait passer ces parties par le moteur, en **trois lectures groupées**.
 *
 * Tablées, manches et valeurs d'un coup, quel que soit le nombre de parties :
 * c'est le contraire d'un `lireLaGrille` appelé en boucle, qui ferait grimper
 * les requêtes avec la taille de la base. Puis `etatDesLignes`, le même que la
 * fiche d'une partie, pour que le classement dont sort le taux soit exactement
 * celui qu'on lit en ouvrant la partie.
 */
async function classer(
  base: Lecture,
  parties: readonly PartieTerminee[],
): Promise<PartieClassee[]> {
  const partieIds = parties.map((une) => une.id);
  const tablees = await lireLesTablees(base, partieIds);
  const manches = await lireLesManches(base, partieIds);
  const valeurs = await lireLesValeurs(
    base,
    manches.map((une) => une.id),
  );
  const manchesParPartie = grouper(
    manches,
    (une) => une.partieId,
    (une) => une,
  );

  return parties.map((une) => {
    const jeuId = jeuIdSchema.safeParse(une.jeuId);

    if (!jeuId.success) {
      // Comme l'historique : la colonne n'a pas de clé étrangère, le catalogue
      // étant une constante, donc une écriture directe a pu y mettre n'importe
      // quoi. Refuser sèchement vaut mieux que d'inventer un jeu.
      throw new Error(`La partie ${une.id} porte un jeu inconnu : ${une.jeuId}.`);
    }

    if (une.finLe === null) {
      // Le `CHECK` tient les trois colonnes de fin ensemble et la requête n'a
      // demandé que des parties terminées : y arriver serait un schéma qui a
      // bougé sous nos pieds, pas un cas à afficher.
      throw new Error(`La partie ${une.id} est terminée sans porter de date de fin.`);
    }

    const tablee = tablees.get(une.id) ?? [];

    return {
      partieId: une.id,
      jeuId: jeuId.data,
      finLe: une.finLe,
      classement: etatDesLignes(
        parseRegles(une.regles),
        lignesDeGrille(manchesParPartie.get(une.id) ?? [], tablee, valeurs),
      ).classement,
    };
  });
}

/** Toutes les parties terminées, classées. */
export async function lireLesPartiesClassees(base: Lecture): Promise<PartieClassee[]> {
  return classer(base, await requeteDesPartiesTerminees(base));
}

/** Les parties terminées de ce joueur, classées. */
export async function lireLesPartiesDUnJoueur(
  base: Lecture,
  joueurId: number,
): Promise<PartieClassee[]> {
  return classer(base, await requeteDesPartiesDUnJoueur(base, joueurId));
}

/**
 * Le palmarès : **tout le roster**, ordonné par taux de victoires normalisé.
 *
 * Cinq requêtes, quelle que soit la taille de la base : le roster, les parties
 * terminées, et les trois lectures groupées qui rapportent leurs tablées, leurs
 * manches et leurs valeurs.
 *
 * Tout le roster, et pas seulement qui a déjà joué : un palmarès où l'on ne
 * trouve pas son nom ne se relit pas deux fois, et un palmarès dont tout le
 * monde est sous le plancher n'est pas un état vide — c'est un palmarès honnête.
 *
 * Le taux d'une partie est `null` deux fois plutôt qu'une — le joueur n'est pas
 * au classement, ou il y est seul — et un `null` n'est jamais moyenné : c'est
 * une partie de moins, jamais un zéro. C'est par là, et par le `retire_le` des
 * tablées, qu'un participant retiré n'entre pas dans le vecteur de rangs.
 */
export async function lirePalmares(base: Base): Promise<VueDePalmares> {
  const roster = await listerLeRoster(base);
  const parties = await lireLesPartiesClassees(base);

  return ordonnerLePalmares(
    roster.map((joueur) => ({
      joueur,
      taux: parties.flatMap((une) => {
        const sien = tauxDUnePartie(une.classement, joueur.id);

        return sien === null ? [] : [sien];
      }),
    })),
  );
}
