import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { and, asc, eq } from "drizzle-orm";
import type { Base } from "@/db/base";
import { journal, saisie } from "@/db/schema";
import { ouvrirLaMancheSuivante } from "@/lib/manche/ouverture";
import { ecrireLaCase } from "@/lib/manche/saisie";
import { type BaseDeTest, creerBaseDeTest } from "../helpers/base-de-test";
import {
  joueurDeLaPartie,
  ouvrirUnePartieDeTest,
  type PartieDeTest,
} from "../helpers/partie-de-test";

let baseDeTest: BaseDeTest;
let base: Base;
let partie: PartieDeTest;
let mancheId: number;

/** Marie tient le téléphone dans tous ces tests ; Paul et Léa sont à côté. */
function marie(): number {
  return joueurA(0);
}

function paul(): number {
  return joueurA(1);
}

function joueurA(rang: number): number {
  return joueurDeLaPartie(partie, rang);
}

/** Ce que Marie envoie depuis son écran, la case montrée vide par défaut. */
function demandeDeMarie(surcharges: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    mancheId,
    joueurConcerneId: marie(),
    valeurMontree: null,
    valeur: 8,
    agissant: { joueurId: marie(), appareilId: partie.idAppareil },
    ...surcharges,
  };
}

/** La valeur que la base porte pour cette case, `undefined` si elle est absente. */
async function valeurEnBase(joueurId: number): Promise<number | null | undefined> {
  const [ligne] = await base
    .select({ valeur: saisie.valeur })
    .from(saisie)
    .where(and(eq(saisie.mancheId, mancheId), eq(saisie.joueurId, joueurId)))
    .limit(1);

  return ligne?.valeur;
}

beforeEach(async () => {
  baseDeTest = creerBaseDeTest();
  base = baseDeTest.base;
  partie = await ouvrirUnePartieDeTest(base);
  mancheId = (await ouvrirLaMancheSuivante(base, partie.partieId)).id;
});

afterEach(() => {
  baseDeTest.fermer();
});

describe("saisir sa case", () => {
  it("écrit la valeur tapée", async () => {
    const resultat = await ecrireLaCase(base, demandeDeMarie({ valeur: 12 }));

    expect(resultat).toEqual({ statut: "ecrite", valeur: 12 });
    expect(await valeurEnBase(marie())).toBe(12);
  });

  it("écrit un zéro, qui est une manche réussie et non une case vide", async () => {
    await ecrireLaCase(base, demandeDeMarie({ valeur: 0 }));

    expect(await valeurEnBase(marie())).toBe(0);
  });

  it("refuse une valeur hors des bornes du mode : 200 têtes de bœuf est un doigt gras", async () => {
    await expect(ecrireLaCase(base, demandeDeMarie({ valeur: 201 }))).rejects.toThrow();
  });
});

describe("l'écriture conditionnelle", () => {
  it("refuse quand la case ne porte plus la valeur montrée, et rend celle qui est arrivée", async () => {
    await ecrireLaCase(base, demandeDeMarie({ valeur: 8 }));

    const enRetard = await ecrireLaCase(base, demandeDeMarie({ valeurMontree: null, valeur: 12 }));

    expect(enRetard).toEqual({ statut: "refusee", valeurArrivee: 8, valeurRefusee: 12 });
    expect(await valeurEnBase(marie())).toBe(8);
  });

  it("refuse une correction fondée sur une valeur qui a changé depuis", async () => {
    await ecrireLaCase(base, demandeDeMarie({ valeur: 8 }));
    await ecrireLaCase(base, demandeDeMarie({ valeurMontree: 8, valeur: 20 }));

    const enRetard = await ecrireLaCase(base, demandeDeMarie({ valeurMontree: 8, valeur: 12 }));

    expect(enRetard).toEqual({ statut: "refusee", valeurArrivee: 20, valeurRefusee: 12 });
  });

  // L'écran de refus garde la valeur tapée sous la main pour la réappliquer
  // d'un appui : elle lui revient du serveur, et n'a donc rien à survivre.
  it("rend la valeur refusée avec le refus, coercée comme elle est arrivée", async () => {
    await ecrireLaCase(base, demandeDeMarie({ valeur: 8 }));

    const enRetard = await ecrireLaCase(base, demandeDeMarie({ valeurMontree: "", valeur: "12" }));

    expect(enRetard).toEqual({ statut: "refusee", valeurArrivee: 8, valeurRefusee: 12 });
  });

  it("laisse passer l'écrasement informé : on voit la valeur, on écrit par dessus", async () => {
    await ecrireLaCase(base, demandeDeMarie({ valeur: 8 }));

    const informe = await ecrireLaCase(base, demandeDeMarie({ valeurMontree: 8, valeur: 12 }));

    expect(informe).toEqual({ statut: "ecrite", valeur: 12 });
    expect(await valeurEnBase(marie())).toBe(12);
  });

  it("porte sur la case et jamais sur la partie : deux cases différentes passent toutes les deux", async () => {
    const celleDeMarie = await ecrireLaCase(base, demandeDeMarie({ valeur: 8 }));
    const celleDePaul = await ecrireLaCase(
      base,
      demandeDeMarie({ joueurConcerneId: paul(), valeur: 15 }),
    );

    expect(celleDeMarie.statut).toBe("ecrite");
    expect(celleDePaul.statut).toBe("ecrite");
    expect(await valeurEnBase(marie())).toBe(8);
    expect(await valeurEnBase(paul())).toBe(15);
  });
});

