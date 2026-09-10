import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import type { InValue } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import type { Base } from "@/db/base";
import * as schema from "@/db/schema";
import { cloturerLaManche } from "@/lib/manche/cloture";
import { ouvrirLaMancheSuivante } from "@/lib/manche/ouverture";
import { ecrireLaCase } from "@/lib/manche/saisie";
import { estampillerLaFin } from "@/lib/partie/fin";
import {
  type FiltreDHistorique,
  lireLHistorique,
  requeteDesPartiesFinies,
} from "@/lib/partie/historique";
import { type BaseDeTest, creerBaseDeTest } from "../helpers/base-de-test";
import {
  joueurDeLaPartie,
  ouvrirUnePartieDeTest,
  type PartieDeTest,
} from "../helpers/partie-de-test";

let baseDeTest: BaseDeTest;
let base: Base;
let soirees: number;

/** Tout l'historique, sans filtre : ce que la page montre par défaut. */
const TOUT: FiltreDHistorique = { jeuId: null, combien: 20 };

/**
 * Ce que l'historique coûte, et ce qu'il doit continuer de coûter.
 *
 * Une requête pour désigner les parties, trois lectures groupées pour les
 * tablées, les manches et les valeurs. Le nombre ne dépend ni de la taille de la
 * base, ni de celle de la page, ni du nombre de manches d'une partie — ce qui
 * est exactement ce qu'une lecture par ligne perdrait.
 */
const REQUETES_DE_LHISTORIQUE = 4;

/**
 * Le plan que SQLite retient pour cette requête-là, tel qu'il l'écrit.
 *
 * `EXPLAIN QUERY PLAN` sur le SQL que Drizzle produit vraiment, et non sur une
 * requête réécrite à la main pour le test : c'est le seul moyen de savoir que
 * l'index sert *à la requête de l'application*. Le client brut plutôt que
 * Drizzle, parce que le plan n'est pas un résultat que le schéma sait typer.
 */
async function planDe(filtre: FiltreDHistorique): Promise<string> {
  const requete = requeteDesPartiesFinies(base, filtre).toSQL();
  const plan = await baseDeTest.client.execute({
    sql: `EXPLAIN QUERY PLAN ${requete.sql}`,
    args: requete.params as InValue[],
  });

  return plan.rows.map((ligne) => String(ligne.detail)).join(" | ");
}

/**
 * Une base qui compte les requêtes qu'on lui passe.
 *
 * Le `logger` de Drizzle plutôt qu'un mandataire autour du client : c'est une
 * API du paquet, elle voit exactement les requêtes que la logique émet, et elle
 * ne ment pas sur ce qu'on mesure.
 */
function baseComptee(): { base: Base; requetes: () => number } {
  let compte = 0;

  return {
    base: drizzle(baseDeTest.client, {
      schema,
      logger: {
        logQuery: () => {
          compte += 1;
        },
      },
    }),
    requetes: () => compte,
  };
}

/**
 * Une tablée de noms encore jamais vus.
 *
 * Le roster est global : rouvrir une partie sous « Marie » quand une Marie
 * existe déjà déclenche la désambiguïsation, ce qui est le bon comportement de
 * la création et un piège pour un test qui finit trois parties d'affilée.
 */
function tableeInedite(combien: number): string[] {
  soirees += 1;

  return ["Marie", "Paul", "Léa"].slice(0, combien).map((nom) => `${nom} ${soirees}`);
}

/**
 * Une partie **vraiment jouée puis finie**, par les chemins d'écriture réels.
 *
 * Aucune ligne posée à la main : la manche s'ouvre, les cases s'écrivent, la
 * manche se clôt, la fin s'estampille. C'est ce qui fait que le lecteur est
 * vérifié contre de vraies données et non contre l'idée qu'on s'en fait.
 *
 * Les valeurs restent sous le seuil de 6 qui prend pour que la clôture
 * n'estampille pas la fin toute seule : sinon la date serait celle de
 * l'horloge, et l'ordre de l'historique ne se testerait plus.
 */
async function finirUnePartie(options: {
  finLe: Date;
  valeurs: readonly number[];
  /** Les manches suivantes, s'il y en a. La première est toujours `valeurs`. */
  puis?: readonly (readonly number[])[];
  jeuId?: string;
  cause?: "terminee" | "abandonnee";
}): Promise<PartieDeTest> {
  const partie = await ouvrirUnePartieDeTest(base, {
    ...(options.jeuId === undefined ? {} : { jeuId: options.jeuId }),
    noms: tableeInedite(options.valeurs.length),
  });

  for (const valeurs of [options.valeurs, ...(options.puis ?? [])]) {
    const manche = await ouvrirLaMancheSuivante(base, partie.partieId);

    for (const [rang, valeur] of valeurs.entries()) {
      await ecrireLaCase(base, {
        mancheId: manche.id,
        joueurConcerneId: joueurDeLaPartie(partie, rang),
        valeurMontree: null,
        valeur,
        agissant: { joueurId: joueurDeLaPartie(partie, 0), appareilId: partie.idAppareil },
      });
    }

    await cloturerLaManche(base, {
      mancheId: manche.id,
      parJoueurId: joueurDeLaPartie(partie, 0),
    });
  }

  await base.transaction((tx) =>
    estampillerLaFin(tx, partie.partieId, {
      le: options.finLe,
      cause: options.cause ?? "terminee",
      par: joueurDeLaPartie(partie, 0),
    }),
  );

  return partie;
}

