import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import type { Base } from "@/db/base";
import { appareil, journal } from "@/db/schema";
import { creerIdAppareil, type IdAppareil } from "@/lib/appareil/cookie";
import { lireLeTiroir } from "@/lib/journal/lecture";
import { cloturerLaManche } from "@/lib/manche/cloture";
import { ouvrirLaMancheSuivante } from "@/lib/manche/ouverture";
import { ecrireLaCase } from "@/lib/manche/saisie";
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
let mancheId: number;

/** Marie tient le téléphone ; Paul est à côté, sans le sien. */
function marie(): number {
  return joueurDeLaPartie(partie, 0);
}

function paul(): number {
  return joueurDeLaPartie(partie, 1);
}

function lea(): number {
  return joueurDeLaPartie(partie, 2);
}

/** Le seuil de fin qu'`ouvrirUnePartieDeTest` pose par défaut, à 6 qui prend. */
const SEUIL = 66;

/**
 * Écrit une case **par le vrai chemin d'écriture**, pour que le tiroir se lise
 * contre des lignes que la production produit et non contre l'idée qu'on s'en
 * fait.
 */
async function ecrire(
  joueurConcerneId: number,
  valeurMontree: number | null,
  valeur: number,
): Promise<void> {
  await ecrireDepuis(partie.idAppareil, joueurConcerneId, valeurMontree, valeur);
}

/** La même écriture, depuis un téléphone nommé — toujours en se déclarant Marie. */
async function ecrireDepuis(
  idAppareil: IdAppareil,
  joueurConcerneId: number,
  valeurMontree: number | null,
  valeur: number,
): Promise<void> {
  await ecrireLaCase(base, {
    mancheId,
    joueurConcerneId,
    valeurMontree,
    valeur,
    agissant: { joueurId: marie(), appareilId: idAppareil },
  });
}

/**
 * Un second téléphone qui pointe vers le même joueur.
 *
 * Le lien appareil vers joueur est **global et repointable** : rien n'interdit
 * à deux appareils de se déclarer la même personne, et c'est exactement la
 * situation que le tiroir doit rendre lisible.
 */
async function unSecondTelephoneDe(joueurId: number): Promise<IdAppareil> {
  const id = creerIdAppareil();
  const maintenant = new Date();

  await base.insert(appareil).values({ id, joueurId, vuLe: maintenant, creeLe: maintenant });

  return id;
}

/**
 * Une suppression de manche, posée à la main.
 *
 * Le seul geste de ces tests qui n'ait pas de chemin d'écriture : supprimer une
 * manche n'est pas encore construit. On insère donc la ligne directement, ce
 * qui reste honnête ici — ce qu'on vérifie est le **filtre du lecteur sur le
 * geste**, pas la forme qu'un écrivain lui donnera.
 */
async function consignerUneSuppression(): Promise<void> {
  await base.insert(journal).values({
    partieId: partie.partieId,
    geste: "suppressionDeManche",
    joueurAgissantId: marie(),
    appareilId: partie.idAppareil,
    mancheNumero: 1,
    detail: null,
    ecritLe: new Date(),
  });
}

