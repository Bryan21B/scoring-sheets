import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import type { InValue } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import type { Base } from "@/db/base";
import * as schema from "@/db/schema";
import type { JeuId } from "@/lib/jeux/catalogue";
import {
  lireLesPartiesClassees,
  lirePalmares,
  requeteDesPartiesDUnJoueur,
  requeteDesPartiesTerminees,
} from "@/lib/palmares/lecture";
import { PLANCHER_DE_PARTIES } from "@/lib/palmares/taux";
import type { JoueurConnu } from "@/lib/roster/noms";
import { type BaseDeTest, creerBaseDeTest } from "../helpers/base-de-test";
import { inscrireLeRoster, jouerUnePartie, leJour, type ManchesDeTest } from "../helpers/soiree";

let baseDeTest: BaseDeTest;
let base: Base;
let marie: JoueurConnu;
let paul: JoueurConnu;
let lea: JoueurConnu;
let zoe: JoueurConnu;

/**
 * Ce que le palmarès coûte, et ce qu'il doit continuer de coûter.
 *
 * Le roster, les parties terminées, puis les trois lectures groupées — tablées,
 * manches, valeurs. Le nombre ne dépend ni du nombre de parties, ni du nombre de
 * joueurs, ni du nombre de manches : c'est exactement ce qu'une lecture par
 * partie perdrait.
 */
const REQUETES_DU_PALMARES = 5;

/**
 * Autant de parties identiques qu'il en faut pour franchir le plancher.
 *
 * Le plancher n'est pas recopié : le jour où il bouge, ces tests jouent une
 * partie de plus ou de moins plutôt que de se mettre à décrire un autre cas.
 */
async function jouerAssezDeParties(options: {
  joueurs: readonly JoueurConnu[];
  manches: ManchesDeTest;
  jeuId?: JeuId;
  retires?: readonly JoueurConnu[];
}): Promise<void> {
  for (let numero = 0; numero < PLANCHER_DE_PARTIES; numero += 1) {
    await jouerUnePartie(base, { ...options, finLe: leJour(numero) });
  }
}

/**
 * Le plan que SQLite retient pour une requête, tel qu'il l'écrit.
 *
 * `EXPLAIN QUERY PLAN` sur le SQL que Drizzle produit vraiment, et non sur une
 * requête réécrite à la main pour le test : c'est le seul moyen de savoir que
 * l'index sert *à la requête de l'application*. Le client brut plutôt que
 * Drizzle, parce que le plan n'est pas un résultat que le schéma sait typer.
 */
async function planDe(requete: {
  toSQL: () => { sql: string; params: unknown[] };
}): Promise<string> {
  const sql = requete.toSQL();
  const plan = await baseDeTest.client.execute({
    sql: `EXPLAIN QUERY PLAN ${sql.sql}`,
    args: sql.params as InValue[],
  });

  return plan.rows.map((ligne) => String(ligne.detail)).join(" | ");
}

/** Une base qui compte les requêtes qu'on lui passe, par le `logger` de Drizzle. */
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

/** Le taux d'un joueur classé, ou `null` s'il ne l'est pas. */
function tauxDe(vue: Awaited<ReturnType<typeof lirePalmares>>, nom: string): number | null {
  return vue.classes.find((une) => une.joueur.nom === nom)?.taux ?? null;
}

/** Le nombre de parties d'un joueur, classé ou non. */
function partiesDe(vue: Awaited<ReturnType<typeof lirePalmares>>, nom: string): number | undefined {
  return [...vue.classes, ...vue.horsClassement].find((une) => une.joueur.nom === nom)?.parties;
}

beforeEach(async () => {
  baseDeTest = creerBaseDeTest();
  base = baseDeTest.base;

  const roster = await inscrireLeRoster(base, ["Marie", "Paul", "Léa", "Zoé"]);
  const [premiere, deuxieme, troisieme, quatrieme] = roster;

  if (
    premiere === undefined ||
    deuxieme === undefined ||
    troisieme === undefined ||
    quatrieme === undefined
  ) {
    throw new Error("Le roster de test n'a pas été inscrit en entier.");
  }

  marie = premiere;
  paul = deuxieme;
  lea = troisieme;
  zoe = quatrieme;
});

afterEach(() => {
  baseDeTest.fermer();
});