beforeEach(() => {
  baseDeTest = creerBaseDeTest();
  base = baseDeTest.base;
  soirees = 0;
});

afterEach(() => {
  baseDeTest.fermer();
});

describe("l'historique", () => {
  it("range les parties de la plus récente à la plus ancienne, par date de fin", async () => {
    const veille = await finirUnePartie({ finLe: new Date("2026-01-03"), valeurs: [1, 2, 3] });
    const hier = await finirUnePartie({ finLe: new Date("2026-01-05"), valeurs: [1, 2, 3] });
    const vieille = await finirUnePartie({ finLe: new Date("2026-01-01"), valeurs: [1, 2, 3] });

    const historique = await lireLHistorique(base, TOUT);

    expect(historique.lignes.map((ligne) => ligne.code)).toEqual([
      hier.code,
      veille.code,
      vieille.code,
    ]);
  });

  it("ne montre pas une partie encore en cours", async () => {
    const finie = await finirUnePartie({ finLe: new Date("2026-01-03"), valeurs: [1, 2, 3] });
    await ouvrirUnePartieDeTest(base);

    const historique = await lireLHistorique(base, TOUT);

    expect(historique.lignes.map((ligne) => ligne.code)).toEqual([finie.code]);
  });

  it("porte le jeu, la date, le vainqueur et le nombre de joueurs, et rien de plus", async () => {
    const partie = await finirUnePartie({
      finLe: new Date("2026-01-05T20:30:00.000Z"),
      // 6 qui prend se gagne par le bas : Paul, à 4, l'emporte.
      valeurs: [10, 4, 7],
    });

    const [ligne] = (await lireLHistorique(base, TOUT)).lignes;

    expect(ligne?.jeu.nom).toBe("6 qui prend");
    expect(ligne?.finLe).toEqual(new Date("2026-01-05T20:30:00.000Z"));
    expect(ligne?.vainqueur).toEqual(partie.joueurs[1] ?? null);
    expect(ligne?.nombreDeJoueurs).toBe(3);
  });

  it("ne nomme aucun vainqueur quand la tête est à égalité", async () => {
    // Le moteur sort son classement en groupes de rang : deux joueurs à 4 sont
    // dans le même groupe, et l'égalité ne se départage nulle part.
    await finirUnePartie({ finLe: new Date("2026-01-05"), valeurs: [10, 4, 4] });

    expect((await lireLHistorique(base, TOUT)).lignes[0]?.vainqueur).toBeNull();
  });

  it("marque une partie abandonnée et ne lui donne pas de vainqueur", async () => {
    await finirUnePartie({
      finLe: new Date("2026-01-05"),
      valeurs: [10, 4, 7],
      cause: "abandonnee",
    });

    const [ligne] = (await lireLHistorique(base, TOUT)).lignes;

    expect(ligne?.cause).toBe("abandonnee");
    expect(ligne?.vainqueur).toBeNull();
  });

  it("s'arrête à ce qu'on lui demande, et dit qu'il en reste", async () => {
    await finirUnePartie({ finLe: new Date("2026-01-03"), valeurs: [1, 2, 3] });
    const derniere = await finirUnePartie({ finLe: new Date("2026-01-05"), valeurs: [1, 2, 3] });

    const page = await lireLHistorique(base, { jeuId: null, combien: 1 });

    expect(page.lignes.map((ligne) => ligne.code)).toEqual([derniere.code]);
    expect(page.encore).toBe(true);
  });

  it("ne promet rien de plus quand la page a tout montré", async () => {
    await finirUnePartie({ finLe: new Date("2026-01-03"), valeurs: [1, 2, 3] });

    expect((await lireLHistorique(base, TOUT)).encore).toBe(false);
  });

  it("compte les joueurs de la tablée, pas ceux du roster", async () => {
    await finirUnePartie({ finLe: new Date("2026-01-05"), valeurs: [1, 2] });
    await finirUnePartie({ finLe: new Date("2026-01-04"), valeurs: [1, 2, 3] });

    expect((await lireLHistorique(base, TOUT)).lignes.map((une) => une.nombreDeJoueurs)).toEqual([
      2, 3,
    ]);
  });
});

