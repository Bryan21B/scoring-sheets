import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { eq } from "drizzle-orm";
import type { Base } from "@/db/base";
import { joueur, journal, manche, participant, partie as tablePartie } from "@/db/schema";
import { creerIdAppareil } from "@/lib/appareil/cookie";
import type { Agissant } from "@/lib/journal/ligne";
import { cloturerLaManche } from "@/lib/manche/cloture";
import { ouvrirLaMancheSuivante } from "@/lib/manche/ouverture";
import { ecrireLaCase } from "@/lib/manche/saisie";
import {
  abandonnerLaPartie,
  journalEstVide,
  RefusDeCycle,
  reprendreLaPartie,
  sortiesDePartie,
  supprimerLaPartie,
} from "@/lib/partie/cycle";
import { lirePartieEnCours } from "@/lib/partie/en-cours";
import { type FinDePartie, lireLaFin, PartieScellee, RepriseImpossible } from "@/lib/partie/fin";
import { lirePartieParCode } from "@/lib/partie/lecture";
import {
  estGelee,
  RefusDArrivee,
  rejoindrePartie,
  retirerParticipant,
} from "@/lib/partie/salle-attente";
import { type BaseDeTest, creerBaseDeTest } from "../helpers/base-de-test";
import {
  joueurDeLaPartie,
  ouvrirUnePartieDeTest,
  type PartieDeTest,
} from "../helpers/partie-de-test";

let baseDeTest: BaseDeTest;
let base: Base;
let partie: PartieDeTest;

function marie(): number {
  return joueurDeLaPartie(partie, 0);
}

/** Ce que l'action serveur résout du cookie : le joueur, et l'appareil à côté. */
function agissantDeMarie(): Agissant {
  return { joueurId: marie(), appareilId: partie.idAppareil };
}

/** Quelqu'un du roster qui n'est **pas** de cette partie : le spectateur. */
async function unSpectateur(): Promise<Agissant> {
  const [ligne] = await base
    .insert(joueur)
    .values({ nom: "Zoé", creeLe: new Date() })
    .returning({ id: joueur.id });

  if (ligne === undefined) {
    throw new Error("Insertion de Zoé sans id rendu.");
  }

  return { joueurId: ligne.id, appareilId: null };
}

/** Une ligne du journal, réduite à ce que ces tests regardent. */
type LigneEnBase = {
  geste: string;
  joueurAgissantId: number;
  appareilId: string | null;
  mancheNumero: number | null;
  joueurConcerneId: number | null;
  detail: string | null;
};

/** Les lignes du journal de la partie, dans l'ordre où elles ont été écrites. */
async function lignesDuJournal(): Promise<LigneEnBase[]> {
  return base
    .select({
      geste: journal.geste,
      joueurAgissantId: journal.joueurAgissantId,
      appareilId: journal.appareilId,
      mancheNumero: journal.mancheNumero,
      joueurConcerneId: journal.joueurConcerneId,
      detail: journal.detail,
    })
    .from(journal)
    .where(eq(journal.partieId, partie.partieId))
    .orderBy(journal.id);
}

/** La ligne qu'un geste de partie écrit : aucune manche, aucun joueur concerné. */
function ligneSansCase(geste: string): LigneEnBase {
  return {
    geste,
    joueurAgissantId: marie(),
    appareilId: partie.idAppareil,
    mancheNumero: null,
    joueurConcerneId: null,
    detail: null,
  };
}

/**
 * Termine la partie par la **vraie porte** : une manche remplie au-delà du
 * seuil, puis close. Fabriquer la fin à la main ne dirait rien de la façon dont
 * elle arrive, et c'est précisément la fin qu'on veut voir refuser la reprise.
 */
async function terminerLaPartie(): Promise<FinDePartie> {
  const mancheId = (await ouvrirLaMancheSuivante(base, partie.partieId)).id;

  for (const [rang, valeur] of [70, 3, 0].entries()) {
    await ecrireLaCase(base, {
      mancheId,
      joueurConcerneId: joueurDeLaPartie(partie, rang),
      valeurMontree: null,
      valeur,
      agissant: agissantDeMarie(),
    });
  }

  const cloture = await cloturerLaManche(base, { mancheId, parJoueurId: marie() });

  if (cloture.fin === null) {
    throw new Error("La clôture devait terminer la partie.");
  }

  return cloture.fin;
}

