import { describe, expect, it } from "bun:test";
import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { Action } from "@/components/champs";
import { FicheDePartie } from "@/components/fiche-partie";
import type { GestesDuTiroir } from "@/components/tiroir-journal";
import { trouverEntree } from "@/lib/jeux/catalogue";
import { evaluer, type Manche } from "@/lib/jeux/moteur";
import { resoudreRegles } from "@/lib/jeux/resolution";
import type { VueDuTiroir } from "@/lib/journal/tiroir";
import type { CaseDeManche, LigneDeGrille, VueDeGrille } from "@/lib/manche/lecture";
import type { FinDePartie } from "@/lib/partie/fin";
import type { VueDePartie } from "@/lib/partie/lecture";
import { marchesDuClassement } from "@/lib/partie/podium";
import type { JoueurConnu } from "@/lib/roster/noms";
import { AUCUNE_SORTIE } from "./helpers/sorties";
import { caseDe, casesDeLaTablee, LEA, MARIE, PAUL, TABLEE } from "./helpers/tablee";

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

/** Ce qu'elle rend sur une partie abandonnée, pour qui est de la tablée. */
const REPRISE_OFFERTE: GestesDuTiroir = { ...AUCUNE_SORTIE, reprendre: "/p/reprendre" };

/** Une ligne de grille pour la tablée de trois, valeurs manquantes vides. */
function ligne(numero: number, ...valeurs: readonly (number | null)[]): LigneDeGrille {
  return {
    numero,
    close: true,
    cases: casesDeLaTablee(...valeurs),
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
    partie?: VueDePartie;
    grille?: VueDeGrille;
    fin?: FinDePartie;
    tiroir?: VueDuTiroir;
    gestesDuTiroir?: GestesDuTiroir;
    sondage?: ReactNode;
    confettis?: ReactNode;
    rejouer?: Action;
    erreur?: string;
  } = {},
): string {
  const partie = options.partie ?? PARTIE;
  const grille = options.grille ?? feuille(ligne(1, 8, 3, 0), ligne(2, 12, 5, 60));

  return renderToStaticMarkup(
    <FicheDePartie
      partie={partie}
      grille={grille}
      fin={options.fin ?? TERMINEE}
      marches={marchesDuClassement(grille.etat, partie.participants)}
      tiroir={options.tiroir ?? { etat: "ferme" }}
      gestesDuTiroir={options.gestesDuTiroir ?? AUCUNE_SORTIE}
      sondage={options.sondage ?? null}
      confettis={options.confettis ?? null}
      rejouer={options.rejouer}
      erreur={options.erreur}
    />,
  );
}

/** Tout ce qui précède la feuille de score : l'en-tête, et le podium. */
function auDessusDeLaGrille(html: string): string {
  return html.slice(0, html.indexOf("<table"));
}

/** Les seules marches, sans le classement qui les suit. */
function lesMarches(html: string): string {
  return html.slice(html.indexOf('aria-label="Podium"'), html.indexOf('aria-label="Classement"'));
}

/** Ce qu'une marche inoccupée montre — voir `marchesDuPodium`. */
const PLACE_VACANTE = "—";

/** La tablée de deux, celle où le podium ne se dresse pas. */
const DUO: readonly JoueurConnu[] = [MARIE, PAUL];

/** La même partie à deux joueurs : règles résolues pour cet effectif. */
const PARTIE_A_DEUX: VueDePartie = {
  ...PARTIE,
  regles: resoudreRegles(SIX_QUI_PREND, { nombreDeJoueurs: 2 }),
  participants: [...DUO],
};

/**
 * Une feuille jouée à deux, **passée par le moteur** comme celle à trois : le
 * classement d'un duo doit sortir du même décompte, sinon le test de lisibilité
 * vérifierait une fixture au lieu d'une partie.
 */