describe("le palmarès", () => {
  it("ordonne les joueurs par taux de victoires normalisé, avec leur nombre de parties", async () => {
    // 6 qui prend se gagne par le bas : Marie première, Paul deuxième, Léa
    // dernière, cinq soirées de suite. Les taux sont donc 1, 0,5 et 0.
    await jouerAssezDeParties({ joueurs: [marie, paul, lea], manches: [[1, 5, 9]] });

    const vue = await lirePalmares(base);

    expect(vue.classes.map((une) => une.joueur.nom)).toEqual(["Marie", "Paul", "Léa"]);
    expect(vue.classes.map((une) => une.taux)).toEqual([1, 0.5, 0]);
    expect(vue.classes.map((une) => une.parties)).toEqual([
      PLANCHER_DE_PARTIES,
      PLANCHER_DE_PARTIES,
      PLANCHER_DE_PARTIES,
    ]);
  });

  it("compte une demi-victoire pour une tête à égalité", async () => {
    // Marie et Paul à 4, Léa à 9 : le moteur les met dans le même groupe de
    // rang. Chacun a battu Léa et partage sa marche avec l'autre, soit
    // (1 + 0,5 × 1) / 2 = 0,75.
    await jouerAssezDeParties({ joueurs: [marie, paul, lea], manches: [[4, 4, 9]] });

    const vue = await lirePalmares(base);

    expect(tauxDe(vue, "Marie")).toBe(0.75);
    expect(tauxDe(vue, "Paul")).toBe(0.75);
    expect(tauxDe(vue, "Léa")).toBe(0);
  });

  it("ne moyenne que les parties terminées du joueur", async () => {
    // Cinq soirées où Marie gagne, puis une abandonnée où Paul menait. Compter
    // la sixième ferait tomber Marie à 5/6 et monter Paul à 1/6.
    await jouerAssezDeParties({ joueurs: [marie, paul], manches: [[1, 9]] });
    await jouerUnePartie(base, {
      joueurs: [marie, paul],
      manches: [[9, 1]],
      finLe: leJour(PLANCHER_DE_PARTIES),
      cause: "abandonnee",
    });

    const vue = await lirePalmares(base);

    expect(tauxDe(vue, "Marie")).toBe(1);
    expect(tauxDe(vue, "Paul")).toBe(0);
  });

  it("ne compte une partie abandonnée ni en parties jouées ni en victoires", async () => {
    await jouerUnePartie(base, {
      joueurs: [marie, paul],
      manches: [[1, 9]],
      finLe: leJour(0),
      cause: "abandonnee",
    });

    const vue = await lirePalmares(base);

    expect(partiesDe(vue, "Marie")).toBe(0);
    expect(partiesDe(vue, "Paul")).toBe(0);
  });

  it("ne montre pas une partie encore en cours", async () => {
    await jouerAssezDeParties({ joueurs: [marie, paul], manches: [[1, 9]] });

    const encours = await lireLesPartiesClassees(base);

    await jouerUnePartie(base, { joueurs: [marie, paul], manches: [], finLe: leJour(9) });

    expect(encours).toHaveLength(PLANCHER_DE_PARTIES);
  });

  it("ne fait pas entrer un participant retiré dans le vecteur de rangs", async () => {
    // Léa a marqué 0 — le meilleur score à 6 qui prend — puis a quitté la table.
    // Si elle entrait au classement elle serait première à chaque soirée, Paul
    // tomberait à 0,5 et Marie resterait dernière. Elle n'y entre pas : Paul
    // gagne toutes ses parties, et Léa n'en a aucune à son compteur.
    await jouerAssezDeParties({
      joueurs: [marie, paul, lea],
      manches: [[9, 1, 0]],
      retires: [lea],
    });

    const vue = await lirePalmares(base);

    expect(tauxDe(vue, "Paul")).toBe(1);
    expect(tauxDe(vue, "Marie")).toBe(0);
    expect(tauxDe(vue, "Léa")).toBeNull();
    expect(partiesDe(vue, "Léa")).toBe(0);
  });

  it("garde au palmarès un joueur qui n'a jamais fini de partie", async () => {
    await jouerAssezDeParties({ joueurs: [marie, paul], manches: [[1, 9]] });

    const vue = await lirePalmares(base);

    expect(vue.horsClassement.map((une) => une.joueur.nom)).toEqual(["Léa", "Zoé"]);
    expect(vue.horsClassement.map((une) => une.parties)).toEqual([0, 0]);
  });

  it("laisse hors classement qui n'a pas atteint le plancher", async () => {
    for (let numero = 0; numero < PLANCHER_DE_PARTIES - 1; numero += 1) {
      await jouerUnePartie(base, {
        joueurs: [marie, paul],
        manches: [[1, 9]],
        finLe: leJour(numero),
      });
    }

    const vue = await lirePalmares(base);

    expect(vue.classes).toEqual([]);
    expect(vue.horsClassement.map((une) => une.joueur.nom)).toEqual([
      "Marie",
      "Paul",
      "Léa",
      "Zoé",
    ]);
  });

  it("classe un jeu sans score : Dnup ne distribue que des rangs", async () => {
    // À deux joueurs, Dnup n'a **aucun jeton** — le barème est `[0]` — et le
    // classement sort quand même de la désignation du sorti. Le taux se lit donc
    // sur une partie où personne n'a marqué le moindre point.
    await jouerAssezDeParties({ joueurs: [marie, paul], manches: [[1, null]], jeuId: "dnup" });

    const vue = await lirePalmares(base);

    // Les deux sont à zéro jeton : le moteur les met dans le même groupe de
    // rang, et une table entièrement à égalité vaut une demie pour chacun.
    expect(tauxDe(vue, "Marie")).toBe(0.5);
    expect(tauxDe(vue, "Paul")).toBe(0.5);
    expect(partiesDe(vue, "Marie")).toBe(PLANCHER_DE_PARTIES);
  });
});

