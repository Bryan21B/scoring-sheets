import { describe, expect, it } from "bun:test";
import { evaluerNom, type JoueurConnu, memeNom, nomSchema } from "@/lib/roster/noms";

const MARIE: JoueurConnu = { id: 1, nom: "Marie" };
const PAUL: JoueurConnu = { id: 2, nom: "Paul" };
const ROSTER = [MARIE, PAUL];

describe("nomSchema", () => {
  it("rogne les espaces autour", () => {
    expect(nomSchema.parse("  Marie  ")).toBe("Marie");
  });

  it("refuse un nom vide ou fait d'espaces", () => {
    expect(nomSchema.safeParse("").success).toBe(false);
    expect(nomSchema.safeParse("   ").success).toBe(false);
  });

  it("refuse un nom qui ne tiendrait pas dans une liste", () => {
    expect(nomSchema.safeParse("M".repeat(200)).success).toBe(false);
  });
});

describe("memeNom", () => {
  it("ignore la casse", () => {
    expect(memeNom("marie", "Marie")).toBe(true);
  });

  it("ignore les accents, parce que Zoé se tape Zoe un soir sur deux", () => {
    expect(memeNom("Zoe", "Zoé")).toBe(true);
  });

  it("ne confond pas deux noms distincts", () => {
    expect(memeNom("Marie B.", "Marie")).toBe(false);
    expect(memeNom("Paul", "Marie")).toBe(false);
  });
});

describe("evaluerNom", () => {
  it("laisse créer quand le roster est vide", () => {
    expect(evaluerNom("Marie", [])).toEqual({ statut: "creer", nom: "Marie" });
  });

  it("laisse créer un nom que personne ne porte", () => {
    expect(evaluerNom("Léa", ROSTER)).toEqual({ statut: "creer", nom: "Léa" });
  });

  it("demande de trancher quand le nom est déjà au roster", () => {
    expect(evaluerNom("Marie", ROSTER)).toEqual({
      statut: "desambiguiser",
      nom: "Marie",
      homonymes: [MARIE],
    });
  });

  it("le demande aussi quand seule la casse diffère", () => {
    expect(evaluerNom("marie", ROSTER)).toEqual({
      statut: "desambiguiser",
      nom: "marie",
      homonymes: [MARIE],
    });
  });

  it("liste tous les homonymes, pas seulement le premier", () => {
    const autreMarie: JoueurConnu = { id: 3, nom: "Marie" };

    expect(evaluerNom("Marie", [MARIE, PAUL, autreMarie])).toEqual({
      statut: "desambiguiser",
      nom: "Marie",
      homonymes: [MARIE, autreMarie],
    });
  });

  it("laisse passer le nom distinctif qui sort de la désambiguïsation", () => {
    // Jamais de suffixe automatique « Marie (2) » : c'est l'humain qui tranche,
    // parce que c'est lui qui relira la liste.
    expect(evaluerNom("Marie B.", ROSTER)).toEqual({ statut: "creer", nom: "Marie B." });
  });
});
