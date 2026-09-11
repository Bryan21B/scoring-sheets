import { describe, expect, it } from "bun:test";
import type { JoueurId } from "@/lib/jeux/moteur";
import {
  ordonnerLePalmares,
  PLANCHER_DE_PARTIES,
  pourcentage,
  tauxDUnePartie,
} from "@/lib/palmares/taux";
import type { JoueurConnu } from "@/lib/roster/noms";

const MARIE: JoueurConnu = { id: 1, nom: "Marie" };
const PAUL: JoueurConnu = { id: 2, nom: "Paul" };
const LEA: JoueurConnu = { id: 3, nom: "Léa" };

/** Un classement à six, chaque joueur seul sur sa marche, du premier au dernier. */
const SIX_SANS_EGALITE: JoueurId[][] = [[10], [20], [30], [40], [50], [60]];

/** Autant de parties au même taux qu'il en faut pour atteindre le plancher. */
function assezDeParties(taux: number): number[] {
  return Array.from({ length: PLANCHER_DE_PARTIES }, () => taux);
}

/** La moyenne telle que le palmarès la fait, pour montrer que deux doubles diffèrent. */
function moyenne(taux: readonly number[]): number {
  return taux.reduce((total, un) => total + un, 0) / taux.length;
}

describe("le taux de victoires normalisé d'une partie", () => {
  it("vaut 1 pour qui bat toute la table", () => {
    expect(tauxDUnePartie(SIX_SANS_EGALITE, 10)).toBe(1);
  });

  it("vaut 0 pour qui n'a battu personne", () => {
    expect(tauxDUnePartie(SIX_SANS_EGALITE, 60)).toBe(0);
  });

  it("vaut la proportion d'adversaires battus, et non la place occupée", () => {
    // Troisième de six a battu trois adversaires sur cinq. C'est cette
    // proportion-là que la formule retient, et c'est ce qu'un simple compte de
    // victoires ne dit pas : troisième de six pèse, dernier de deux ne pèse rien.
    expect(tauxDUnePartie(SIX_SANS_EGALITE, 30)).toBe(0.6);
    expect(tauxDUnePartie([[10], [20]], 20)).toBe(0);
  });

  it("compte un ex æquo pour une demi-victoire", () => {
    // Deux joueurs en tête à trois : chacun a battu le dernier et partage sa
    // marche avec l'autre, donc (1 + 0,5 × 1) / 2.
    expect(tauxDUnePartie([[10, 20], [30]], 10)).toBe(0.75);
    expect(tauxDUnePartie([[10, 20], [30]], 20)).toBe(0.75);
  });

  it("rend une demie sur une table entièrement à égalité", () => {
    // Trois joueurs sur la même marche : chacun partage avec deux autres, donc
    // (0 + 0,5 × 2) / 2. Une demie, ce qui dit exactement « rien n'a départagé ».
    expect(tauxDUnePartie([[10, 20, 30]], 20)).toBe(0.5);
  });

  it("n'en donne aucun à qui ne figure pas au classement", () => {
    // Un participant retiré ne figure pas au classement final : il n'entre donc
    // pas dans le vecteur de rangs, et cette partie-là n'est pas la sienne.
    expect(tauxDUnePartie(SIX_SANS_EGALITE, 99)).toBeNull();
  });

  it("n'en donne aucun quand il ne reste qu'un joueur au classement", () => {
    // `n − 1` vaut zéro : il n'y a pas d'adversaire, donc pas de proportion
    // d'adversaires battus. Rendre 1 offrirait un sans-faute à qui est resté
    // seul à table, rendre 0 le lui retirerait : les deux inventent un résultat.
    expect(tauxDUnePartie([[10]], 10)).toBeNull();
  });

  it("n'en donne aucun sur un classement vide", () => {
    expect(tauxDUnePartie([], 10)).toBeNull();
  });
});

