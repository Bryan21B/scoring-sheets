import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { and, eq } from "drizzle-orm";
import type { Base } from "@/db/base";
import { journal, participant } from "@/db/schema";
import { creerIdAppareil, type IdAppareil } from "@/lib/appareil/cookie";
import { lierLAppareil } from "@/lib/appareil/lien";
import { trouverEntree } from "@/lib/jeux/catalogue";
import { estComplete } from "@/lib/jeux/moteur";
import { resoudreRegles } from "@/lib/jeux/resolution";
import { cloturerLaManche } from "@/lib/manche/cloture";
import { lireLaGrille, lireLaManche, mancheDuMoteur } from "@/lib/manche/lecture";
import { ouvrirLaMancheSuivante } from "@/lib/manche/ouverture";
import { ecrireLaCase } from "@/lib/manche/saisie";
import { abandonnerLaPartie } from "@/lib/partie/cycle";
import { RefusDeDepart, retirerDeLaPartie } from "@/lib/partie/depart";
import { PartieScellee } from "@/lib/partie/fin";
import { type BaseDeTest, creerBaseDeTest } from "../helpers/base-de-test";
import {
  joueurDeLaPartie,
  ouvrirUnePartieDeTest,
  type PartieDeTest,
} from "../helpers/partie-de-test";

let baseDeTest: BaseDeTest;
let base: Base;
let partie: PartieDeTest;

/** Les règles figées à l'ouverture : 6 qui prend à trois, où le plus bas gagne. */
const REGLES = resoudreRegles(trouverEntree("6-qui-prend"), { nombreDeJoueurs: 3 });

/** Le téléphone que Paul sort de sa poche, quand le test en a besoin d'un. */
let telephoneDePaul: IdAppareil;

/** Marie tient le téléphone, Paul est celui qui rentre chez lui. */
function marie(): number {
  return joueurDeLaPartie(partie, 0);
}

function paul(): number {
  return joueurDeLaPartie(partie, 1);
}

function lea(): number {
  return joueurDeLaPartie(partie, 2);
}

/** Ouvre la manche suivante et rend son identifiant. */
async function ouvrirUneManche(): Promise<number> {
  return (await ouvrirLaMancheSuivante(base, partie.partieId)).id;
}

/** Pose une valeur sur la case de ce joueur, en partant du vide. */
async function poser(mancheId: number, joueurConcerneId: number, valeur: number): Promise<void> {
  await ecrireLaCase(base, {
    mancheId,
    joueurConcerneId,
    valeurMontree: null,
    valeur,
    agissant: { joueurId: marie(), appareilId: partie.idAppareil },
  });
}

/** Le geste de l'issue : Paul s'en va, depuis le téléphone de Marie. */
async function paulSEnVa(): Promise<void> {
  await retirerDeLaPartie(base, partie.partieId, {
    idAppareil: partie.idAppareil,
    joueurId: String(paul()),
  });
}

/** La date de retrait de ce joueur : `null` tant qu'il est encore de la partie. */
async function placeDe(joueurId: number): Promise<Date | null> {
  const [place] = await base
    .select({ retireLe: participant.retireLe })
    .from(participant)
    .where(and(eq(participant.partieId, partie.partieId), eq(participant.joueurId, joueurId)))
    .limit(1);

  if (place === undefined) {
    throw new Error(`Le joueur ${joueurId} n'a pas de place dans la partie de test.`);
  }

  return place.retireLe;
}

/** Les lignes de journal de cette partie, dans l'ordre où elles ont été écrites. */
async function lignesDuJournal() {
  return base
    .select({
      geste: journal.geste,
      agissant: journal.joueurAgissantId,
      concerne: journal.joueurConcerneId,
      appareilId: journal.appareilId,
      mancheNumero: journal.mancheNumero,
      detail: journal.detail,
    })
    .from(journal)
    .where(eq(journal.partieId, partie.partieId))
    .orderBy(journal.id);
}

/**
 * La manche 1 jouée par les trois : la partie est **gelée**, et son journal
 * porte trois lignes de saisie. C'est le décor de l'issue — Paul s'en va après
 * le gel, pas en salle d'attente.
 */
async function uneMancheJouee(): Promise<number> {
  const mancheId = await ouvrirUneManche();

  await poser(mancheId, marie(), 8);
  await poser(mancheId, paul(), 3);
  await poser(mancheId, lea(), 5);

  return mancheId;
}

beforeEach(async () => {
  baseDeTest = creerBaseDeTest();
  base = baseDeTest.base;
  partie = await ouvrirUnePartieDeTest(base);
  telephoneDePaul = creerIdAppareil();
});

afterEach(() => {
  baseDeTest.fermer();
});

