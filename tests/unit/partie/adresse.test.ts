import { describe, expect, it } from "bun:test";
import { adresseDePartie, adresseDuCodeTape } from "@/lib/partie/adresse";

describe("adresseDuCodeTape", () => {
  it("mène le code dicté à l'adresse même du lien", () => {
    // Les deux chemins d'arrivée — le lien reçu, le code retapé — sont la même
    // chaîne : c'est cette égalité-là qui le dit.
    expect(adresseDuCodeTape("oi123z")).toBe(adresseDePartie("01123Z"));
  });

  it("accepte les minuscules, les espaces et les tirets de la dictée", () => {
    expect(adresseDuCodeTape(" a1b-2c3 ")).toBe("/p/A1B2C3");
  });

  it("ne mène nulle part quand ce n'est pas un code", () => {
    expect(adresseDuCodeTape("bricole !")).toBeNull();
    expect(adresseDuCodeTape("")).toBeNull();
  });
});
