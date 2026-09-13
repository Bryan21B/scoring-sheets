import { describe, expect, it } from "bun:test";
import {
  FENETRE_DE_FETE_MS,
  type Fete,
  feteDeLaFin,
  PIECES_POUR_LA_TABLE,
  PIECES_POUR_LE_VAINQUEUR,
} from "@/lib/partie/fete";
import type { FinDePartie } from "@/lib/partie/fin";
import { INTERVALLE_DE_SONDAGE_MS } from "@/lib/partie/sondage";

/** L'instant où la manche qui a terminé la partie s'est close. */
const FIN_LE = new Date("2026-09-11T20:30:00.000Z");

/** Une partie régulièrement terminée : la seule qui se fête. */
const TERMINEE: FinDePartie = { le: FIN_LE, cause: "terminee", par: 1 };

/** Une partie rangée sans être finie : il n'y a pas de vainqueur à fêter. */
const ABANDONNEE: FinDePartie = { le: FIN_LE, cause: "abandonnee", par: 1 };

/**
 * Ce que décide la fête, pour un écart au temps de la fin donné en
 * millisecondes.
 *
 * L'écart plutôt qu'une date absolue : c'est la seule chose dont la décision
 * dépende, et deux dates à soustraire de tête à chaque assertion cacheraient
 * exactement le nombre qu'on veut lire.
 */
function apres(
  ecartMs: number,
  options: { fin?: FinDePartie; deLaPartie?: boolean; vainqueur?: boolean } = {},
): Fete {
  return feteDeLaFin({
    fin: options.fin ?? TERMINEE,
    deLaPartie: options.deLaPartie ?? true,
    vainqueur: options.vainqueur ?? false,
    maintenant: FIN_LE.getTime() + ecartMs,
  });
}

/** Les pièces que la fête fait tomber, ou `0` quand elle ne tombe pas. */
function pieces(fete: Fete): number {
  return fete.statut === "tombe" ? fete.pieces : 0;
}

describe("la fête d'une fin de partie", () => {
  it("tombe chez le vainqueur, à l'instant où la partie se termine", () => {
    expect(apres(0, { vainqueur: true })).toEqual({
      statut: "tombe",
      pieces: PIECES_POUR_LE_VAINQUEUR,
    });
  });

  it("tombe chez les autres participants aussi : la partie s'est finie pour toute la table", () => {
    expect(apres(0, { vainqueur: false })).toEqual({
      statut: "tombe",
      pieces: PIECES_POUR_LA_TABLE,
    });
  });

  it("tombe plus dense chez le vainqueur que chez le reste de la table", () => {
    expect(pieces(apres(0, { vainqueur: true }))).toBeGreaterThan(
      pieces(apres(0, { vainqueur: false })),
    );
  });

  it("ne tombe pas chez qui regarde la partie sans y jouer", () => {
    // Le code donne la lecture : un passant peut très bien ouvrir le lien dans
    // la minute. La partie ne s'est pas finie pour lui.
    expect(apres(0, { deLaPartie: false })).toEqual({ statut: "aucune" });
  });

  it("ne tombe pas sur une partie abandonnée, même à l'instant de l'abandon", () => {
    // Une partie abandonnée n'a pas de vainqueur — c'est la même décision de
    // domaine que l'historique, qui n'en nomme aucun. Il n'y a rien à fêter.
    expect(apres(0, { fin: ABANDONNEE, vainqueur: true })).toEqual({ statut: "aucune" });
  });

  it("ne tombe pas sur un lien rouvert trois jours plus tard", () => {
    const troisJours = 3 * 24 * 60 * 60 * 1000;

    expect(apres(troisJours, { vainqueur: true })).toEqual({ statut: "aucune" });
  });

  it("couvre un battement de sondage manqué : « en même temps » vaut à trois secondes près", () => {
    // Le téléphone de Léa a sondé juste avant la clôture : il n'apprend la fin
    // qu'au battement suivant, et le rendu qui suit coûte encore un aller-retour.
    expect(apres(INTERVALLE_DE_SONDAGE_MS + 1).statut).toBe("tombe");
  });

  it("laisse au moins un battement de sondage de marge après le battement manqué", () => {
    // La relation, et non le nombre : la fenêtre se relit du sondage, et la
    // recopier en dur ici la laisserait survivre à un intervalle changé.
    expect(FENETRE_DE_FETE_MS).toBeGreaterThanOrEqual(2 * INTERVALLE_DE_SONDAGE_MS);
  });

  it("tombe encore au dernier instant de la fenêtre, et plus du tout après", () => {
    expect(apres(FENETRE_DE_FETE_MS).statut).toBe("tombe");
    expect(apres(FENETRE_DE_FETE_MS + 1)).toEqual({ statut: "aucune" });
  });

  it("tombe quand l'horloge du rendu est en retard sur l'estampille", () => {
    // Une fin estampillée « dans le futur » est une horloge qui a bougé, pas un
    // lien rouvert : refuser la fête là ferait rater la seule qui comptait.
    expect(apres(-50).statut).toBe("tombe");
  });
});
