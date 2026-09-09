import { describe, expect, it } from "bun:test";
import { tirerAuHasard } from "@/lib/aleatoire";

describe("tirerAuHasard", () => {
  it("rend la longueur demandée, prise dans l'alphabet donné", () => {
    expect(tirerAuHasard("AB", 8)).toMatch(/^[AB]{8}$/);
  });

  it("refuse un alphabet qui biaiserait le tirage", () => {
    // 256 n'est pas divisible par 33 : `octet % 33` favoriserait les premiers
    // symboles. Le biais serait invisible à la lecture et invisible à l'usage —
    // d'où le refus à l'appel plutôt qu'une note en commentaire.
    expect(() => tirerAuHasard("A".repeat(33), 6)).toThrow();
    expect(() => tirerAuHasard("", 6)).toThrow();
  });

  it("accepte les tailles d'alphabet qui divisent 256", () => {
    expect(() => tirerAuHasard("0123456789ABCDEFGHJKMNPQRSTVWXYZ", 6)).not.toThrow();
  });

  it("ne rend pas deux fois le même tirage sur un alphabet large", () => {
    const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_-";
    const tirages = new Set(Array.from({ length: 200 }, () => tirerAuHasard(alphabet, 21)));

    expect(tirages.size).toBe(200);
  });
});
