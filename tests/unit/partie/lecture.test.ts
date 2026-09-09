import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import type { Base } from "@/db/base";
import { creerIdAppareil } from "@/lib/appareil/cookie";
import { normaliserCode } from "@/lib/partie/code";
import { creerPartie } from "@/lib/partie/creation";
import { lirePartieParCode } from "@/lib/partie/lecture";
import { type BaseDeTest, creerBaseDeTest } from "../helpers/base-de-test";

let baseDeTest: BaseDeTest;
let base: Base;

/** Ouvre une partie d'Uno à trois, tenue par Marie, et rend son code. */
async function ouvrirUnePartie(): Promise<string> {
  const resultat = await creerPartie(base, {
    idAppareil: creerIdAppareil(),
    jeuId: "uno",
    nombreDeJoueurs: "3",
    finValeur: "500",
    identite: { mode: "nouveau", nom: "Marie" },
  });

  if (resultat.statut !== "creee") {
    throw new Error("Création attendue.");
  }

  return resultat.code;
}

beforeEach(() => {
  baseDeTest = creerBaseDeTest();
  base = baseDeTest.base;
});

afterEach(() => {
  baseDeTest.fermer();
});

describe("lirePartieParCode", () => {
  it("rend la partie que ce code désigne", async () => {
    const code = await ouvrirUnePartie();

    const vue = await lirePartieParCode(base, code);

    expect(vue?.code).toBe(code);
    expect(vue?.jeu.nom).toBe("Uno");
  });

  it("relit l'instantané de règles figé à l'ouverture", async () => {
    const code = await ouvrirUnePartie();

    const vue = await lirePartieParCode(base, code);

    expect(vue?.regles.fin).toEqual({ type: "seuil", valeur: 500 });
    expect(vue?.regles.saisie).toEqual({ mode: "sommeAuGagnant", min: 0, max: 999 });
  });

  it("nomme les participants", async () => {
    const code = await ouvrirUnePartie();

    const vue = await lirePartieParCode(base, code);

    expect(vue?.participants.map((joueur) => joueur.nom)).toEqual(["Marie"]);
  });

  it("retrouve la partie depuis un code retapé comme il a été dicté", async () => {
    const code = await ouvrirUnePartie();
    // Le code ne porte ni O ni I ni L : les minuscules et les tirets de dictée
    // sont donc la seule chose qu'une retranscription puisse ajouter.
    const dicte = `${code.slice(0, 3).toLowerCase()}-${code.slice(3)}`;

    expect((await lirePartieParCode(base, dicte))?.code).toBe(normaliserCode(dicte));
  });

  it("ne rend rien pour un code que personne ne porte", async () => {
    await ouvrirUnePartie();

    expect(await lirePartieParCode(base, "ZZZZZZ")).toBeNull();
  });

  it("ne rend rien, et ne casse pas, pour un code malformé", async () => {
    expect(await lirePartieParCode(base, "pas un code")).toBeNull();
  });
});