/** Le tiroir ouvert, sur la portée que l'adresse demande. */
async function ouvrir(brut?: string) {
  const tiroir = await lireLeTiroir(base, partie.partieId, { journal: brut ?? "corrections" });

  if (tiroir.etat !== "ouvert") {
    throw new Error(`Tiroir ouvert attendu, reçu « ${tiroir.etat} ».`);
  }

  return tiroir;
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

describe("le tiroir du journal", () => {
  it("rend les gestes de la partie, le plus récent en tête", async () => {
    await ecrire(paul(), null, 12);
    await ecrire(paul(), 12, 15);

    const tiroir = await ouvrir("tout");

    expect(tiroir.lignes.map((ligne) => ligne.geste)).toEqual(["correction", "saisie"]);
  });

  it("nomme le joueur agissant, la manche concernée et l'horloge du serveur", async () => {
    const avant = Date.now();
    await ecrire(paul(), null, 12);

    const [ligne] = (await ouvrir("tout")).lignes;

    expect(ligne?.agissant).toEqual({ id: marie(), nom: "Marie" });
    expect(ligne?.joueurConcerne).toEqual({ id: paul(), nom: "Paul" });
    expect(ligne?.mancheNumero).toBe(1);
    expect(ligne?.ecritLe.getTime()).toBeGreaterThanOrEqual(avant);
  });

  it("distingue deux appareils qui se déclarent la même personne", async () => {
    // L'anomalie pour laquelle le tiroir existe : voir que Marie a écrit depuis
    // un appareil qui n'avait jamais été celui de Marie. Le joueur seul ne la
    // montre pas — les deux lignes le nomment pareil.
    const autre = await unSecondTelephoneDe(marie());

    await ecrire(paul(), null, 12);
    await ecrireDepuis(autre, paul(), 12, 15);

    const [correction, saisie] = (await ouvrir("tout")).lignes;

    expect(correction?.agissant.nom).toBe("Marie");
    expect(saisie?.agissant.nom).toBe("Marie");
    expect(correction?.appareil).not.toBe(saisie?.appareil);
  });

  it("ne montre jamais l'identifiant d'appareil lui-même, qui est le cookie", async () => {
    // Le rendre serait défaire le `HttpOnly` du cookie d'appareil : une étiquette
    // courte suffit à distinguer deux téléphones, et ne se rejoue pas.
    await ecrire(paul(), null, 12);

    const [ligne] = (await ouvrir("tout")).lignes;

    expect(ligne?.appareil).not.toBe(partie.idAppareil);
    expect(ligne?.appareil).toBe("A");
  });

  it("étiquette un appareil pareil quelle que soit la portée", async () => {
    // Sinon « l'appareil B » de la vue par défaut serait « l'appareil C » de la
    // vue complète, et l'étiquette ne servirait plus à rapprocher deux lignes.
    const autre = await unSecondTelephoneDe(marie());

    await ecrire(paul(), null, 12);
    await ecrireDepuis(autre, paul(), 12, 15);

    const [corrigee] = (await ouvrir()).lignes;
    const [memeLigne] = (await ouvrir("tout")).lignes;

    expect(corrigee?.appareil).toBe(memeLigne?.appareil);
  });

  it("garde d'une correction d'où l'on venait et où l'on va", async () => {
    await ecrire(paul(), null, 12);
    await ecrire(paul(), 12, 15);

    const [correction, saisie] = (await ouvrir("tout")).lignes;

    expect(correction?.detail).toEqual({ forme: "correction", ancienne: 12, nouvelle: 15 });
    expect(saisie?.detail).toEqual({ forme: "valeur", valeur: 12 });
  });

  it("ne montre par défaut que les corrections et les suppressions", async () => {
    await ecrire(paul(), null, 12);
    await ecrire(paul(), 12, 15);
    await consignerUneSuppression();

    const tiroir = await ouvrir();

    expect(tiroir.portee).toBe("corrections");
    expect(tiroir.lignes.map((ligne) => ligne.geste)).toEqual([
      "suppressionDeManche",
      "correction",
    ]);
  });

  it("montre tout, saisies de routine comprises, quand on le demande", async () => {
    await ecrire(paul(), null, 12);
    await ecrire(paul(), 12, 15);
    await consignerUneSuppression();

    const tiroir = await ouvrir("tout");

    expect(tiroir.portee).toBe("tout");
    expect(tiroir.lignes.map((ligne) => ligne.geste)).toEqual([
      "suppressionDeManche",
      "correction",
      "saisie",
    ]);
  });

  it("reste fermé tant que l'adresse ne le demande pas", async () => {
    await ecrire(paul(), null, 12);

    expect(await lireLeTiroir(base, partie.partieId, {})).toEqual({ etat: "ferme" });
  });

  it("ne se laisse pas ouvrir deux fois par une adresse qui porte deux fois la clé", async () => {
    await ecrire(paul(), null, 12);
    await ecrire(paul(), 12, 15);

    const tiroir = await lireLeTiroir(base, partie.partieId, { journal: ["tout", "corrections"] });

    expect(tiroir.etat === "ouvert" && tiroir.portee).toBe("tout");
  });

  it("ouvre sur une portée par défaut plutôt que de lever sur une adresse bricolée", async () => {
    await ecrire(paul(), null, 12);
    await ecrire(paul(), 12, 15);

    const tiroir = await ouvrir("n’importe quoi");

    expect(tiroir.portee).toBe("corrections");
    expect(tiroir.lignes).toHaveLength(1);
  });
});

describe("le tiroir d'une partie scellée", () => {
  /**
   * Scelle la partie **par le vrai chemin** : la tablée remplit la manche, l'un
   * d'eux la clôt, et c'est la clôture qui estampille la fin parce que le seuil
   * est franchi.
   *
   * Poser `fin_le` à la main aurait écrit un sceau que la production ne pose
   * jamais ainsi. Passer par la clôture fait en plus exister le garde-fou de
   * scellement qui refuse désormais les écritures — et c'est précisément de lui
   * qu'on veut prouver qu'il n'atteint pas la lecture.
   */
  async function scellerParLaCloture(): Promise<void> {
    await ecrire(marie(), null, SEUIL);
    await ecrire(lea(), null, 0);

    const resultat = await cloturerLaManche(base, { mancheId, parJoueurId: marie() });

    // Le sceau est vérifié plutôt que supposé : un fixture qui n'aurait rien
    // scellé ferait passer le test qui suit sans rien prouver du tout.
    expect(resultat.fin?.cause).toBe("terminee");
  }

  it("s'ouvre encore, et montre les mêmes lignes", async () => {
    await ecrire(paul(), null, 12);
    await ecrire(paul(), 12, 15);
    await scellerParLaCloture();

    const tiroir = await ouvrir();

    expect(tiroir.lignes.map((ligne) => ligne.geste)).toEqual(["correction"]);
  });

  it("se lit alors même que la partie refuse toute écriture", async () => {
    await ecrire(paul(), null, 12);
    await ecrire(paul(), 12, 15);
    await scellerParLaCloture();

    // Le sceau mord vraiment : c'est ce qui donne son sens au tiroir qui, lui,
    // s'ouvre encore. Écrire est fermé, lire ne l'est pas.
    await expect(ecrire(paul(), 15, 20)).rejects.toThrow(PartieScellee);
    expect((await ouvrir()).lignes).not.toHaveLength(0);
  });

  it("ne peut pas cesser d'être atteignable : sa lecture ignore l'état de la partie", async () => {
    // Le garde-fou est mécanique plutôt qu'en prose. Lire `participant` ou
    // l'identité d'appareil **du lecteur** ferait un journal conditionné à qui
    // regarde ; lire la fin de partie en ferait un journal qui se ferme au
    // moment où l'on en a besoin.
    //
    // Ce qu'on interdit est l'identité **de celui qui ouvre**, jamais la colonne
    // `journal.appareil_id`, qui est celle de la ligne : l'étiqueter est
    // précisément le métier du tiroir.
    const source = await Bun.file(
      new URL("../../../src/lib/journal/lecture.ts", import.meta.url),
    ).text();
    // Le code seul : une phrase de JSDoc qui dit « participant » n'est pas une lecture.
    const code = source
      .split("\n")
      .filter((ligne) => !/^\s*(\/\/|\/\*|\*)/.test(ligne))
      .join("\n");

    // Les tables lues sont épinglées plutôt que cherchées par mot : « participant »
    // apparaît légitimement dans le code sous les noms de gestes
    // `participantAjoute` et `participantRetire`. Ajouter `participant` ou
    // `partie` à cet import est ce qu'il faut attraper, et c'est ce que ça attrape.
    expect(code).toContain('import { joueur, journal } from "@/db/schema";');
    expect(code).not.toContain("@/lib/appareil");
    expect(code).not.toContain("finLe");
    expect(code).not.toContain("finCause");
  });
});
