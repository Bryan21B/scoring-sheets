import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import type { Base } from "@/db/base";
import { cloturerLaManche } from "@/lib/manche/cloture";
import { ouvrirLaMancheSuivante } from "@/lib/manche/ouverture";
import { ecrireLaCase } from "@/lib/manche/saisie";
import { estampillerLaFin } from "@/lib/partie/fin";
import { lireLHistorique } from "@/lib/partie/historique";
import { type BaseDeTest, creerBaseDeTest } from "../helpers/base-de-test";
import {
  joueurDeLaPartie,
  ouvrirUnePartieDeTest,
  type PartieDeTest,
} from "../helpers/partie-de-test";

let baseDeTest: BaseDeTest;
let base: Base;
let soirees: number;

/** Tout l'historique, sans filtre : ce que la page montre par défaut. */
const TOUT = { jeuId: null, combien: 20 } as const;

/**
 * Une tablée de noms encore jamais vus.
 *
 * Le roster est global : rouvrir une partie sous « Marie » quand une Marie
 * existe déjà déclenche la désambiguïsation, ce qui est le bon comportement de
 * la création et un piège pour un test qui finit trois parties d'affilée.
 */
function tableeInedite(combien: number): string[] {
  soirees += 1;

  return ["Marie", "Paul", "Léa"].slice(0, combien).map((nom) => `${nom} ${soirees}`);
}

/**
 * Une partie **vraiment jouée puis finie**, par les chemins d'écriture réels.
 *
 * Aucune ligne posée à la main : la manche s'ouvre, les cases s'écrivent, la
 * manche se clôt, la fin s'estampille. C'est ce qui fait que le lecteur est
 * vérifié contre de vraies données et non contre l'idée qu'on s'en fait.
 *
 * Les valeurs restent sous le seuil de 6 qui prend pour que la clôture
 * n'estampille pas la fin toute seule : sinon la date serait celle de
 * l'horloge, et l'ordre de l'historique ne se testerait plus.
 */
async function finirUnePartie(options: {
  finLe: Date;
  valeurs: readonly number[];
  jeuId?: string;
  cause?: "terminee" | "abandonnee";
}): Promise<PartieDeTest> {
  const partie = await ouvrirUnePartieDeTest(base, {
    ...(options.jeuId === undefined ? {} : { jeuId: options.jeuId }),
    noms: tableeInedite(options.valeurs.length),
  });
  const manche = await ouvrirLaMancheSuivante(base, partie.partieId);

  for (const [rang, valeur] of options.valeurs.entries()) {
    await ecrireLaCase(base, {
      mancheId: manche.id,
      joueurConcerneId: joueurDeLaPartie(partie, rang),
      valeurMontree: null,
      valeur,
      agissant: { joueurId: joueurDeLaPartie(partie, 0), appareilId: partie.idAppareil },
    });
  }

  await cloturerLaManche(base, {
    mancheId: manche.id,
    parJoueurId: joueurDeLaPartie(partie, 0),
  });

  await base.transaction((tx) =>
    estampillerLaFin(tx, partie.partieId, {
      le: options.finLe,
      cause: options.cause ?? "terminee",
      par: joueurDeLaPartie(partie, 0),
    }),
  );

  return partie;
}

beforeEach(() => {
  baseDeTest = creerBaseDeTest();
  base = baseDeTest.base;
  soirees = 0;
});

afterEach(() => {
  baseDeTest.fermer();
});

describe("l'historique", () => {
  it("range les parties de la plus récente à la plus ancienne, par date de fin", async () => {
    const veille = await finirUnePartie({ finLe: new Date("2026-01-03"), valeurs: [1, 2, 3] });
    const hier = await finirUnePartie({ finLe: new Date("2026-01-05"), valeurs: [1, 2, 3] });
    const vieille = await finirUnePartie({ finLe: new Date("2026-01-01"), valeurs: [1, 2, 3] });

    const historique = await lireLHistorique(base, TOUT);

    expect(historique.lignes.map((ligne) => ligne.code)).toEqual([
      hier.code,
      veille.code,
      vieille.code,
    ]);
  });

  it("ne montre pas une partie encore en cours", async () => {
    const finie = await finirUnePartie({ finLe: new Date("2026-01-03"), valeurs: [1, 2, 3] });
    await ouvrirUnePartieDeTest(base);

    const historique = await lireLHistorique(base, TOUT);

    expect(historique.lignes.map((ligne) => ligne.code)).toEqual([finie.code]);
  });

  it("porte le jeu, la date, le vainqueur et le nombre de joueurs, et rien de plus", async () => {
    const partie = await finirUnePartie({
      finLe: new Date("2026-01-05T20:30:00.000Z"),
      // 6 qui prend se gagne par le bas : Paul, à 4, l'emporte.
      valeurs: [10, 4, 7],
    });

    const [ligne] = (await lireLHistorique(base, TOUT)).lignes;

    expect(ligne?.jeu.nom).toBe("6 qui prend");
    expect(ligne?.finLe).toEqual(new Date("2026-01-05T20:30:00.000Z"));
    expect(ligne?.vainqueur).toEqual(partie.joueurs[1] ?? null);
    expect(ligne?.nombreDeJoueurs).toBe(3);
  });

  it("ne nomme aucun vainqueur quand la tête est à égalité", async () => {
    // Le moteur sort son classement en groupes de rang : deux joueurs à 4 sont
    // dans le même groupe, et l'égalité ne se départage nulle part.
    await finirUnePartie({ finLe: new Date("2026-01-05"), valeurs: [10, 4, 4] });

    expect((await lireLHistorique(base, TOUT)).lignes[0]?.vainqueur).toBeNull();
  });

  it("marque une partie abandonnée et ne lui donne pas de vainqueur", async () => {
    await finirUnePartie({
      finLe: new Date("2026-01-05"),
      valeurs: [10, 4, 7],
      cause: "abandonnee",
    });

    const [ligne] = (await lireLHistorique(base, TOUT)).lignes;

    expect(ligne?.cause).toBe("abandonnee");
    expect(ligne?.vainqueur).toBeNull();
  });

  it("compte les joueurs de la tablée, pas ceux du roster", async () => {
    await finirUnePartie({ finLe: new Date("2026-01-05"), valeurs: [1, 2] });
    await finirUnePartie({ finLe: new Date("2026-01-04"), valeurs: [1, 2, 3] });

    expect((await lireLHistorique(base, TOUT)).lignes.map((une) => une.nombreDeJoueurs)).toEqual([
      2, 3,
    ]);
  });
});
