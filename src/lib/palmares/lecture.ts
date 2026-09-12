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
 * correspondre au classement dont le taux est tiré, sans que rien ne proteste.
 *
 * Ils lisent la même chose sans pour autant **compter pareil**, et le seul écart
 * est voulu : une partie dont le classement ne retient qu'un joueur — les autres
 * ayant quitté la table — vaut « 1 partie, 1 victoire » au compteur, qui est un
 * fait, et **rien** au taux, qui est une proportion d'adversaires battus et n'en
 * a aucun à mesurer. Compter zéro la lui retirerait, compter un la lui offrirait.
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
 * Les quatre colonnes que les agrégats lisent d'une partie, et pas une de plus.
 *
 * Déclarées une fois pour les deux requêtes : elles rendent la **même** chose,
 * et `classer` s'appuie dessus. Une projection recopiée dans chacune ferait, le
 * jour où le moteur demande une colonne de plus, une fiche de joueur qui lève là
 * où le palmarès passe. Le type de `PartieTerminee` s'en déduit plutôt que de
 * les réécrire une troisième fois.
 */
const COLONNES_LUES = {
  id: partie.id,
  jeuId: partie.jeuId,
  regles: partie.regles,
  finLe: partie.finLe,
};

/**
 * La condition qui dit « terminée », écrite une fois pour les deux requêtes.
 *
 * `fin_cause = 'terminee'` porte la décision de domaine : une partie abandonnée
 * ne pèse sur aucun agrégat, parce que la compter en parties jouées sans jamais
 * la compter en victoires creuserait le taux de chacun d'un montant qui dépend
 * de **qui** a quitté la table.
 *
 * `fin_le IS NOT NULL` est redondant avec elle — le `CHECK` de la base tient les
 * trois colonnes de fin ensemble — et c'est pourtant lui qui compte : c'est la
 * condition qui rend l'**index partiel** `partie_fin_le_idx` utilisable. Sans
 * elle, `EXPLAIN QUERY PLAN` retombe sur un `SCAN partie` franc, ce qu'un test
 * vérifie dans les deux sens.
 */
function estTerminee() {
  return and(isNotNull(partie.finLe), eq(partie.finCause, "terminee"));
}

/**
 * Les parties **terminées**, et rien d'autre.
 *
 * Ce que « terminée » veut dire est dans {@link estTerminee}, partagé avec la
 * requête d'un joueur.
 *
 * Aucun `ORDER BY` : l'ordre du palmarès est celui des taux calculés, pas celui
 * d'une colonne, et un tri demandé ici serait un tri payé pour rien.
 *
 * Exportée pour que le plan d'exécution se vérifie sur **la** requête de
 * l'application : une requête recopiée dans un test prouverait qu'un index
 * existe, jamais qu'il sert.
 */
export function requeteDesPartiesTerminees(base: Lecture) {
  return base.select(COLONNES_LUES).from(partie).where(estTerminee());
}

/**
 * Les parties terminées **où ce joueur figure encore**.
 *
 * Une jointure sur `participant`, qui porte l'index `participant_joueur_id_idx`
 * déclaré pour exactement cet usage — la fiche d'un joueur et ses compteurs.
 * Lire toutes les parties puis jeter celles où il n'est pas ferait relire les
 * manches de toute la base pour une fiche.
 *
 * `retire_le IS NULL` **ne tient rien** : il rétrécit, il ne décide pas. La
 * partie d'un joueur qui a quitté la table serait de toute façon écartée plus
 * loin, sa tablée relue ne le portant plus et son identifiant n'apparaissant donc
 * pas au classement. Le retirer d'ici ne fait échouer aucun test, et c'est la
 * bonne nouvelle : la règle est tenue **une seule fois**, là où le classement se
 * lit, et cette clause-là ne fait qu'éviter de relire les manches d'une partie
 * qu'on s'apprête à jeter.
 */
export function requeteDesPartiesDUnJoueur(base: Lecture, joueurId: number) {
  return base
    .select(COLONNES_LUES)
    .from(partie)
    .innerJoin(participant, eq(participant.partieId, partie.id))
    .where(and(eq(participant.joueurId, joueurId), isNull(participant.retireLe), estTerminee()));
}

/** Une partie terminée telle que la requête la rend, nullabilité comprise. */
type PartieTerminee = Awaited<ReturnType<typeof requeteDesPartiesTerminees>>[number];

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

/**
 * Toutes les parties terminées de la base, chacune avec son classement.
 *
 * Sans filtre ni limite, à la différence de l'historique : un taux moyenné sur
 * une page serait un taux qui dépend de la page. À dix joueurs et quelques
 * centaines de soirées, tout lire est le comportement voulu — c'est le nombre de
 * **requêtes** qui devait rester constant, et il l'est.
 */
export async function lireLesPartiesClassees(base: Lecture): Promise<PartieClassee[]> {
  return classer(base, await requeteDesPartiesTerminees(base));
}

/**
 * Les parties terminées de ce joueur, chacune avec son classement.
 *
 * Le classement porte la **tablée entière**, pas le seul joueur demandé : c'est
 * ce dont la formule a besoin pour compter les battus, et c'est aussi pourquoi
 * les lectures groupées partent des identifiants de partie plutôt que du joueur.
 */
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
