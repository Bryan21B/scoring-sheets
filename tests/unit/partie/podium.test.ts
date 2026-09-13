import { describe, expect, it } from "bun:test";
import { trouverEntree } from "@/lib/jeux/catalogue";
import { evaluer, type Manche } from "@/lib/jeux/moteur";
import { resoudreRegles } from "@/lib/jeux/resolution";
import {
  estVainqueur,
  type Marche,
  marchesDuClassement,
  marchesDuPodium,
  podiumSeDresse,
  vainqueurs,
} from "@/lib/partie/podium";
import type { JoueurConnu } from "@/lib/roster/noms";

const MARIE: JoueurConnu = { id: 1, nom: "Marie" };
const PAUL: JoueurConnu = { id: 2, nom: "Paul" };
const LEA: JoueurConnu = { id: 3, nom: "Léa" };
const ZOE: JoueurConnu = { id: 4, nom: "Zoé" };

const SIX_QUI_PREND = trouverEntree("6-qui-prend");

/** Les règles d'une tablée de cet effectif : à 6 qui prend, le plus bas gagne. */
function regles(nombreDeJoueurs: number) {
  return resoudreRegles(SIX_QUI_PREND, { nombreDeJoueurs });
}

/**
 * Les marches d'une table dont chacun a marqué une fois.
 *
 * Le classement passe par le **vrai** moteur, jamais par une liste rangée à la
 * main : c'est lui qui produit les groupes de rang, et une fixture fabriquée
 * prouverait seulement que la fonction sait relire une fixture.
 */
function marchesDe(tablee: readonly JoueurConnu[], ...totaux: readonly number[]): Marche[] {
  const manche: Manche = {
    close: true,
    participants: tablee.map((joueur) => joueur.id),
    cases: tablee.map((joueur, rang) => ({ joueurId: joueur.id, valeur: totaux[rang] ?? 0 })),
  };

  return marchesDuClassement(evaluer(regles(tablee.length), [manche]), tablee);
}

/** Les noms d'une marche, dans l'ordre où elle les porte. */
function noms(marche: Marche | undefined): string[] {
  return (marche?.joueurs ?? []).map((joueur) => joueur.nom);
}

describe("les marches d'un classement", () => {
  it("range la tablée du meilleur au moins bon, selon le sens du jeu", () => {
    // 6 qui prend : le plus bas l'emporte.
    const marches = marchesDe([MARIE, PAUL, LEA], 20, 8, 60);

    expect(marches.map((marche) => noms(marche))).toEqual([["Paul"], ["Marie"], ["Léa"]]);
    expect(marches.map((marche) => marche.rang)).toEqual([1, 2, 3]);
  });

  it("porte le total de chaque marche", () => {
    const marches = marchesDe([MARIE, PAUL, LEA], 20, 8, 60);

    expect(marches.map((marche) => marche.total)).toEqual([8, 20, 60]);
  });

  it("fait partager le rang aux ex æquo, et saute le rang suivant", () => {
    // Marie et Paul à 8, Léa à 60 : ils occupent le rang 1 ensemble, et Léa
    // prend le 3 — jamais le 2, que personne n'a atteint.
    const marches = marchesDe([MARIE, PAUL, LEA], 8, 8, 60);

    expect(marches.map((marche) => marche.rang)).toEqual([1, 3]);
    expect(noms(marches[0])).toEqual(["Marie", "Paul"]);
    expect(noms(marches[1])).toEqual(["Léa"]);
  });

  it("saute d'autant de rangs qu'il y a d'ex æquo", () => {
    // Trois à 8 : la marche suivante est la quatrième, pas la deuxième.
    const marches = marchesDe([MARIE, PAUL, LEA, ZOE], 8, 8, 8, 60);

    expect(marches.map((marche) => marche.rang)).toEqual([1, 4]);
  });

  it("ne fait figurer aucun participant retiré", () => {
    // La manche 1 porte la valeur de Léa, qui a joué puis quitté la table : les
    // manches ne l'attendent plus, et la tablée affichée ne la porte plus non
    // plus. Son score reste en base, il ne se lit pas au classement.
    const tablee = [MARIE, PAUL];
    const manches: Manche[] = [
      {
        close: true,
        participants: [MARIE.id, PAUL.id],
        cases: [
          { joueurId: MARIE.id, valeur: 20 },
          { joueurId: PAUL.id, valeur: 8 },
          { joueurId: LEA.id, valeur: 1 },
        ],
      },
    ];
    const etat = evaluer(regles(2), manches);
    const marches = marchesDuClassement(etat, tablee);

    // Le moteur lui garde bien un total — l'histoire est vraie — et le
    // classement ne le range nulle part.
    expect(etat.totaux.get(LEA.id)).toBe(1);
    expect(marches.flatMap((marche) => noms(marche))).toEqual(["Paul", "Marie"]);
  });

  it("ne range personne quand aucune manche n'a été jouée", () => {
    expect(marchesDuClassement(evaluer(regles(3), []), [MARIE, PAUL, LEA])).toEqual([]);
  });
});