/** Ce qui pend encore à la partie, et que la suppression doit emporter. */
async function participantsEnBase(): Promise<number> {
  return (await base.select().from(participant).where(eq(participant.partieId, partie.partieId)))
    .length;
}

async function manchesEnBase(): Promise<number> {
  return (await base.select().from(manche).where(eq(manche.partieId, partie.partieId))).length;
}

/** L'estampille que les autres téléphones sondent. */
async function versionEnBase(): Promise<number> {
  const [ligne] = await base
    .select({ version: tablePartie.version })
    .from(tablePartie)
    .where(eq(tablePartie.id, partie.partieId))
    .limit(1);

  if (ligne === undefined) {
    throw new Error("La partie de test a disparu.");
  }

  return ligne.version;
}

beforeEach(async () => {
  baseDeTest = creerBaseDeTest();
  base = baseDeTest.base;
  partie = await ouvrirUnePartieDeTest(base);
});

afterEach(() => {
  baseDeTest.fermer();
});

describe("abandonner une partie", () => {
  it("estampille la fin : sa date, la cause « abandonnee » et son auteur", async () => {
    const abandon = await abandonnerLaPartie(base, partie.partieId, agissantDeMarie());

    expect(abandon.cause).toBe("abandonnee");
    expect(abandon.par).toBe(marie());
    expect(await lireLaFin(base, partie.partieId)).toEqual(abandon);
  });

  it("écrit sa ligne de journal, et elle ne porte aucune case", async () => {
    await abandonnerLaPartie(base, partie.partieId, agissantDeMarie());

    expect(await lignesDuJournal()).toEqual([
      {
        geste: "abandon",
        joueurAgissantId: marie(),
        appareilId: partie.idAppareil,
        mancheNumero: null,
        joueurConcerneId: null,
        detail: null,
      },
    ]);
  });

  it("fait bouger l'estampille, sans quoi les autres téléphones ne l'apprendraient pas", async () => {
    const avant = await versionEnBase();

    await abandonnerLaPartie(base, partie.partieId, agissantDeMarie());

    expect(await versionEnBase()).toBeGreaterThan(avant);
  });

  it("refuse le spectateur, et ne laisse ni fin ni ligne derrière lui", async () => {
    const abandon = abandonnerLaPartie(base, partie.partieId, await unSpectateur());

    expect(abandon).rejects.toBeInstanceOf(RefusDeCycle);
    expect(await lireLaFin(base, partie.partieId)).toBeNull();
    expect(await lignesDuJournal()).toEqual([]);
  });

  it("refuse une partie déjà abandonnée : elle ne s'abandonne pas deux fois", async () => {
    const premier = await abandonnerLaPartie(base, partie.partieId, agissantDeMarie());

    const second = abandonnerLaPartie(base, partie.partieId, agissantDeMarie());

    expect(second).rejects.toBeInstanceOf(PartieScellee);
    expect(await lireLaFin(base, partie.partieId)).toEqual(premier);
  });

  it("sort la partie de l'accueil : c'est tout le métier du balai", async () => {
    expect((await lirePartieEnCours(base))?.code).toBe(partie.code);

    await abandonnerLaPartie(base, partie.partieId, agissantDeMarie());

    expect(await lirePartieEnCours(base)).toBeNull();
  });
});

