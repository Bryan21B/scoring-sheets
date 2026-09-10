import { describe, expect, it } from "bun:test";
import { caseDeDepart } from "@/lib/manche/passe-avant";
import { casesDeLaTablee as cases, LEA, MARIE, PAUL } from "../helpers/tablee";

describe("par où la passe avant démarre", () => {
  it("démarre sur le joueur de l'appareil", () => {
    expect(caseDeDepart(cases(null, null, null), PAUL.id)?.joueur).toEqual(PAUL);
  });

  it("démarre sur lui même quand sa case est déjà remplie : corriger est le même geste", () => {
    expect(caseDeDepart(cases(null, 15, null), PAUL.id)?.joueur).toEqual(PAUL);
  });

  it("démarre sur la première case manquante quand l'appareil n'est rattaché à personne", () => {
    expect(caseDeDepart(cases(8, null, null), null)?.joueur).toEqual(PAUL);
  });

  it("fait de même quand l'appareil se déclare un joueur qui n'est pas de la table", () => {
    const spectateur = 404;

    expect(caseDeDepart(cases(8, null, null), spectateur)?.joueur).toEqual(PAUL);
  });

  it("saute les cases déjà remplies pour trouver la première manquante", () => {
    expect(caseDeDepart(cases(8, 15, null), null)?.joueur).toEqual(LEA);
  });

  it("ne prend pas un zéro pour une case vide", () => {
    expect(caseDeDepart(cases(0, null, null), null)?.joueur).toEqual(PAUL);
  });

  it("ne démarre nulle part quand tout est rempli et que l'appareil n'est de personne", () => {
    expect(caseDeDepart(cases(8, 15, 3), null)).toBeUndefined();
  });

  it("s'arrête là : elle rend une case, jamais une file de cinq", () => {
    // Un écran, pas cinq. La passe avant ne pousse jamais vers l'écran d'un
    // autre joueur — c'est le récapitulatif qui reprend la main.
    const depart = caseDeDepart(cases(null, null, null), MARIE.id);

    expect(depart).toEqual({ joueur: MARIE, valeur: null });
  });
});