describe("le journal, écrit dans la même transaction", () => {
  it("garde une ligne « saisie » avec la valeur posée", async () => {
    await ecrireLaCase(base, demandeDeMarie({ valeur: 12 }));

    const [ligne] = await base.select().from(journal);

    expect(ligne?.geste).toBe("saisie");
    expect(ligne?.mancheNumero).toBe(1);
    expect(ligne?.joueurConcerneId).toBe(marie());
    expect(JSON.parse(ligne?.detail ?? "null")).toEqual({ valeur: 12 });
  });

  it("fige le joueur agissant et garde l'appareil à côté", async () => {
    await ecrireLaCase(base, demandeDeMarie({ valeur: 12 }));

    const [ligne] = await base.select().from(journal);

    expect(ligne?.joueurAgissantId).toBe(marie());
    expect(ligne?.appareilId).toBe(partie.idAppareil);
  });

  it("distingue qui tape de qui la case concerne : Marie saisit pour Paul", async () => {
    await ecrireLaCase(base, demandeDeMarie({ joueurConcerneId: paul(), valeur: 15 }));

    const [ligne] = await base.select().from(journal);

    expect(ligne?.joueurAgissantId).toBe(marie());
    expect(ligne?.joueurConcerneId).toBe(paul());
  });

  it("garde l'ancienne et la nouvelle valeur d'une correction", async () => {
    await ecrireLaCase(base, demandeDeMarie({ valeur: 8 }));

    await ecrireLaCase(base, demandeDeMarie({ valeurMontree: 8, valeur: 12 }));

    const lignes = await base.select().from(journal).orderBy(asc(journal.id));

    expect(lignes[1]?.geste).toBe("correction");
    expect(JSON.parse(lignes[1]?.detail ?? "null")).toEqual({ ancienne: 8, nouvelle: 12 });
  });

  it("n'écrit rien du tout quand la ligne de journal échoue", async () => {
    // Un joueur agissant qui n'existe pas fait échouer la clé étrangère du
    // journal, et rien d'autre : si la mutation survivait, on aurait une case
    // écrite que le journal ignore — exactement ce que « même transaction »
    // existe pour interdire.
    const forgee = demandeDeMarie({ valeur: 12, agissant: { joueurId: 987654, appareilId: null } });

    await expect(ecrireLaCase(base, forgee)).rejects.toThrow();
    expect(await valeurEnBase(marie())).toBeUndefined();
    expect(await base.select().from(journal)).toHaveLength(0);
  });

  it("ne journalise pas une écriture refusée : le journal garde ce qui a bougé", async () => {
    await ecrireLaCase(base, demandeDeMarie({ valeur: 8 }));

    await ecrireLaCase(base, demandeDeMarie({ valeurMontree: null, valeur: 12 }));

    expect(await base.select().from(journal)).toHaveLength(1);
  });
});

describe("l'écriture sans effet", () => {
  it("réussit en silence quand la case porte déjà la valeur", async () => {
    await ecrireLaCase(base, demandeDeMarie({ valeur: 8 }));

    const reposee = await ecrireLaCase(base, demandeDeMarie({ valeurMontree: 8, valeur: 8 }));

    expect(reposee).toEqual({ statut: "sansEffet", valeur: 8 });
  });

  it("ne pose aucune ligne de journal : une valeur retapée à l'identique n'est pas un geste", async () => {
    await ecrireLaCase(base, demandeDeMarie({ valeur: 8 }));

    await ecrireLaCase(base, demandeDeMarie({ valeurMontree: 8, valeur: 8 }));

    expect(await base.select().from(journal)).toHaveLength(1);
  });

  it("réussit même quand la valeur montrée est périmée, si le résultat est celui qu'on voulait", async () => {
    // Deux joueurs font le même constat à trois secondes d'intervalle et
    // corrigent vers la même valeur : annoncer un conflit dont le résultat est
    // celui qu'on demandait serait absurde.
    await ecrireLaCase(base, demandeDeMarie({ valeur: 8 }));
    await ecrireLaCase(base, demandeDeMarie({ valeurMontree: 8, valeur: 12 }));

    const enRetard = await ecrireLaCase(base, demandeDeMarie({ valeurMontree: 8, valeur: 12 }));

    expect(enRetard).toEqual({ statut: "sansEffet", valeur: 12 });
  });
});

describe("les refus secs, ceux qu'aucun écran ne produit", () => {
  it("refuse une valeur vide plutôt que d'écrire un zéro", async () => {
    // `Number("")` vaut zéro, et zéro est une manche réussie à 6 qui prend :
    // coercer sans regarder écrirait un score que personne n'a tapé.
    await expect(ecrireLaCase(base, demandeDeMarie({ valeur: "" }))).rejects.toThrow();
    expect(await valeurEnBase(marie())).toBeUndefined();
  });

  it("refuse d'écrire la case d'un joueur qui n'est pas de cette partie", async () => {
    const voisine = await ouvrirUnePartieDeTest(base, { noms: ["Zoé", "Tom"] });
    const etrangere = joueurDeLaPartie(voisine, 0);

    await expect(
      ecrireLaCase(base, demandeDeMarie({ joueurConcerneId: etrangere })),
    ).rejects.toThrow();
  });

  it("refuse une manche qui n'existe pas", async () => {
    await expect(ecrireLaCase(base, demandeDeMarie({ mancheId: 987654 }))).rejects.toThrow();
  });
});