// Le scellement ne regarde que la **présence** d'une fin, jamais sa cause : une
// partie abandonnée refuse donc tout ce qu'une partie terminée refuse, par le
// même garde-fou. Ce qui la distingue n'est pas une permission de plus, c'est
// une porte de sortie — la reprise, qui exige l'inverse du scellement.
describe("une partie abandonnée n'accepte que la reprise", () => {
  let mancheId: number;

  beforeEach(async () => {
    mancheId = (await ouvrirLaMancheSuivante(base, partie.partieId)).id;

    for (const [rang, valeur] of [5, 3, 0].entries()) {
      await ecrireLaCase(base, {
        mancheId,
        joueurConcerneId: joueurDeLaPartie(partie, rang),
        valeurMontree: null,
        valeur,
        agissant: agissantDeMarie(),
      });
    }

    await abandonnerLaPartie(base, partie.partieId, agissantDeMarie());
  });

  it("refuse une saisie", async () => {
    const ecriture = ecrireLaCase(base, {
      mancheId,
      joueurConcerneId: marie(),
      valeurMontree: 5,
      valeur: 9,
      agissant: agissantDeMarie(),
    });

    expect(ecriture).rejects.toBeInstanceOf(PartieScellee);
  });

  it("refuse la clôture d'une manche, même complète", async () => {
    const cloture = cloturerLaManche(base, { mancheId, parJoueurId: marie() });

    expect(cloture).rejects.toBeInstanceOf(PartieScellee);
  });

  it("refuse qu'on touche à la tablée", async () => {
    const retrait = retirerParticipant(base, partie.partieId, {
      idAppareil: partie.idAppareil,
      joueurId: joueurDeLaPartie(partie, 1),
    });

    expect(retrait).rejects.toBeInstanceOf(PartieScellee);
  });

  it("refuse qu'on la rejoigne", async () => {
    const arrivee = rejoindrePartie(base, partie.partieId, {
      idAppareil: creerIdAppareil(),
      identite: { mode: "nouveau", nom: "Nour" },
    });

    expect(arrivee).rejects.toBeInstanceOf(PartieScellee);
  });

  it("accepte la reprise, et retrouve alors tous ses gestes", async () => {
    await reprendreLaPartie(base, partie.partieId, agissantDeMarie());

    const cloture = await cloturerLaManche(base, { mancheId, parJoueurId: marie() });

    expect(cloture.statut).toBe("close");
  });
});

describe("reprendre une partie abandonnée", () => {
  it("efface les trois colonnes de fin, et la partie revient à l'accueil", async () => {
    await abandonnerLaPartie(base, partie.partieId, agissantDeMarie());

    await reprendreLaPartie(base, partie.partieId, agissantDeMarie());

    expect(await lireLaFin(base, partie.partieId)).toBeNull();
    expect((await lirePartieEnCours(base))?.code).toBe(partie.code);
  });

  it("écrit sa ligne de journal, en paire avec l'abandon et sans case", async () => {
    await abandonnerLaPartie(base, partie.partieId, agissantDeMarie());

    await reprendreLaPartie(base, partie.partieId, agissantDeMarie());

    expect(await lignesDuJournal()).toEqual([ligneSansCase("abandon"), ligneSansCase("reprise")]);
  });

  it("fait bouger l'estampille : la partie se remet à bouger sous les autres", async () => {
    await abandonnerLaPartie(base, partie.partieId, agissantDeMarie());
    const avant = await versionEnBase();

    await reprendreLaPartie(base, partie.partieId, agissantDeMarie());

    expect(await versionEnBase()).toBeGreaterThan(avant);
  });

  it("refuse une partie en cours : il n'y a rien à reprendre", async () => {
    const reprise = reprendreLaPartie(base, partie.partieId, agissantDeMarie());

    expect(reprise).rejects.toBeInstanceOf(RepriseImpossible);
    expect(await lignesDuJournal()).toEqual([]);
  });

  it("refuse une partie terminée : vouloir continuer, c'est vouloir changer le seuil", async () => {
    const fin = await terminerLaPartie();

    const reprise = reprendreLaPartie(base, partie.partieId, agissantDeMarie());

    expect(reprise).rejects.toBeInstanceOf(RepriseImpossible);
    expect(await lireLaFin(base, partie.partieId)).toEqual(fin);
  });

  it("refuse le spectateur, et laisse la partie abandonnée", async () => {
    const abandon = await abandonnerLaPartie(base, partie.partieId, agissantDeMarie());

    const reprise = reprendreLaPartie(base, partie.partieId, await unSpectateur());

    expect(reprise).rejects.toBeInstanceOf(RefusDeCycle);
    expect(await lireLaFin(base, partie.partieId)).toEqual(abandon);
  });

  it("laisse le gel en place : il se déduit d'une manche que l'abandon n'a pas effacée", async () => {
    await ouvrirLaMancheSuivante(base, partie.partieId);
    await abandonnerLaPartie(base, partie.partieId, agissantDeMarie());

    await reprendreLaPartie(base, partie.partieId, agissantDeMarie());

    expect(await estGelee(base, partie.partieId)).toBe(true);

    const arrivee = rejoindrePartie(base, partie.partieId, {
      idAppareil: creerIdAppareil(),
      identite: { mode: "nouveau", nom: "Nour" },
    });

    expect(arrivee).rejects.toBeInstanceOf(RefusDArrivee);
  });
});