function feuilleADeux(...totaux: readonly number[]): VueDeGrille {
  const cases: CaseDeManche[] = DUO.map((joueur, rang) => caseDe(joueur, totaux[rang] ?? 0));
  const lignes: LigneDeGrille[] = [{ numero: 1, close: true, cases }];
  const manches: Manche[] = [
    {
      close: true,
      participants: DUO.map((joueur) => joueur.id),
      cases: cases.map(({ joueur, valeur }) => ({ joueurId: joueur.id, valeur })),
    },
  ];

  return { manches: lignes, etat: evaluer(PARTIE_A_DEUX.regles, manches) };
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

  it("se sonde : la reprise doit arriver aux autres sans qu'ils rechargent", () => {
    // L'abandon a fait bouger l'estampille et les a amenés ici ; sans sondage
    // ils y resteraient pendant que la soirée a redémarré sans eux.
    const html = rendre({ fin: ABANDONNEE, sondage: <p>estampille</p> });

    expect(html).toContain("estampille");
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

describe("le podium d'une partie terminée", () => {
  it("dresse ses marches et pose le classement complet au-dessus de la grille", () => {
    // Le critère de l'issue, en un seul endroit : le podium **compose** avec la
    // fiche, il ne la remplace pas — la feuille de score reste en dessous.
    const podium = auDessusDeLaGrille(rendre());

    expect(podium).toContain('aria-label="Podium"');
    expect(podium).toContain('aria-label="Classement"');
    // À 6 qui prend le plus bas gagne : Paul 8, Marie 20, Léa 60.
    expect(podium).toContain("Paul");
    expect(podium.indexOf("Paul")).toBeLessThan(podium.indexOf("Marie"));
    expect(podium.indexOf("Marie")).toBeLessThan(podium.indexOf("Léa"));
  });

  it("porte les totaux du moteur sur ses marches, et non des rangs nus", () => {
    const podium = auDessusDeLaGrille(rendre());

    for (const total of [8, 20, 60]) {
      expect(podium).toContain(String(total));
    }
  });

  it("dessine toujours trois places, toutes occupées quand rien n'est à égalité", () => {
    const marches = lesMarches(rendre());

    expect(marches.split("<li").length - 1).toBe(3);
    expect(marches).not.toContain(PLACE_VACANTE);
  });

  it("laisse la marche du rang sauté vide quand deux partagent la tête", () => {
    // Marie et Paul à 8, Léa à 60 : rang 1 partagé, rang 2 inoccupé, Léa au
    // rang 3. Un podium qui tasserait les marches montrerait Léa deuxième.
    const html = rendre({ grille: feuille(ligne(1, 8, 8, 60)) });
    const marches = lesMarches(html);

    expect(marches.split("<li").length - 1).toBe(3);
    expect(marches).toContain("Marie et Paul");
    expect(marches).toContain(PLACE_VACANTE);
    expect(marches.indexOf(PLACE_VACANTE)).toBeLessThan(marches.indexOf("Léa"));
    // Le classement, lui, saute bien de la tête partagée au rang 3.
    expect(auDessusDeLaGrille(html)).toContain("3e");
  });
});

describe("l'écran de fin à deux joueurs", () => {
  it("se passe des trois marches, et garde le classement lisible", () => {
    // Un podium à deux laisserait une marche occupée et deux vides : ça ne se
    // lit pas comme un podium, mais comme un podium cassé.
    const html = rendre({ partie: PARTIE_A_DEUX, grille: feuilleADeux(20, 8) });
    const podium = auDessusDeLaGrille(html);

    expect(podium).not.toContain('aria-label="Podium"');
    expect(podium).toContain('aria-label="Classement"');
    expect(podium).toContain("Paul");
    expect(podium).toContain("Marie");
    expect(podium.indexOf("Paul")).toBeLessThan(podium.indexOf("Marie"));
  });
});

describe("rejouer la même tablée", () => {
  it("offre la sortie principale de l'écran de fin", () => {
    const html = rendre({ rejouer: "/p/rejouer" });

    expect(html).toContain('action="/p/rejouer"');
    expect(html).toContain("Rejouer la même tablée");
  });

  it("ne l'offre pas à qui regarde sans avoir joué", () => {
    // La page ne câble l'action que pour un participant : `rejouerLaTablee`
    // refuse le passant, et un bouton mort ne ferait que faire douter.
    expect(rendre()).not.toContain("Rejouer la même tablée");
  });

  it("ne l'offre pas sur une partie abandonnée, qui garde sa fiche d'aujourd'hui", () => {
    const html = rendre({ fin: ABANDONNEE, rejouer: "/p/rejouer" });

    expect(html).not.toContain('aria-label="Podium"');
    expect(html).not.toContain('aria-label="Classement"');
    expect(html).not.toContain("Rejouer la même tablée");
  });
});

describe("les confettis de la fin", () => {
  it("laissent la page les passer, comme elle passe le sondage", () => {
    // La décision « ils tombent, et à quelle densité » vit dans `fete.ts` ; ce
    // composant n'en sait rien et ne fait que porter ce que la page lui donne.
    expect(rendre({ confettis: <p>salve</p> })).toContain("salve");
  });
});
