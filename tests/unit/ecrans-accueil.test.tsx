import { describe, expect, it } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { Accueil, type EnCours } from "@/components/accueil";
import { GrilleDeScore } from "@/components/grille-score";
import { MancheSuivante } from "@/components/manche-suivante";
import { CATALOGUE, trouverEntree } from "@/lib/jeux/catalogue";
import { evaluer, type Manche } from "@/lib/jeux/moteur";
import { resoudreRegles } from "@/lib/jeux/resolution";
import type { LigneDeGrille, VueDeGrille } from "@/lib/manche/lecture";
import type { VueDePartie } from "@/lib/partie/lecture";
import { LEA, MARIE, PAUL, TABLEE } from "./helpers/tablee";

const SIX_QUI_PREND = trouverEntree("6-qui-prend");
const REGLES = resoudreRegles(SIX_QUI_PREND, { nombreDeJoueurs: 3 });

const PARTIE: VueDePartie = {
  id: 1,
  code: "A1B2C3",
  jeu: SIX_QUI_PREND,
  regles: REGLES,
  version: 4,
  participants: [...TABLEE],
};

/** Une ligne de grille pour la tablée de trois, valeurs manquantes vides. */
function ligne(numero: number, ...valeurs: readonly (number | null)[]): LigneDeGrille {
  return {
    numero,
    close: false,
    cases: TABLEE.map((joueur, rang) => ({ joueur, valeur: valeurs[rang] ?? null })),
  };
}

/**
 * La feuille de score telle que la page la lit, **totaux calculés par le
 * moteur** et non écrits à la main : une carte fabriquée dans le test prouverait
 * seulement que le composant sait afficher une carte.
 */
function feuille(...lignes: readonly LigneDeGrille[]): VueDeGrille {
  const manches: Manche[] = lignes.map((une) => ({
    close: une.close,
    participants: TABLEE.map((joueur) => joueur.id),
    cases: une.cases.map(({ joueur, valeur }) => ({ joueurId: joueur.id, valeur })),
  }));

  return { manches: lignes, etat: evaluer(REGLES, manches) };
}

/** La grille rendue pour la tablée de trois. */
function grille(...lignes: readonly LigneDeGrille[]): string {
  return renderToStaticMarkup(<GrilleDeScore partie={PARTIE} grille={feuille(...lignes)} />);
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

  it("ne montre rien avant la première manche, plutôt qu'un tableau de tirets", () => {
    // La règle vit dans la grille et non chez ses appelants : deux écrans
    // devant s'en souvenir sont un écran qui l'oubliera.
    expect(grille()).toBe("");
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

/** L'accueil, avec ou sans partie qui tourne. */
function accueil(enCours: EnCours | null): string {
  return renderToStaticMarkup(
    <Accueil entrees={Object.values(CATALOGUE)} enCours={enCours} sondage={null} />,
  );
}

/** Ce que la page passe quand une soirée est en cours. */
function enCours(...lignes: readonly LigneDeGrille[]): EnCours {
  return {
    partie: PARTIE,
    grille: feuille(...lignes),
    ouvrirLaMancheSuivante: "/p/A1B2C3/manche",
  };
}

describe("l'accueil sans partie en cours", () => {
  it("rend tout l'écran au catalogue", () => {
    const html = accueil(null);

    expect(html).toContain("6 qui prend");
    expect(html).toContain("Uno");
    expect(html).toContain("Dnup");
    expect(html).not.toContain("<details");
  });

  it("ne montre ni grille ni manche à saisir : il n'y a pas de partie", () => {
    const html = accueil(null);

    expect(html).not.toContain("<table");
    expect(html).not.toContain("Saisir la manche suivante");
  });

  it("mène à l'historique, seule porte des parties déjà finies", () => {
    // Une partie scellée disparaît de l'accueil — elle n'est plus en cours — et
    // sa fiche renvoie ici. Sans ce lien, la retrouver demanderait son code.
    expect(accueil(null)).toContain('href="/historique"');
  });
});

describe("l'accueil quand une partie tourne", () => {
  it("montre cette partie, sa grille en tête", () => {
    const html = accueil(enCours(ligne(1, 8, 15, 0)));

    expect(html).toContain("<table");
    expect(html).toContain("A1B2C3");
  });

  it("met « saisir la manche suivante » à un appui", () => {
    expect(accueil(enCours(ligne(1, 8, 15, 0)))).toContain("Saisir la manche suivante");
  });

  it("fait passer le catalogue au second rang, sans le perdre", () => {
    // Le coût est assumé : le catalogue disparaît de la *vue* tant qu'une
    // partie tourne. Le supprimer de la page serait un autre prix — il n'y a
    // pas d'autre écran d'où ouvrir une partie.
    const html = accueil(enCours(ligne(1, 8)));

    expect(html).toContain("<details");
    expect(html).toContain("Uno");
    expect(html.indexOf("<table")).toBeLessThan(html.indexOf("<details"));
  });

  it("laisse rejoindre une deuxième partie en cours par son code", () => {
    // C'est le bouton derrière lequel elle est : l'accueil n'en montre qu'une.
    expect(accueil(enCours(ligne(1, 8)))).toContain('name="code"');
  });

  it("mène à la page de la partie, où vivent la tablée et le reste", () => {
    expect(accueil(enCours(ligne(1, 8)))).toContain('href="/p/A1B2C3"');
  });

  it("mène encore à l'historique, sans lui donner le devant de la scène", () => {
    const html = accueil(enCours(ligne(1, 8)));

    expect(html).toContain('href="/historique"');
    expect(html.indexOf("<table")).toBeLessThan(html.indexOf('href="/historique"'));
  });

  it("montre la partie même avant sa première manche, sans grille vide", () => {
    const html = accueil(enCours());

    expect(html).toContain("A1B2C3");
    expect(html).toContain("Saisir la manche suivante");
    expect(html).not.toContain("<table");
  });
});