describe("supprimer une partie", () => {
  it("l'efface tant que son journal est vide : elle n'a rien à protéger", async () => {
    await supprimerLaPartie(base, partie.partieId, agissantDeMarie());

    expect(await lirePartieParCode(base, partie.code)).toBeNull();
    expect(await participantsEnBase()).toBe(0);
  });

  it("emporte la manche ouverte que personne n'a encore remplie", async () => {
    await ouvrirLaMancheSuivante(base, partie.partieId);

    await supprimerLaPartie(base, partie.partieId, agissantDeMarie());

    expect(await lirePartieParCode(base, partie.code)).toBeNull();
    expect(await manchesEnBase()).toBe(0);
  });

  it("refuse dès que le journal porte une ligne : passé là, la sortie est l'abandon", async () => {
    const mancheId = (await ouvrirLaMancheSuivante(base, partie.partieId)).id;
    await ecrireLaCase(base, {
      mancheId,
      joueurConcerneId: marie(),
      valeurMontree: null,
      valeur: 8,
      agissant: agissantDeMarie(),
    });

    const suppression = supprimerLaPartie(base, partie.partieId, agissantDeMarie());

    expect(suppression).rejects.toBeInstanceOf(RefusDeCycle);
    expect((await lirePartieParCode(base, partie.code))?.code).toBe(partie.code);
  });

  it("refuse une partie abandonnée : l'abandon lui a justement écrit une ligne", async () => {
    await abandonnerLaPartie(base, partie.partieId, agissantDeMarie());

    const suppression = supprimerLaPartie(base, partie.partieId, agissantDeMarie());

    expect(suppression).rejects.toBeInstanceOf(RefusDeCycle);
    expect((await lirePartieParCode(base, partie.code))?.code).toBe(partie.code);
  });

  it("refuse le spectateur, et laisse la partie en place", async () => {
    const suppression = supprimerLaPartie(base, partie.partieId, await unSpectateur());

    expect(suppression).rejects.toBeInstanceOf(RefusDeCycle);
    expect((await lirePartieParCode(base, partie.code))?.code).toBe(partie.code);
  });
});

describe("journalEstVide", () => {
  it("est vrai en salle d'attente, où rien n'a encore été consigné", async () => {
    expect(await journalEstVide(base, partie.partieId)).toBe(true);
  });

  it("devient faux à la première ligne, et ne revient jamais", async () => {
    await abandonnerLaPartie(base, partie.partieId, agissantDeMarie());

    expect(await journalEstVide(base, partie.partieId)).toBe(false);

    await reprendreLaPartie(base, partie.partieId, agissantDeMarie());

    expect(await journalEstVide(base, partie.partieId)).toBe(false);
  });
});

// Pure, et c'est ce qui la rend vérifiable : l'écran n'a plus qu'à câbler ce
// qu'elle décide, et aucun de ces cas n'a besoin d'une base.
describe("sortiesDePartie", () => {
  const EnCours = { fin: null, deLaPartie: true, journalVide: false };
  const Abandon: FinDePartie = { le: new Date(), cause: "abandonnee", par: 1 };
  const Terminee: FinDePartie = { le: new Date(), cause: "terminee", par: 1 };

  it("offre l'abandon sur une partie en cours, et pas la reprise", () => {
    expect(sortiesDePartie(EnCours)).toEqual({
      abandon: true,
      reprise: false,
      suppression: false,
    });
  });

  it("offre la reprise sur une partie abandonnée, et plus l'abandon", () => {
    expect(sortiesDePartie({ ...EnCours, fin: Abandon })).toEqual({
      abandon: false,
      reprise: true,
      suppression: false,
    });
  });

  it("n'offre rien sur une partie terminée : elle ne se rouvre pas", () => {
    expect(sortiesDePartie({ ...EnCours, fin: Terminee })).toEqual({
      abandon: false,
      reprise: false,
      suppression: false,
    });
  });

  it("offre la suppression tant que le journal est vide", () => {
    expect(sortiesDePartie({ ...EnCours, journalVide: true }).suppression).toBe(true);
  });

  it("n'offre rien au spectateur, pas même la suppression d'une partie vierge", () => {
    expect(sortiesDePartie({ fin: null, deLaPartie: false, journalVide: true })).toEqual({
      abandon: false,
      reprise: false,
      suppression: false,
    });
  });
});
