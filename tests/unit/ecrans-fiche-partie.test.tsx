import { describe, expect, it } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { FicheDePartie } from "@/components/fiche-partie";
import type { GestesDuTiroir } from "@/components/tiroir-journal";
import { trouverEntree } from "@/lib/jeux/catalogue";
import { evaluer, type Manche } from "@/lib/jeux/moteur";
import { resoudreRegles } from "@/lib/jeux/resolution";
import type { VueDuTiroir } from "@/lib/journal/tiroir";
import type { LigneDeGrille, VueDeGrille } from "@/lib/manche/lecture";
import type { FinDePartie } from "@/lib/partie/fin";
import type { VueDePartie } from "@/lib/partie/lecture";
import { LEA, MARIE, PAUL, TABLEE } from "./helpers/tablee";

const SIX_QUI_PREND = trouverEntree("6-qui-prend");
const REGLES = resoudreRegles(SIX_QUI_PREND, { nombreDeJoueurs: 3 });

const PARTIE: VueDePartie = {
  id: 1,
  code: "A1B2C3",
  jeu: SIX_QUI_PREND,
  regles: REGLES,
  version: 12,
  participants: [...TABLEE],
};

/** La fin d'une partie régulièrement terminée, à une date fixe. */
const TERMINEE: FinDePartie = {
  le: new Date("2026-09-08T19:45:00.000Z"),
  cause: "terminee",
  par: MARIE.id,
};

/** La fin d'une partie qu'on a rangée sans la finir. */
const ABANDONNEE: FinDePartie = {
  le: new Date("2026-09-08T19:45:00.000Z"),
  cause: "abandonnee",
  par: MARIE.id,
};

/** Rien à ranger : ce que `sortiesDePartie` rend sur une partie terminée. */
const AUCUNE_SORTIE: GestesDuTiroir = {
  abandonner: undefined,
  reprendre: undefined,
  supprimer: undefined,
};

/** Ce qu'elle rend sur une partie abandonnée, pour qui est de la tablée. */
const REPRISE_OFFERTE: GestesDuTiroir = { ...AUCUNE_SORTIE, reprendre: "/p/reprendre" };

/** Une ligne de grille pour la tablée de trois, valeurs manquantes vides. */
function ligne(numero: number, ...valeurs: readonly (number | null)[]): LigneDeGrille {
  return {
    numero,
    close: true,
    cases: TABLEE.map((joueur, rang) => ({ joueur, valeur: valeurs[rang] ?? null })),
  };
}

/**
 * La feuille telle que la page la lit, **totaux calculés par le moteur**.
 *
 * Une carte fabriquée à la main prouverait seulement que le composant sait
 * afficher une carte ; celle-ci prouve qu'il montre ce que la partie vaut.
 */
function feuille(...lignes: readonly LigneDeGrille[]): VueDeGrille {
  const manches: Manche[] = lignes.map((une) => ({
    close: une.close,
    participants: TABLEE.map((joueur) => joueur.id),
    cases: une.cases.map(({ joueur, valeur }) => ({ joueurId: joueur.id, valeur })),
  }));

  return { manches: lignes, etat: evaluer(REGLES, manches) };
}

function rendre(
  options: {
    grille?: VueDeGrille;
    fin?: FinDePartie;
    tiroir?: VueDuTiroir;
    gestesDuTiroir?: GestesDuTiroir;
    erreur?: string;
  } = {},
): string {
  return renderToStaticMarkup(
    <FicheDePartie
      partie={PARTIE}
      grille={options.grille ?? feuille(ligne(1, 8, 3, 0), ligne(2, 12, 5, 60))}
      fin={options.fin ?? TERMINEE}
      tiroir={options.tiroir ?? { etat: "ferme" }}
      gestesDuTiroir={options.gestesDuTiroir ?? AUCUNE_SORTIE}
      erreur={options.erreur}
    />,
  );
}

