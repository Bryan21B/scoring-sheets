import { describe, expect, it } from "bun:test";
import { cleDOrigine } from "@/lib/partie/origine";

/** Ce que les en-têtes de la requête portent, dans l'ordre où on les lit. */
function adresses(reelle: string | null, transmise: string | null) {
  return { reelle, transmise };
}

describe("la clé qui compte les tentatives", () => {
  it("est l'adresse que la plateforme a résolue elle-même", () => {
    expect(cleDOrigine(adresses("203.0.113.7", null), "un-appareil")).toBe("ip:203.0.113.7");
  });

  it("ne garde que le dernier maillon de la chaîne transmise", () => {
    // `x-forwarded-for` s'allonge à chaque relais, et **le client écrit le
    // premier maillon**. Prendre celui de gauche donnerait à qui forge l'en-tête
    // un compteur neuf à chaque requête ; celui de droite est le seul que notre
    // propre mandataire a constaté.
    expect(cleDOrigine(adresses(null, "1.2.3.4, 203.0.113.7"), "un-appareil")).toBe(
      "ip:203.0.113.7",
    );
  });

  it("préfère l'adresse résolue à la chaîne que le client peut allonger", () => {
    expect(cleDOrigine(adresses("203.0.113.7", "1.2.3.4"), "un-appareil")).toBe("ip:203.0.113.7");
  });

  it("retombe sur l'appareil quand la requête n'a aucune adresse", () => {
    // En développement il n'y a pas de mandataire devant : sans ce repli, tout
    // le monde partagerait le même compteur.
    expect(cleDOrigine(adresses(null, null), "un-appareil")).toBe("appareil:un-appareil");
  });

  it("range ensemble ce qui n'a ni adresse ni cookie", () => {
    // Un client qui n'accepte pas les cookies et n'a pas d'adresse est
    // exactement le profil d'un script : un seul compteur pour tous convient.
    expect(cleDOrigine(adresses(null, null), undefined)).toBe("sans-origine");
  });

  it("ne mélange jamais une adresse et un identifiant d'appareil", () => {
    // Les deux espaces sont préfixés : sans ça, un cookie forgé pourrait se
    // faire passer pour l'adresse de quelqu'un d'autre et user son compteur.
    expect(cleDOrigine(adresses(null, null), "203.0.113.7")).not.toBe(
      cleDOrigine(adresses("203.0.113.7", null), undefined),
    );
  });

  it("ignore une chaîne transmise vide plutôt que d'en faire une clé", () => {
    expect(cleDOrigine(adresses("", " , "), "un-appareil")).toBe("appareil:un-appareil");
  });
});
