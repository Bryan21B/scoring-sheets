import { describe, expect, it } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { FicheJoueur } from "@/components/fiche-joueur";
import { CATALOGUE, type EntreeCatalogue, trouverEntree } from "@/lib/jeux/catalogue";
import { ADRESSE_PALMARES } from "@/lib/palmares/adresse";
import type { Compteur, FicheDeJoueur } from "@/lib/palmares/fiche";
import { compterLesParties, grouperParFamille } from "@/lib/palmares/fiche";
import { MARIE } from "./helpers/tablee";

const SIX_QUI_PREND = trouverEntree("6-qui-prend");
const CARTES_SPECIALES = trouverEntree("6-qui-prend-cartes-speciales");
const UNO = trouverEntree("uno");
const DNUP = trouverEntree("dnup");

/** La date de fin des compteurs de ces tests, fixe pour que l'heure lue le soit. */
const DERNIERE = new Date("2026-09-08T19:45:00.000Z");

function compteur(jeu: EntreeCatalogue, options: Partial<Compteur> = {}): Compteur {
  return { jeu, partiesJouees: 0, victoires: 0, dernierePartie: null, ...options };
}

/**
 * Une fiche bâtie par le **vrai** groupement, à partir de compteurs donnés.
 *
 * `grouperParFamille` plutôt qu'une arborescence écrite à la main : c'est la
 * fonction qui décide ce qui va sous quelle famille, et recopier son résultat
 * ici laisserait l'écran se vérifier contre une idée du groupement plutôt que
 * contre le groupement.
 */
function fiche(compteurs: readonly Compteur[]): FicheDeJoueur {
  return { joueur: MARIE, familles: grouperParFamille(compteurs) };
}

/** Les quatre entrées, chacune à zéro : la fiche de qui n'a rien joué. */
function toutAZero(): Compteur[] {
  return Object.values(CATALOGUE).map((jeu) => compteur(jeu));
}

function rendre(compteurs: readonly Compteur[] = toutAZero()): string {
  return renderToStaticMarkup(<FicheJoueur fiche={fiche(compteurs)} />);
}

describe("la fiche de joueur", () => {
  it("porte le nom du joueur et ramène au palmarès", () => {
    const html = rendre();

    expect(html).toContain(MARIE.nom);
    expect(html).toContain(`href="${ADRESSE_PALMARES}"`);
  });

  it("montre un compteur par entrée du catalogue", () => {
    const html = rendre();

    for (const jeu of Object.values(CATALOGUE)) {
      expect(html).toContain(jeu.nom);
    }
  });

  it("porte les parties jouées, les victoires et la dernière partie", () => {
    const html = rendre([
      compteur(SIX_QUI_PREND, { partiesJouees: 9, victoires: 4, dernierePartie: DERNIERE }),
    ]);

    expect(html).toContain("9 parties");
    expect(html).toContain("4 victoires");
    // La date lisible et la date machine, comme sur l'historique : l'une pour la
    // table, l'autre pour qui lit la page autrement qu'à l'œil.
    expect(html).toContain("08/09/2026 à 21:45");
    expect(html).toContain(DERNIERE.toISOString());
  });

  it("dit qu'une entrée n'a jamais été jouée plutôt que d'afficher un zéro nu", () => {
    const html = rendre([compteur(UNO)]);

    expect(html).toContain("Jamais jouée");
  });

  it("accorde le singulier d'une seule partie et d'une seule victoire", () => {
    const html = rendre([
      compteur(SIX_QUI_PREND, { partiesJouees: 1, victoires: 1, dernierePartie: DERNIERE }),
    ]);

    expect(html).toContain("1 partie");
    expect(html).toContain("1 victoire");
    expect(html).not.toContain("1 victoires");
  });

  it("compte pour Dnup, qui n'a pas de score", () => {
    // Le compteur ne lit que le classement : une entrée qui ne distribue que des
    // jetons, et pas même ça à deux joueurs, en porte un comme les autres.
    const html = rendre([
      compteur(DNUP, { partiesJouees: 3, victoires: 2, dernierePartie: DERNIERE }),
    ]);

    expect(html).toContain(DNUP.nom);
    expect(html).toContain("3 parties");
    expect(html).toContain("2 victoires");
  });
});

describe("la famille sur la fiche de joueur", () => {
  it("garde les deux 6 qui prend séparés sous leur famille", () => {
    // Sur douze parties, neuf étaient le jeu de base et trois la variante : un
    // compteur fusionné dirait « 12 parties » et cacherait exactement ça.
    const html = rendre([
      compteur(SIX_QUI_PREND, { partiesJouees: 9, victoires: 4, dernierePartie: DERNIERE }),
      compteur(CARTES_SPECIALES, { partiesJouees: 3, victoires: 1, dernierePartie: DERNIERE }),
    ]);

    expect(html).toContain(SIX_QUI_PREND.nom);
    expect(html).toContain(CARTES_SPECIALES.nom);
    expect(html).toContain("9 parties");
    expect(html).toContain("3 parties");
  });

  it("ajoute le sous-total de famille sans remplacer les compteurs", () => {
    const html = rendre([
      compteur(SIX_QUI_PREND, { partiesJouees: 9, victoires: 4, dernierePartie: DERNIERE }),
      compteur(CARTES_SPECIALES, { partiesJouees: 3, victoires: 1, dernierePartie: DERNIERE }),
    ]);

    // « J'ai gagné cinq parties de 6 qui prend » : la phrase qu'un joueur dirait
    // vraiment, à côté des deux faits, jamais à leur place.
    expect(html).toContain("12 parties");
    expect(html).toContain("5 victoires");
    expect(html).toContain("9 parties");
    expect(html).toContain("4 victoires");
  });

  it("ne sous-totalise pas une famille qui n'a qu'une entrée", () => {
    // Un sous-total d'une seule ligne répéterait la ligne, mot pour mot.
    const html = rendre([compteur(UNO, { partiesJouees: 7, victoires: 2 })]);

    expect(html).not.toContain("Total");
  });

  it("range les entrées dans l'ordre du catalogue, famille par famille", () => {
    const html = rendre();

    expect(html.indexOf(SIX_QUI_PREND.nom)).toBeLessThan(html.indexOf(UNO.nom));
    expect(html.indexOf(UNO.nom)).toBeLessThan(html.indexOf(DNUP.nom));
  });
});

describe("la fiche telle que la page la sert", () => {
  it("part des compteurs réels, un par entrée, sans en perdre en route", () => {
    // Ce que les tests de rendu ne peuvent pas montrer, parce qu'ils fabriquent
    // leurs compteurs : que `compterLesParties` et le balisage se rejoignent.
    const compteurs = compterLesParties(MARIE.id, [
      {
        partieId: 1,
        jeuId: "dnup",
        finLe: DERNIERE,
        classement: [[MARIE.id], [42]],
      },
    ]);

    const html = renderToStaticMarkup(<FicheJoueur fiche={fiche(compteurs)} />);

    expect(html).toContain("1 partie");
    expect(html).toContain("1 victoire");
    expect(html).toContain("08/09/2026 à 21:45");
  });
});