describe("la fiche de partie", () => {
  it("est la grille complète, manche par manche", () => {
    const html = rendre();

    // Les deux manches, et chaque case de chacune : c'est littéralement la
    // feuille de score, pas un résumé de fin de partie.
    expect(html).toContain(">1</th>");
    expect(html).toContain(">2</th>");
    for (const valeur of [8, 3, 0, 12, 5, 60]) {
      expect(html).toContain(`>${valeur}</td>`);
    }
  });

  it("porte les totaux du moteur, et non une addition refaite ici", () => {
    const html = rendre();

    // Marie 20, Paul 8, Léa 60 : rien n'est stocké, le moteur recalcule depuis
    // les manches, et c'est ce qui fait que la fiche ne coûte rien.
    for (const total of [20, 8, 60]) {
      expect(html).toContain(`>${total}</td>`);
    }
  });

  it("nomme les colonnes par les joueurs de la tablée", () => {
    const html = rendre();

    for (const joueur of [MARIE, PAUL, LEA]) {
      expect(html).toContain(joueur.nom);
    }
  });

  it("laisse le journal ouvrable depuis une partie scellée", () => {
    // Une partie scellée n'est pas une partie muette : c'est précisément après
    // coup qu'on vient chercher pourquoi un score a bougé.
    expect(rendre()).toContain(`href="/p/${PARTIE.code}?journal=corrections"`);
  });

  it("ouvre le tiroir sur la fiche, sans quitter la page", () => {
    const html = rendre({
      tiroir: { etat: "ouvert", portee: "corrections", lignes: [] },
    });

    expect(html).toContain("Journal de la partie");
  });

  it("dit quand la partie s'est finie", () => {
    const html = rendre();

    // La date lisible et la date machine : l'une pour la table, l'autre pour
    // qui lit la page autrement qu'à l'œil.
    expect(html).toContain("2026-09-08T19:45:00.000Z");
    expect(html).toContain("Partie terminée le ");
    expect(html).toContain("08/09/2026 à 21:45");
  });

  it("marque une partie abandonnée pour ce qu'elle est", () => {
    const html = rendre({
      fin: { le: TERMINEE.le, cause: "abandonnee", par: MARIE.id },
    });

    expect(html).toContain("abandonn");
  });

  it("n'offre pas de saisir la manche suivante : la partie ne bouge plus", () => {
    expect(rendre()).not.toContain("Saisir la manche suivante");
  });

  it("montre encore le refus d'une écriture arrivée trop tard", () => {
    // Le téléphone de Marie peut être resté sur la tablée pendant que Paul
    // closait la manche qui a terminé la partie : son geste revient ici, et
    // c'est la fiche qui doit lui dire pourquoi il n'a rien fait.
    const html = rendre({ erreur: "Cette partie est terminée : elle ne bouge plus." });

    expect(html).toContain('role="alert"');
    expect(html).toContain("Cette partie est terminée : elle ne bouge plus.");
  });

  it("ne montre aucun bandeau quand rien n'a été refusé", () => {
    expect(rendre()).not.toContain('role="alert"');
  });

  it("ne montre pas de courbe : la grille montre déjà la progression, en chiffres", () => {
    expect(rendre()).not.toContain("<svg");
  });
});

describe("la fiche d'une partie abandonnée", () => {
  it("dit qu'elle est abandonnée, et non terminée", () => {
    const html = rendre({ fin: ABANDONNEE });

    expect(html).toContain("Partie abandonnée");
    expect(html).not.toContain("Partie terminée");
  });

  it("offre la reprise depuis le tiroir, la seule écriture qu'elle accepte", () => {
    const html = rendre({
      fin: ABANDONNEE,
      tiroir: { etat: "ouvert", portee: "corrections", lignes: [] },
      gestesDuTiroir: REPRISE_OFFERTE,
    });

    expect(html).toContain('action="/p/reprendre"');
    expect(html).toContain("Reprendre la partie");
  });

  it("ne la propose pas sur une partie terminée : celle-là ne se rouvre pas", () => {
    const html = rendre({
      fin: TERMINEE,
      tiroir: { etat: "ouvert", portee: "corrections", lignes: [] },
    });

    expect(html).not.toContain("Reprendre la partie");
    expect(html).not.toContain("Abandonner la partie");
  });
});