describe("les vainqueurs", () => {
  it("sont la marche de tête", () => {
    expect(vainqueurs(marchesDe([MARIE, PAUL, LEA], 20, 8, 60))).toEqual([PAUL]);
  });

  it("sont plusieurs quand la tête est partagée : rien ne départage une égalité", () => {
    expect(vainqueurs(marchesDe([MARIE, PAUL, LEA], 8, 8, 60))).toEqual([MARIE, PAUL]);
  });

  it("n'existent pas sur une partie sans manche", () => {
    expect(vainqueurs([])).toEqual([]);
  });

  it("se reconnaissent par leur identifiant, et personne d'autre", () => {
    const marches = marchesDe([MARIE, PAUL, LEA], 8, 8, 60);

    expect(estVainqueur(marches, MARIE.id)).toBe(true);
    expect(estVainqueur(marches, PAUL.id)).toBe(true);
    expect(estVainqueur(marches, LEA.id)).toBe(false);
    expect(estVainqueur(marches, null)).toBe(false);
  });
});

describe("le podium", () => {
  it("se dresse à trois joueurs", () => {
    expect(podiumSeDresse(marchesDe([MARIE, PAUL, LEA], 20, 8, 60))).toBe(true);
  });

  it("ne se dresse pas à deux joueurs : trois marches supposent une tablée moyenne", () => {
    expect(podiumSeDresse(marchesDe([MARIE, PAUL], 20, 8))).toBe(false);
  });

  it("ne se dresse pas sur une partie sans manche", () => {
    expect(podiumSeDresse([])).toBe(false);
  });

  it("a trois places, la marche de tête au rang 1", () => {
    const places = marchesDuPodium(marchesDe([MARIE, PAUL, LEA], 20, 8, 60));

    expect(places).toHaveLength(3);
    expect(noms(places[0])).toEqual(["Paul"]);
    expect(noms(places[1])).toEqual(["Marie"]);
    expect(noms(places[2])).toEqual(["Léa"]);
  });

  it("laisse vide la place qu'une égalité a fait sauter", () => {
    // Marie et Paul partagent la première marche ; la deuxième reste vide,
    // parce que personne n'a le rang 2, et Léa monte sur la troisième.
    const places = marchesDuPodium(marchesDe([MARIE, PAUL, LEA], 8, 8, 60));

    expect(noms(places[0])).toEqual(["Marie", "Paul"]);
    expect(places[1]).toBeUndefined();
    expect(noms(places[2])).toEqual(["Léa"]);
  });

  it("ne montre que les trois premiers rangs, la suite se lisant au classement", () => {
    const places = marchesDuPodium(marchesDe([MARIE, PAUL, LEA, ZOE], 20, 8, 60, 90));

    expect(places).toHaveLength(3);
    expect(places.flatMap((place) => noms(place))).not.toContain("Zoé");
  });
});
