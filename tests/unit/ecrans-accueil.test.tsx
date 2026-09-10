import { describe, expect, it } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { GrilleDeScore } from "@/components/grille-score";
import { MancheSuivante } from "@/components/manche-suivante";
import { trouverEntree } from "@/lib/jeux/catalogue";
import { evaluer, type Manche } from "@/lib/jeux/moteur";
import { resoudreRegles } from "@/lib/jeux/resolution";
import type { LigneDeGrille } from "@/lib/manche/lecture";
import { LEA, MARIE, PAUL, TABLEE } from "./helpers/tablee";

const SIX_QUI_PREND = trouverEntree("6-qui-prend");
const REGLES = resoudreRegles(SIX_QUI_PREND, { nombreDeJoueurs: 3 });

/** Une ligne de grille pour la tablée de trois, valeurs manquantes vides. */
function ligne(numero: number, ...valeurs: readonly (number | null)[]): LigneDeGrille {
  return {
    numero,
    close: false,
    cases: TABLEE.map((joueur, rang) => ({ joueur, valeur: valeurs[rang] ?? null })),
  };
}

/**
 * La grille rendue, **totaux calculés par le moteur** et non écrits à la main :
 * une carte fabriquée dans le test prouverait seulement que le composant sait
 * afficher une carte.
 */
function grille(...lignes: readonly LigneDeGrille[]): string {
  const manches: Manche[] = lignes.map((une) => ({
    close: une.close,
    participants: TABLEE.map((joueur) => joueur.id),
    cases: une.cases.map(({ joueur, valeur }) => ({ joueurId: joueur.id, valeur })),
  }));

  return renderToStaticMarkup(
    <GrilleDeScore
      joueurs={TABLEE}
      manches={lignes}
      totaux={evaluer(REGLES, manches).totaux}
      unite={SIX_QUI_PREND.unite}
    />,
  );
}

describe("la grille de score", () => {
  it("met les joueurs en colonnes", () => {
    const html = grille(ligne(1, 8, 15, 0));

    for (const joueur of TABLEE) {
      expect(html).toContain(`>${joueur.nom}</th>`);
    }
  });

  it("met les manches en lignes, une par manche", () => {
    const html = grille(ligne(1, 8, 15, 0), ligne(2, 5, null, 3));

    expect(html.match(/<tr/g)).toHaveLength(4);
  });

  it("numérote chaque ligne par sa manche, le numéro que le journal garde", () => {
    const html = grille(ligne(1, 8), ligne(2, 5));

    expect(html).toContain(">1</th>");
    expect(html).toContain(">2</th>");
  });

  it("porte au pied les totaux du moteur, cumulés d'une manche à l'autre", () => {
    const html = grille(ligne(1, 8, 15, 0), ligne(2, 5, 3, 0));

    expect(html).toContain("<tfoot");
    expect(html).toContain(">13</td>");
    expect(html).toContain(">18</td>");
  });

  it("laisse un trou là où personne n'a saisi : un zéro est une manche réussie", () => {
    const html = grille(ligne(1, 0, null, null));

    expect(html).toContain("—");
  });

  it("défile latéralement sans emporter la page avec elle", () => {
    // Cinq joueurs ne tiennent pas dans la largeur d'un téléphone : c'est la
    // grille qui déborde, dans son propre cadre, jamais le corps du document.
    const html = grille(ligne(1, 8, 15, 0));

    expect(html).toContain("overflow-x-auto");
    expect(html.indexOf("overflow-x-auto")).toBeLessThan(html.indexOf("<table"));
  });

  it("nomme ce que ses nombres comptent", () => {
    expect(grille(ligne(1, 8, 15, 0))).toContain("têtes de bœuf");
  });
});

describe("la grille et les joueurs qu'elle range", () => {
  it("range chaque valeur sous la colonne de son joueur, et non dans l'ordre reçu", () => {
    // Les cases arrivent dans l'ordre de la tablée, mais rien ne le garantit
    // au composant : il les retrouve par joueur, sinon une case décalée
    // attribuerait le score de Paul à Léa sans que rien ne proteste.
    const desordre: LigneDeGrille = {
      numero: 1,
      close: false,
      cases: [
        { joueur: LEA, valeur: 3 },
        { joueur: MARIE, valeur: 8 },
        { joueur: PAUL, valeur: 15 },
      ],
    };
    const html = grille(desordre);
    const cellules = [...html.matchAll(/<td[^>]*>([^<]*)<\/td>/g)].map(
      (trouvee) => trouvee[1] ?? "",
    );

    expect(cellules.slice(0, 3)).toEqual(["8", "15", "3"]);
  });
});

describe("« saisir la manche suivante »", () => {
  it("est un seul appui : un formulaire qui part, sans écran intermédiaire", () => {
    const html = renderToStaticMarkup(<MancheSuivante action="/p/A1B2C3/manche" />);

    expect(html).toContain("<form");
    expect(html).toContain('method="post"');
    expect(html).toContain('type="submit"');
  });

  it("porte la phrase qui tient lieu de « démarrer », sans jamais l'annoncer", () => {
    const html = renderToStaticMarkup(<MancheSuivante action="/p/A1B2C3/manche" />);

    expect(html).toContain("Saisir la manche suivante");
  });
});
