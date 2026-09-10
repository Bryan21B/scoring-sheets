import { describe, expect, it } from "bun:test";
import { creerLimiteur } from "@/lib/partie/limite-de-debit";

/** Trois échecs par minute : de quoi se tromper, pas de quoi énumérer. */
function limiteur() {
  return creerLimiteur({ echecs: 3, fenetreMs: 60_000 });
}

describe("le limiteur de débit", () => {
  it("laisse passer tant que la fenêtre n'est pas pleine", () => {
    const limite = limiteur();

    limite.noterUnEchec("ip", 0);
    limite.noterUnEchec("ip", 1_000);

    expect(limite.estOuvert("ip", 2_000)).toBe(true);
  });

  it("ferme dès que la fenêtre est pleine", () => {
    const limite = limiteur();

    for (const instant of [0, 1_000, 2_000]) {
      limite.noterUnEchec("ip", instant);
    }

    expect(limite.estOuvert("ip", 3_000)).toBe(false);
  });

  it("rouvre à la fenêtre suivante", () => {
    // La limite existe contre un script, pas contre quelqu'un qui se trompe :
    // elle doit se rendre au bout d'une minute sans rien demander à personne.
    const limite = limiteur();

    for (const instant of [0, 1_000, 2_000]) {
      limite.noterUnEchec("ip", instant);
    }

    expect(limite.estOuvert("ip", 60_001)).toBe(true);
  });

  it("compte par clé : celui qui tâtonne n'enferme pas les autres", () => {
    const limite = limiteur();

    for (const instant of [0, 1_000, 2_000]) {
      limite.noterUnEchec("le-script", instant);
    }

    expect(limite.estOuvert("le-script", 3_000)).toBe(false);
    expect(limite.estOuvert("la-table", 3_000)).toBe(true);
  });

  it("est ouvert pour une clé qu'il n'a jamais vue", () => {
    expect(limiteur().estOuvert("jamais-vue", 0)).toBe(true);
  });
});
