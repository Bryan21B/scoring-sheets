import { describe, expect, it } from "bun:test";
import { trouverEntree } from "@/lib/jeux/catalogue";
import { resoudreRegles } from "@/lib/jeux/resolution";
import {
  designationsManquantes,
  gestesAttendus,
  lignesDuRecapitulatif,
  suiteDuGeste,
  valeurEnMots,
} from "@/lib/manche/gestes";
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

/** La table à deux de la variante Dnup : Marie et Paul, sans Léa. */
function aDeux(deMarie: number | null, dePaul: number | null) {
  return [caseDe(MARIE, deMarie), caseDe(PAUL, dePaul)];
}

describe("ce qu'une manche attend encore, dérivé du mode", () => {
  it("attend une valeur de chaque joueur à 6 qui prend", () => {
    expect(gestesAttendus(sixQuiPrend, cases(8, null, null))).toEqual([
      { geste: "valeur", joueur: PAUL },
      { geste: "valeur", joueur: LEA },
    ]);
  });

  it("n'attend plus rien quand chacun a marqué, le zéro compris", () => {
    expect(gestesAttendus(sixQuiPrend, cases(0, 15, 3))).toEqual([]);
  });

  it("attend d'abord une désignation à Uno : personne n'est encore sorti", () => {
    expect(gestesAttendus(uno, cases(null, null, null))).toEqual([
      { geste: "designation", rang: 1 },
    ]);
  });

  it("attend ensuite le total du seul désigné, et de personne d'autre", () => {
    expect(gestesAttendus(uno, casesDesignees(PAUL.id))).toEqual([
      { geste: "valeur", joueur: PAUL },
    ]);
  });

  it("ne tait aucune ligne d'Uno quand deux désignations sont passées en même temps", () => {
    // La politique de conflit porte sur la case et jamais sur la partie : deux
    // téléphones qui désignent deux joueurs au même instant écrivent deux cases
    // différentes, et passent tous les deux. La clôture refusera cette manche —
    // le récapitulatif doit donc dire ce qui la bloque, et non se taire sur la
    // foi de la première ligne trouvée.
    const deuxLignes = [caseDe(MARIE, 24, true), caseDe(PAUL, null, true), caseDe(LEA, null)];

    expect(gestesAttendus(uno, deuxLignes)).toEqual([{ geste: "valeur", joueur: PAUL }]);
  });

  it("n'attend plus rien à Uno dès que le total est tapé", () => {
    expect(gestesAttendus(uno, cases(null, 24, null))).toEqual([]);
  });

  it("attend deux désignations à Dnup, et aucun chiffre", () => {
    expect(gestesAttendus(dnup, cases(null, null, null))).toEqual([
      { geste: "designation", rang: 1 },
      { geste: "designation", rang: 2 },
    ]);
  });

  it("s'arrête au deuxième sorti : ni troisième ni dernier", () => {
    expect(gestesAttendus(dnup, cases(2, 1, null))).toEqual([]);
  });

  it("ne réclame que le rang qui manque, et non les deux", () => {
    expect(gestesAttendus(dnup, cases(null, 1, null))).toEqual([{ geste: "designation", rang: 2 }]);
  });

  it("n'a qu'un rang à Dnup à deux joueurs, où poser sa dernière carte gagne", () => {
    expect(gestesAttendus(dnupADeux, aDeux(null, null))).toEqual([
      { geste: "designation", rang: 1 },
    ]);
    expect(gestesAttendus(dnupADeux, aDeux(null, 1))).toEqual([]);
  });
});