describe("le palmarès", () => {
  it("ordonne les joueurs par taux décroissant, avec leur nombre de parties", () => {
    const vue = ordonnerLePalmares([
      { joueur: PAUL, taux: assezDeParties(0.25) },
      { joueur: MARIE, taux: assezDeParties(0.75) },
    ]);

    expect(vue.classes.map((une) => une.joueur.nom)).toEqual(["Marie", "Paul"]);
    expect(vue.classes.map((une) => une.parties)).toEqual([
      PLANCHER_DE_PARTIES,
      PLANCHER_DE_PARTIES,
    ]);
  });

  it("moyenne les taux d'un joueur, une partie valant une partie", () => {
    const vue = ordonnerLePalmares([{ joueur: MARIE, taux: [1, 1, 0, 0, 0.5] }]);

    expect(vue.classes[0]?.taux).toBe(0.5);
  });

  it("numérote les rangs à partir de un", () => {
    const vue = ordonnerLePalmares([
      { joueur: MARIE, taux: assezDeParties(0.75) },
      { joueur: PAUL, taux: assezDeParties(0.5) },
      { joueur: LEA, taux: assezDeParties(0.25) },
    ]);

    expect(vue.classes.map((une) => une.rang)).toEqual([1, 2, 3]);
  });

  it("ne départage pas deux joueurs au même taux, et saute le rang suivant", () => {
    // L'égalité ne se départage nulle part dans ce domaine : deux joueurs au
    // même taux occupent la même marche, et la marche d'après est la troisième.
    const vue = ordonnerLePalmares([
      { joueur: MARIE, taux: assezDeParties(0.75) },
      { joueur: PAUL, taux: assezDeParties(0.75) },
      { joueur: LEA, taux: assezDeParties(0.25) },
    ]);

    expect(vue.classes.map((une) => une.rang)).toEqual([1, 1, 3]);
  });

  it("tient pour égaux deux taux que seul le flottant sépare", () => {
    // Cinq places à une table de sept, les mêmes pour les deux, dans un autre
    // ordre. Les deux moyennes ne retombent pas sur le même double — 0,5 d'un
    // côté, 0,5000000000000001 de l'autre — et se départager là-dessus serait le
    // podium faux que le classement en groupes de rang existe pour interdire.
    const marie = [2 / 6, 4 / 6, 1 / 6, 5 / 6, 3 / 6];
    const paul = [3 / 6, 5 / 6, 1 / 6, 4 / 6, 2 / 6];

    expect(moyenne(marie)).not.toBe(moyenne(paul));

    const vue = ordonnerLePalmares([
      { joueur: MARIE, taux: marie },
      { joueur: PAUL, taux: paul },
    ]);

    expect(vue.classes.map((une) => une.rang)).toEqual([1, 1]);
  });

  it("range sous le plancher, sans rang, un joueur qui n'a pas assez joué", () => {
    const vue = ordonnerLePalmares([
      { joueur: MARIE, taux: Array.from({ length: PLANCHER_DE_PARTIES - 1 }, () => 1) },
      { joueur: PAUL, taux: assezDeParties(0.25) },
    ]);

    expect(vue.classes.map((une) => une.joueur.nom)).toEqual(["Paul"]);
    expect(vue.horsClassement.map((une) => une.joueur.nom)).toEqual(["Marie"]);
    expect(vue.horsClassement[0]?.parties).toBe(PLANCHER_DE_PARTIES - 1);
  });

  it("classe pile au plancher : c'est un plancher, pas une marche à dépasser", () => {
    const vue = ordonnerLePalmares([{ joueur: MARIE, taux: assezDeParties(1) }]);

    expect(vue.classes.map((une) => une.joueur.nom)).toEqual(["Marie"]);
  });

  it("garde le joueur qui n'a fini aucune partie, hors classement et à zéro", () => {
    const vue = ordonnerLePalmares([{ joueur: MARIE, taux: [] }]);

    expect(vue.horsClassement).toEqual([{ joueur: MARIE, parties: 0 }]);
  });

  it("range les hors classement du plus proche du plancher au plus loin", () => {
    const vue = ordonnerLePalmares([
      { joueur: MARIE, taux: [] },
      { joueur: PAUL, taux: [1, 1] },
      { joueur: LEA, taux: [1] },
    ]);

    expect(vue.horsClassement.map((une) => une.joueur.nom)).toEqual(["Paul", "Léa", "Marie"]);
  });

  it("ne laisse aucun taux fuir sur une ligne hors classement", () => {
    // Un taux sur deux parties ne veut rien dire : le type lui-même refuse d'en
    // porter un, pour qu'aucun écran ne puisse l'afficher par mégarde.
    const [ligne] = ordonnerLePalmares([{ joueur: MARIE, taux: [1, 1] }]).horsClassement;

    expect(ligne && "taux" in ligne).toBe(false);
  });

  it("porte son plancher, pour que l'écran dise la raison sans la recopier", () => {
    expect(ordonnerLePalmares([]).plancher).toBe(PLANCHER_DE_PARTIES);
  });
});

describe("le taux mis en mots", () => {
  it("s'écrit en pourcentage entier, espace insécable comprise", () => {
    expect(pourcentage(0.625)).toBe("63\u00a0%");
    expect(pourcentage(1)).toBe("100\u00a0%");
    expect(pourcentage(0)).toBe("0\u00a0%");
  });
});
