import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import type { Base } from "@/db/base";
import { creerIdAppareil } from "@/lib/appareil/cookie";
import { lireLeJoueurDeLAppareil } from "@/lib/appareil/lecture";
import { type BaseDeTest, creerBaseDeTest } from "../helpers/base-de-test";
import {
  joueurDeLaPartie,
  ouvrirUnePartieDeTest,
  type PartieDeTest,
} from "../helpers/partie-de-test";

let baseDeTest: BaseDeTest;
let base: Base;
let partie: PartieDeTest;

beforeEach(async () => {
  baseDeTest = creerBaseDeTest();
  base = baseDeTest.base;
  partie = await ouvrirUnePartieDeTest(base);
});

afterEach(() => {
  baseDeTest.fermer();
});

describe("lireLeJoueurDeLAppareil", () => {
  it("rend le joueur vers lequel l'appareil pointe", async () => {
    expect(await lireLeJoueurDeLAppareil(base, partie.idAppareil)).toBe(
      joueurDeLaPartie(partie, 0),
    );
  });

  it("rend null pour un appareil que la base ne connaît pas", async () => {
    expect(await lireLeJoueurDeLAppareil(base, creerIdAppareil())).toBeNull();
  });

  it("rend null pour un cookie qui n'a même pas la forme d'un identifiant", async () => {
    // La valeur vient d'un cookie, qui se bricole à la main : une forme
    // inconnue se lit « personne », elle ne lève pas.
    expect(await lireLeJoueurDeLAppareil(base, "bricolé")).toBeNull();
  });

  it("rend null quand aucun cookie n'est arrivé", async () => {
    expect(await lireLeJoueurDeLAppareil(base, undefined)).toBeNull();
  });
});
