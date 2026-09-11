import { describe, expect, it } from "bun:test";
import { trouverEntree } from "@/lib/jeux/catalogue";
import type { Regles } from "@/lib/jeux/regles";
import { resoudreRegles } from "@/lib/jeux/resolution";
import type { CaseDeManche } from "@/lib/manche/lecture";
import { departDeLaPasseAvant } from "@/lib/manche/passe-avant";
import {
  caseDe,
  casesDeLaTablee as cases,
  casesDesignees,
  LEA,
  MARIE,
  PAUL,
} from "../helpers/tablee";

const sixQuiPrend = resoudreRegles(trouverEntree("6-qui-prend"), { nombreDeJoueurs: 3 });
const uno = resoudreRegles(trouverEntree("uno"), { nombreDeJoueurs: 3 });
const dnup = resoudreRegles(trouverEntree("dnup"), { nombreDeJoueurs: 3 });
const dnupADeux = resoudreRegles(trouverEntree("dnup"), { nombreDeJoueurs: 2 });

/** L'appareil d'un spectateur : il lit la partie sans être de la tablée. */
const SPECTATEUR = 404;

/** La case sur laquelle l'écran démarre, ou `undefined` si ce n'en est pas une. */
function caseDeDepart(
  regles: Regles,
  lesCases: readonly CaseDeManche[],
  joueurDeLAppareil: number | null,
) {
  const depart = departDeLaPasseAvant(regles, lesCases, joueurDeLAppareil);

  return depart?.ecran === "valeur" ? depart.caseASaisir : undefined;
}

describe("par où la passe avant démarre à 6 qui prend", () => {
  it("démarre sur le joueur de l'appareil", () => {
    expect(caseDeDepart(sixQuiPrend, cases(null, null, null), PAUL.id)?.joueur).toEqual(PAUL);
  });

  it("démarre sur lui même quand sa case est déjà remplie : corriger est le même geste", () => {
    expect(caseDeDepart(sixQuiPrend, cases(null, 15, null), PAUL.id)?.joueur).toEqual(PAUL);
  });

  it("démarre sur la première case manquante quand l'appareil n'est rattaché à personne", () => {
    expect(caseDeDepart(sixQuiPrend, cases(8, null, null), null)?.joueur).toEqual(PAUL);
  });

  it("fait de même quand l'appareil se déclare un joueur qui n'est pas de la table", () => {
    expect(caseDeDepart(sixQuiPrend, cases(8, null, null), SPECTATEUR)?.joueur).toEqual(PAUL);
  });

  it("saute les cases déjà remplies pour trouver la première manquante", () => {
    expect(caseDeDepart(sixQuiPrend, cases(8, 15, null), null)?.joueur).toEqual(LEA);
  });

  it("ne prend pas un zéro pour une case vide", () => {
    expect(caseDeDepart(sixQuiPrend, cases(0, null, null), null)?.joueur).toEqual(PAUL);
  });

  it("ne démarre nulle part quand tout est rempli et que l'appareil n'est de personne", () => {
    expect(departDeLaPasseAvant(sixQuiPrend, cases(8, 15, 3), null)).toBeUndefined();
  });

  it("s'arrête là : elle rend un écran, jamais une file de cinq", () => {
    // Un écran, pas cinq. La passe avant ne pousse jamais vers l'écran d'un
    // autre joueur — c'est le récapitulatif qui reprend la main.
    expect(departDeLaPasseAvant(sixQuiPrend, cases(null, null, null), MARIE.id)).toEqual({
      ecran: "valeur",
      caseASaisir: caseDe(MARIE, null),
      max: 200,
    });
  });
});

describe("par où la passe avant démarre à Uno", () => {
  it("demande d'abord qui est sorti, et ne fait taper aucun chiffre", () => {
    expect(departDeLaPasseAvant(uno, cases(null, null, null), MARIE.id)).toEqual({
      ecran: "designation",
      rang: 1,
      question: "Qui est sorti ?",
      valeur: "",
      candidats: [MARIE, PAUL, LEA],
    });
  });

  it("démarre sur soi dès qu'on est le sorti : le total est le sien à taper", () => {
    expect(caseDeDepart(uno, casesDesignees(PAUL.id), PAUL.id)?.joueur).toEqual(PAUL);
  });

  it("mène au total du désigné, qui est le seul geste que la manche attend encore", () => {
    expect(caseDeDepart(uno, casesDesignees(PAUL.id), MARIE.id)?.joueur).toEqual(PAUL);
  });

  it("laisse le sorti corriger son total, une fois qu'il est tapé", () => {
    expect(caseDeDepart(uno, cases(null, 24, null), PAUL.id)?.joueur).toEqual(PAUL);
  });

  it("ne démarre nulle part pour un perdant une fois le total tapé", () => {
    expect(departDeLaPasseAvant(uno, cases(null, 24, null), MARIE.id)).toBeUndefined();
  });
});

describe("par où la passe avant démarre à Dnup", () => {
  it("demande le premier sorti, et propose toute la tablée", () => {
    expect(departDeLaPasseAvant(dnup, cases(null, null, null), MARIE.id)).toEqual({
      ecran: "designation",
      rang: 1,
      question: "Premier sorti ?",
      valeur: "1",
      candidats: [MARIE, PAUL, LEA],
    });
  });

  it("demande ensuite le deuxième, sans reproposer celui qui est déjà premier", () => {
    expect(departDeLaPasseAvant(dnup, cases(null, 1, null), MARIE.id)).toEqual({
      ecran: "designation",
      rang: 2,
      question: "Deuxième sorti ?",
      valeur: "2",
      candidats: [MARIE, LEA],
    });
  });

  it("s'arrête au deuxième sorti : il n'y a ni troisième ni dernier à désigner", () => {
    expect(departDeLaPasseAvant(dnup, cases(2, 1, null), MARIE.id)).toBeUndefined();
  });

  it("n'a qu'un rang à deux joueurs, et le nomme comme la manche gagnée qu'il est", () => {
    const aDeux = [caseDe(MARIE, null), caseDe(PAUL, null)];

    expect(departDeLaPasseAvant(dnupADeux, aDeux, MARIE.id)).toEqual({
      ecran: "designation",
      rang: 1,
      question: "Gagnant de la manche ?",
      valeur: "1",
      candidats: [MARIE, PAUL],
    });
  });
});

describe("la passe avant ne se distribue qu'à 6 qui prend", () => {
  // Elle se distribue exactement quand la manche porte **plus d'une valeur**.
  // Ailleurs, un seul geste est en cours pour toute la table, et les cinq
  // téléphones montrent donc le même écran.
  it("donne à chacun sa propre case là où chacun compte devant soi", () => {
    const vierges = cases(null, null, null);

    expect(caseDeDepart(sixQuiPrend, vierges, MARIE.id)?.joueur).toEqual(MARIE);
    expect(caseDeDepart(sixQuiPrend, vierges, PAUL.id)?.joueur).toEqual(PAUL);
  });

  it("donne le même écran à tous à Uno, où la manche ne porte qu'un total", () => {
    const vierges = cases(null, null, null);

    expect(departDeLaPasseAvant(uno, vierges, MARIE.id)).toEqual(
      departDeLaPasseAvant(uno, vierges, PAUL.id),
    );
  });

  it("donne le même écran à tous à Dnup, où rien ne se compte devant soi", () => {
    const vierges = cases(null, null, null);

    expect(departDeLaPasseAvant(dnup, vierges, MARIE.id)).toEqual(
      departDeLaPasseAvant(dnup, vierges, PAUL.id),
    );
  });
});