describe("le joueur qui s'en va", () => {
  it("se retire une fois la partie gelée, ce que la salle d'attente refusait", async () => {
    await uneMancheJouee();

    await paulSEnVa();

    const places = await base
      .select({ joueurId: participant.joueurId, retireLe: participant.retireLe })
      .from(participant)
      .where(eq(participant.partieId, partie.partieId));

    expect(places.find((place) => place.joueurId === paul())?.retireLe).toBeInstanceOf(Date);
    expect(places.find((place) => place.joueurId === marie())?.retireLe).toBeNull();
  });

  it("est refusé par une partie scellée, qui ne bouge plus du tout", async () => {
    await uneMancheJouee();
    await abandonnerLaPartie(base, partie.partieId, {
      joueurId: String(marie()),
      appareilId: partie.idAppareil,
    });

    await expect(paulSEnVa()).rejects.toBeInstanceOf(PartieScellee);
    expect(await placeDe(paul())).toBeNull();
  });

  it("est refusé au spectateur, qui a le code sans être de la tablée", async () => {
    // Le code donne la lecture, l'écriture demande d'être participant : sans
    // cette ligne, quiconque a le lien vide la table des autres.
    await uneMancheJouee();

    await expect(
      retirerDeLaPartie(base, partie.partieId, {
        idAppareil: creerIdAppareil(),
        joueurId: String(paul()),
      }),
    ).rejects.toBeInstanceOf(RefusDeDepart);
    expect(await placeDe(paul())).toBeNull();
  });

  it("est refusé au participant déjà parti, dont le téléphone n'a plus de place", async () => {
    await uneMancheJouee();
    await base.transaction(async (tx) => {
      await lierLAppareil(tx, telephoneDePaul, paul(), new Date());
    });
    await paulSEnVa();

    await expect(
      retirerDeLaPartie(base, partie.partieId, {
        idAppareil: telephoneDePaul,
        joueurId: String(lea()),
      }),
    ).rejects.toBeInstanceOf(RefusDeDepart);
    expect(await placeDe(lea())).toBeNull();
  });
});

describe("ce que le départ écrit au journal", () => {
  it("consigne un participantRetire, le parti concerné et la main qui agit", async () => {
    await uneMancheJouee();

    await paulSEnVa();

    const derniere = (await lignesDuJournal()).at(-1);

    expect(derniere).toEqual({
      geste: "participantRetire",
      agissant: marie(),
      concerne: paul(),
      appareilId: partie.idAppareil,
      mancheNumero: null,
      detail: null,
    });
  });

  it("n'écrit rien tant que le journal est vide : c'est encore la salle d'attente", async () => {
    // « Journal non vide, on journalise » : une manche ouverte sans qu'aucune
    // case n'ait été saisie gèle la liste sans rien avoir consigné, et une
    // partie dont le journal reste vide se supprime encore.
    await ouvrirUneManche();

    await paulSEnVa();

    expect(await placeDe(paul())).toBeInstanceOf(Date);
    expect(await lignesDuJournal()).toEqual([]);
  });

  it("ne consigne rien pour un joueur déjà parti : la liste est celle qu'on voulait", async () => {
    await uneMancheJouee();
    await paulSEnVa();
    const avant = (await lignesDuJournal()).length;

    await paulSEnVa();

    expect(await lignesDuJournal()).toHaveLength(avant);
  });
});

describe("ce que le départ de Paul laisse derrière lui", () => {
  /**
   * La soirée de l'issue, en petit : Paul joue la manche 1, rentre chez lui,
   * et la manche 2 se joue sans lui.
   */
  async function laSoireeDeLIssue(): Promise<void> {
    const premiere = await uneMancheJouee();

    await cloturerLaManche(base, { mancheId: premiere, parJoueurId: marie() });
    await paulSEnVa();

    const deuxieme = await ouvrirUneManche();

    await poser(deuxieme, marie(), 4);
    await poser(deuxieme, lea(), 7);
  }

  it("garde ses valeurs dans la grille : le journal les a vues, l'histoire est vraie", async () => {
    await laSoireeDeLIssue();

    const grille = await lireLaGrille(base, partie.partieId, REGLES);
    const manche1 = grille.manches[0]?.cases.find((une) => une.joueur.id === paul());

    expect(manche1?.valeur).toBe(3);
    expect(manche1?.joueur.nom).toBe("Paul");
  });

  it("garde son total : ses trois têtes de bœuf restent comptées", async () => {
    await laSoireeDeLIssue();

    const grille = await lireLaGrille(base, partie.partieId, REGLES);

    expect(grille.etat.totaux.get(paul())).toBe(3);
  });

  it("ne le range pas au classement, sans quoi partir tôt ferait gagner", async () => {
    // À 6 qui prend, le plus bas l'emporte : Paul et ses 3 têtes battraient
    // Marie à 12 et Léa à 12 en étant simplement rentré chez lui.
    await laSoireeDeLIssue();

    const grille = await lireLaGrille(base, partie.partieId, REGLES);

    expect(grille.etat.classement.flat()).not.toContain(paul());
    expect(grille.etat.classement.flat()).toEqual([marie(), lea()]);
  });

  it("laisse la manche ouverte après son départ être complète sans lui", async () => {
    await laSoireeDeLIssue();

    const deuxieme = await lireLaManche(base, partie.partieId, 2);

    expect(deuxieme?.cases.map((une) => une.joueur.nom)).toEqual(["Marie", "Léa"]);
    expect(estComplete(REGLES, mancheDuMoteur(deuxieme?.cases ?? [], false))).toBe(true);
  });

  it("n'attend plus rien de lui dans la manche qu'il a pourtant marquée", async () => {
    // La manche 1 porte sa valeur et ne le compte plus parmi les attendus :
    // c'est cette paire-là qui fait tenir « ses points restent » et « il ne
    // place pas » ensemble.
    await laSoireeDeLIssue();

    const grille = await lireLaGrille(base, partie.partieId, REGLES);
    const manche1 = mancheDuMoteur(grille.manches[0]?.cases ?? [], true);

    expect(manche1.participants).toEqual([marie(), lea()]);
    expect(manche1.cases).toContainEqual({ joueurId: paul(), valeur: 3 });
  });
});