describe("les désignations qui manquent, nommées pour le récapitulatif", () => {
  it("nomme le sorti d'Uno sans lui inventer de rang", () => {
    expect(designationsManquantes(uno, cases(null, null, null))).toEqual([
      { rang: 1, libelle: "Sorti" },
    ]);
  });

  it("nomme les deux rangs de Dnup dans l'ordre", () => {
    expect(designationsManquantes(dnup, cases(null, null, null))).toEqual([
      { rang: 1, libelle: "Premier sorti" },
      { rang: 2, libelle: "Deuxième sorti" },
    ]);
  });

  it("nomme le rang unique de Dnup à deux comme la manche gagnée qu'il est", () => {
    expect(designationsManquantes(dnupADeux, aDeux(null, null))).toEqual([
      { rang: 1, libelle: "Gagnant de la manche" },
    ]);
  });

  it("n'en nomme aucune à 6 qui prend, qui ne désigne personne", () => {
    expect(designationsManquantes(sixQuiPrend, cases(null, null, null))).toEqual([]);
  });
});

describe("ce qu'une ligne du récapitulatif montre, selon le mode", () => {
  it("dit « à saisir » de la case vide d'un joueur à 6 qui prend", () => {
    expect(lignesDuRecapitulatif(sixQuiPrend, cases(8, null, null))).toEqual([
      { joueur: MARIE, marque: "8", seTape: true },
      { joueur: PAUL, marque: "à saisir", seTape: true },
      { joueur: LEA, marque: "à saisir", seTape: true },
    ]);
  });

  it("ne dit « à saisir » d'aucun perdant à Uno : rien ne leur est demandé", () => {
    expect(lignesDuRecapitulatif(uno, casesDesignees(PAUL.id))).toEqual([
      { joueur: MARIE, marque: null, seTape: false },
      { joueur: PAUL, marque: "à saisir", seTape: true },
      { joueur: LEA, marque: null, seTape: false },
    ]);
  });

  it("montre le total du gagnant d'Uno, et rien pour les autres", () => {
    expect(lignesDuRecapitulatif(uno, cases(null, 24, null))).toEqual([
      { joueur: MARIE, marque: null, seTape: false },
      { joueur: PAUL, marque: "24", seTape: true },
      { joueur: LEA, marque: null, seTape: false },
    ]);
  });

  it("montre des rangs et non des nombres à Dnup, et n'en fait taper aucun", () => {
    expect(lignesDuRecapitulatif(dnup, cases(2, 1, null))).toEqual([
      { joueur: MARIE, marque: "2e", seTape: false },
      { joueur: PAUL, marque: "1er", seTape: false },
      { joueur: LEA, marque: null, seTape: false },
    ]);
  });
});

describe("ce qu'une valeur veut dire, selon le mode", () => {
  it("est le nombre lui-même là où l'on compte des points", () => {
    expect(valeurEnMots(sixQuiPrend, 0)).toBe("0");
    expect(valeurEnMots(uno, 24)).toBe("24");
  });

  it("est un rang au podium, où la colonne ne porte pas des points", () => {
    expect(valeurEnMots(dnup, 1)).toBe("1er");
    expect(valeurEnMots(dnup, 2)).toBe("2e");
  });

  it("nomme le vide plutôt que de rendre un blanc", () => {
    expect(valeurEnMots(uno, null)).toBe("vide");
  });
});

describe("où un geste posé renvoie", () => {
  // « Les désignations d'abord, puis les valeurs » : une manche d'Uno se saisit
  // en **deux gestes**, et repasser par le récapitulatif entre les deux en
  // ferait quatre.
  it("enchaîne après une désignation : le sorti nommé, son total est la suite", () => {
    expect(suiteDuGeste(uno, null)).toBe("passeAvant");
  });

  it("enchaîne les deux désignations de Dnup sans détour", () => {
    expect(suiteDuGeste(dnup, 1)).toBe("passeAvant");
  });

  it("s'arrête après une valeur : le total tapé, la passe avant est finie", () => {
    expect(suiteDuGeste(uno, 24)).toBe("recapitulatif");
  });

  it("s'arrête après chaque valeur à 6 qui prend : un écran, pas cinq", () => {
    // Renvoyer à la passe avant rouvrirait sa propre case indéfiniment, puisque
    // c'est sur elle qu'on démarre, remplie comprise.
    expect(suiteDuGeste(sixQuiPrend, 12)).toBe("recapitulatif");
    expect(suiteDuGeste(sixQuiPrend, 0)).toBe("recapitulatif");
  });
});