describe("le coût du palmarès", () => {
  it("s'appuie sur l'index partiel de date de fin plutôt que sur toute la table", async () => {
    // Les deux assertions comptent, et la seconde n'est pas décorative : retirer
    // le `fin_le IS NOT NULL` de la requête — la condition qui rend l'index
    // partiel utilisable — la fait retomber sur un `SCAN partie` franc.
    await jouerUnePartie(base, { joueurs: [marie, paul], manches: [[1, 9]], finLe: leJour(0) });

    const plan = await planDe(requeteDesPartiesTerminees(base));

    expect(plan).toContain("partie_fin_le_idx");
    expect(plan).not.toContain("SCAN partie");
  });

  it("passe par l'index de joueur pour les parties d'un seul joueur", async () => {
    // `participant_joueur_id_idx` est déclaré au schéma pour « la page d'un
    // joueur et ses compteurs » : c'est ici, et nulle part ailleurs, qu'il sert.
    await jouerUnePartie(base, { joueurs: [marie, paul], manches: [[1, 9]], finLe: leJour(0) });

    const plan = await planDe(requeteDesPartiesDUnJoueur(base, marie.id));

    expect(plan).toContain("participant_joueur_id_idx");
    expect(plan).not.toContain("SCAN participant");
  });

  it("coûte cinq requêtes, que la base porte une partie ou cinq", async () => {
    await jouerUnePartie(base, { joueurs: [marie, paul], manches: [[1, 9]], finLe: leJour(0) });

    const seule = baseComptee();
    await lirePalmares(seule.base);

    expect(seule.requetes()).toBe(REQUETES_DU_PALMARES);

    for (let numero = 1; numero < PLANCHER_DE_PARTIES; numero += 1) {
      await jouerUnePartie(base, {
        joueurs: [marie, paul],
        manches: [[1, 9]],
        finLe: leJour(numero),
      });
    }

    const cinq = baseComptee();
    const vue = await lirePalmares(cinq.base);

    expect(vue.classes.map((une) => une.parties)).toEqual([
      PLANCHER_DE_PARTIES,
      PLANCHER_DE_PARTIES,
    ]);
    // Une lecture par partie — `lireLaGrille` appelée en boucle — ferait grimper
    // ce nombre avec la base. Il ne bouge pas.
    expect(cinq.requetes()).toBe(REQUETES_DU_PALMARES);
  });

  it("coûte les mêmes cinq requêtes quand une partie porte quatre manches", async () => {
    await jouerUnePartie(base, {
      joueurs: [marie, paul],
      manches: [
        [1, 9],
        [2, 8],
        [3, 7],
        [4, 6],
      ],
      finLe: leJour(0),
    });

    const compteur = baseComptee();
    await lirePalmares(compteur.base);

    expect(compteur.requetes()).toBe(REQUETES_DU_PALMARES);
  });
});

describe("le palmarès et la Zoé qui n'a rien joué", () => {
  it("n'invente pas de taux pour qui n'a jamais été classé", async () => {
    await jouerAssezDeParties({ joueurs: [marie, paul], manches: [[1, 9]] });

    const vue = await lirePalmares(base);
    const sienne = vue.horsClassement.find((une) => une.joueur.id === zoe.id);

    expect(sienne).toEqual({ joueur: zoe, parties: 0 });
  });
});
