import { describe, expect, it } from "bun:test";
import {
  doitRafraichir,
  INTERVALLE_DE_SONDAGE_MS,
  reponseDeSondageSchema,
} from "@/lib/partie/sondage";

describe("l'intervalle du poll", () => {
  it("est de trois secondes, le chiffre que l'ADR 0003 a mesuré", () => {
    expect(INTERVALLE_DE_SONDAGE_MS).toBe(3000);
  });
});

describe("doitRafraichir", () => {
  it("ne rafraîchit pas sur une estampille inchangée", () => {
    expect(doitRafraichir(7, 7)).toBe(false);
  });

  it("rafraîchit sur une estampille qui a bougé", () => {
    expect(doitRafraichir(7, 8)).toBe(true);
  });

  it("rafraîchit aussi sur une estampille plus basse : ce qui compte est l'écart", () => {
    // Une base restaurée ou une partie recréée peut faire reculer le compteur.
    // « Différente » est la question, pas « plus grande » : rafraîchir de trop
    // coûte une lecture, ne pas rafraîchir coûte une soirée fausse.
    expect(doitRafraichir(8, 7)).toBe(true);
  });
});

describe("la réponse du sondage", () => {
  it("accepte une estampille entière", () => {
    expect(reponseDeSondageSchema.safeParse({ version: 12 }).success).toBe(true);
  });

  it("refuse une estampille absente plutôt que de comparer un undefined", () => {
    // Sans ce refus, `doitRafraichir(3, undefined)` serait vrai à chaque
    // battement : le poll rafraîchirait la page toutes les trois secondes.
    expect(reponseDeSondageSchema.safeParse({}).success).toBe(false);
  });

  it("refuse une estampille en texte, que du JSON laisse passer sans broncher", () => {
    expect(reponseDeSondageSchema.safeParse({ version: "12" }).success).toBe(false);
  });
});
