import { describe, expect, it } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { EcranDePartie, type GestesDePartie } from "@/components/ecran-de-partie";
import type { GestesDuTiroir } from "@/components/tiroir-journal";
import { trouverEntree } from "@/lib/jeux/catalogue";
import { evaluer, type Manche } from "@/lib/jeux/moteur";
import { resoudreRegles } from "@/lib/jeux/resolution";
import type { LigneDeGrille, VueDeGrille } from "@/lib/manche/lecture";
import type { VueDePartie } from "@/lib/partie/lecture";
import type { EtatDeSalle } from "@/lib/partie/salle-attente";
import { MARIE, TABLEE, ZOE } from "./helpers/tablee";

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

/**
 * Les adresses des quatre gestes, en clair : ce que le test cherche dans le
 * balisage, c'est l'absence ou la présence de ces formulaires-là.
 */
const GESTES: GestesDePartie = {
  ouvrirLaMancheSuivante: "/p/manche-suivante",
  rejoindre: "/p/rejoindre",
  ajouter: "/p/ajouter",
  retirer: "/p/retirer",
};

/**
 * Le tiroir ne range rien dans ces tests : cet écran-ci ne le montre que fermé,
 * et ce que le tiroir offre se vérifie sur le tiroir.
 */
const AUCUNE_SORTIE: GestesDuTiroir = {
  abandonner: undefined,
  reprendre: undefined,
  supprimer: undefined,
};

/** Une ligne de grille pour la tablée de trois, valeurs manquantes vides. */
function ligne(numero: number, ...valeurs: readonly (number | null)[]): LigneDeGrille {
  return {
    numero,
    close: true,
    cases: TABLEE.map((joueur, rang) => ({ joueur, valeur: valeurs[rang] ?? null })),
  };
}

/** La feuille telle que la page la lit, **totaux calculés par le moteur**. */
function feuille(...lignes: readonly LigneDeGrille[]): VueDeGrille {
  const manches: Manche[] = lignes.map((une) => ({
    close: une.close,
    participants: TABLEE.map((joueur) => joueur.id),
    cases: une.cases.map(({ joueur, valeur }) => ({ joueurId: joueur.id, valeur })),
  }));

  return { manches: lignes, etat: evaluer(REGLES, manches) };
}

/** Deux manches jouées : Marie 8 puis 12, ce qui fait 20 — compté à la main. */
const GRILLE = feuille(ligne(1, 8, 3, 5), ligne(2, 12, 4, 1));

/** Qui en est, et la partie tourne depuis deux manches. */
const PARTICIPANTE: EtatDeSalle = {
  gelee: true,
  arrivee: { statut: "participant", joueur: MARIE },
};

/** Le spectateur : son appareil est connu, sa personne n'est pas de la partie. */
const SPECTATRICE: EtatDeSalle = { gelee: true, arrivee: { statut: "propose", joueur: ZOE } };

/** L'écran entier, sous un état de salle donné. */
function rendre(salle: EtatDeSalle, erreur?: string): string {
  return renderToStaticMarkup(
    <EcranDePartie
      partie={PARTIE}
      grille={GRILLE}
      salle={salle}
      roster={[...TABLEE, ZOE]}
      tiroir={{ etat: "ferme" }}
      gestesDuTiroir={AUCUNE_SORTIE}
      gestes={GESTES}
      erreur={erreur}
      sondage={<p>estampille</p>}
    />,
  );
}

describe("l'écran d'une partie, pour qui en est", () => {
  it("offre le geste de la soirée : saisir la manche suivante", () => {
    const html = rendre(PARTICIPANTE);

    expect(html).toContain('action="/p/manche-suivante"');
    expect(html).toContain("Saisir la manche suivante");
  });

  it("porte tout ce que la page portait : code, grille, tablée, journal, sondage", () => {
    const html = rendre(PARTICIPANTE);

    expect(html).toContain("A1B2C3");
    expect(html).toContain("Total");
    expect(html).toContain("3 joueurs");
    expect(html).toContain("⋯");
    expect(html).toContain("estampille");
  });

  it("montre au-dessus du reste le refus rapporté par l'adresse", () => {
    const html = rendre(PARTICIPANTE, "La partie a commencé.");

    expect(html).toContain('role="alert"');
    expect(html).toContain("La partie a commencé.");
    expect(html.indexOf("La partie a commencé.")).toBeLessThan(html.indexOf("A1B2C3"));
  });

  it("ne montre pas de bandeau d'erreur quand l'adresse n'en porte pas", () => {
    expect(rendre(PARTICIPANTE)).not.toContain('role="alert"');
  });
});

describe("l'écran d'une partie, pour qui a le code sans y jouer", () => {
  it("ne lui offre aucune écriture : ni manche suivante, ni ajout, ni retrait", () => {
    // Le code donne la lecture, pas l'écriture. Sans ça, la spectatrice
    // ouvrirait une manche dans une partie où elle n'a pas de colonne.
    const html = rendre(SPECTATRICE);

    expect(html).not.toContain('action="/p/manche-suivante"');
    expect(html).not.toContain('action="/p/ajouter"');
    expect(html).not.toContain('action="/p/retirer"');
  });

  it("lui dit pourquoi, plutôt que de la laisser devant un écran inerte", () => {
    // Ni refus sec — regarder une partie où on ne joue pas est normal entre
    // amis — ni boutons absents sans explication.
    expect(rendre(SPECTATRICE)).toContain("Tu regardes cette partie, tu n’y joues pas.");
  });

  it("lui laisse la grille, ses valeurs et ses totaux", () => {
    const html = rendre(SPECTATRICE);
    const grille = html.slice(html.indexOf("<table"), html.indexOf("</table>"));

    expect(grille).toContain(">Marie</th>");
    expect(grille).toContain(">8</td>");
    expect(grille).toContain(">12</td>");
    // 8 + 12 : le total du moteur, pas une addition refaite ici.
    expect(grille).toContain(">20</td>");
  });

  it("lui laisse le code et le journal, qui se lisent aussi", () => {
    const html = rendre(SPECTATRICE);

    expect(html).toContain("A1B2C3");
    expect(html).toContain("⋯");
  });
});