describe("le filtre par jeu", () => {
  it("ne garde que les parties du jeu demandé", async () => {
    const base6 = await finirUnePartie({ finLe: new Date("2026-01-05"), valeurs: [1, 2, 3] });
    await finirUnePartie({
      finLe: new Date("2026-01-04"),
      valeurs: [1, 2, 3],
      jeuId: "6-qui-prend-cartes-speciales",
    });

    const filtre = await lireLHistorique(base, { jeuId: "6-qui-prend", combien: 20 });

    expect(filtre.lignes.map((ligne) => ligne.code)).toEqual([base6.code]);
  });

  it("sépare les deux variantes d'un même jeu, qui sont deux entrées", async () => {
    await finirUnePartie({ finLe: new Date("2026-01-05"), valeurs: [1, 2, 3] });
    const variante = await finirUnePartie({
      finLe: new Date("2026-01-04"),
      valeurs: [1, 2, 3],
      jeuId: "6-qui-prend-cartes-speciales",
    });

    const filtre = await lireLHistorique(base, {
      jeuId: "6-qui-prend-cartes-speciales",
      combien: 20,
    });

    expect(filtre.lignes.map((ligne) => ligne.code)).toEqual([variante.code]);
  });

  it("est le seul filtre : deux tablées différentes du même jeu restent toutes deux là", async () => {
    // Filtrer par joueur, c'est la fiche de joueur. Rien ici ne regarde qui
    // était à table, et ce test vaut par ce qu'il n'a pas à passer.
    const grande = await finirUnePartie({ finLe: new Date("2026-01-05"), valeurs: [1, 2, 3] });
    const petite = await finirUnePartie({ finLe: new Date("2026-01-04"), valeurs: [1, 2] });

    const filtre = await lireLHistorique(base, { jeuId: "6-qui-prend", combien: 20 });

    expect(filtre.lignes.map((ligne) => ligne.code)).toEqual([grande.code, petite.code]);
  });
});

describe("le coût de l'historique", () => {
  it("s'appuie sur l'index partiel de date de fin, sans tri temporaire", async () => {
    await finirUnePartie({ finLe: new Date("2026-01-05"), valeurs: [1, 2, 3] });

    const plan = await planDe(TOUT);

    expect(plan).toContain("partie_fin_le_idx");
    expect(plan).not.toContain("TEMP B-TREE");
  });

  it("passe encore par un index quand un jeu est demandé", async () => {
    // Le planificateur choisit alors `partie_jeu_id_idx` et trie ce qu'il en
    // sort : une poignée de parties d'un seul jeu, jamais toute la table. C'est
    // le prix d'un index partiel sur la seule date, et il est assumé — un index
    // composite (jeu, date) coûterait une migration pour un tri de dix lignes.
    await finirUnePartie({ finLe: new Date("2026-01-05"), valeurs: [1, 2, 3] });

    const plan = await planDe({ jeuId: "6-qui-prend", combien: 20 });

    expect(plan).toContain("SEARCH partie USING INDEX");
    expect(plan).not.toContain("SCAN partie");
  });

  it("coûte quatre requêtes, que la base porte une partie ou quatre", async () => {
    await finirUnePartie({ finLe: new Date("2026-01-05"), valeurs: [1, 2, 3] });

    const seule = baseComptee();
    await lireLHistorique(seule.base, TOUT);

    expect(seule.requetes()).toBe(REQUETES_DE_LHISTORIQUE);

    for (const jour of ["2026-01-06", "2026-01-07", "2026-01-08"]) {
      await finirUnePartie({ finLe: new Date(jour), valeurs: [1, 2, 3] });
    }

    const quatre = baseComptee();
    const historique = await lireLHistorique(quatre.base, TOUT);

    expect(historique.lignes).toHaveLength(4);
    // Une lecture par partie — ce que ferait `lireLaGrille` appelée en boucle —
    // ferait grimper ce nombre avec la liste. Il ne bouge pas.
    expect(quatre.requetes()).toBe(REQUETES_DE_LHISTORIQUE);
  });

  it("coûte les mêmes quatre requêtes quand une partie porte quatre manches", async () => {
    const partie = await finirUnePartie({
      finLe: new Date("2026-01-05"),
      valeurs: [1, 2, 3],
      puis: [
        [4, 5, 6],
        [7, 8, 9],
        [2, 3, 4],
      ],
    });

    const compteur = baseComptee();
    const historique = await lireLHistorique(compteur.base, TOUT);

    // Marie totalise 14, Paul 18, Léa 22 : à 6 qui prend, c'est le plus bas qui
    // l'emporte. Le vainqueur sort donc bien des quatre manches, pas de la
    // première — la lecture groupée les a toutes rapportées.
    expect(historique.lignes[0]?.vainqueur).toEqual(partie.joueurs[0] ?? null);
    expect(compteur.requetes()).toBe(REQUETES_DE_LHISTORIQUE);
  });
});
