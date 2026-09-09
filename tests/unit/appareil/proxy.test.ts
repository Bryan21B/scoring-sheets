import { describe, expect, it } from "bun:test";
import { NextRequest } from "next/server";
import { creerIdAppareil, DUREE_COOKIE_APPAREIL } from "@/lib/appareil/cookie";
import proxy from "@/proxy";

/** Le seul en-tête qui compte ici : ce que le navigateur reçoit. */
function setCookie(requete: NextRequest): string {
  return proxy(requete).headers.get("set-cookie") ?? "";
}

/** Une requête vierge, comme un tout premier chargement. */
function premierChargement(): NextRequest {
  return new NextRequest("https://feuille.test/");
}

/** La même, avec le cookie que le chargement précédent a posé. */
function chargementSuivant(id: string): NextRequest {
  return new NextRequest("https://feuille.test/", {
    headers: { cookie: `appareil=${id}` },
  });
}

describe("le cookie d'appareil, posé par le proxy", () => {
  it("part dès le premier chargement, avant toute identification", () => {
    expect(setCookie(premierChargement())).toMatch(/appareil=[A-Za-z0-9_-]{21}/);
  });

  it("porte les drapeaux décidés", () => {
    const entete = setCookie(premierChargement());

    expect(entete).toContain("HttpOnly");
    expect(entete).toContain("Secure");
    expect(entete).toContain("SameSite=lax");
    expect(entete).toContain("Path=/");
  });

  it("porte les quatre cents jours", () => {
    expect(setCookie(premierChargement())).toContain(`Max-Age=${DUREE_COOKIE_APPAREIL}`);
  });

  it("se réémet à chaque requête, pour remettre le compteur à zéro", () => {
    const dejaLa = creerIdAppareil();

    expect(setCookie(chargementSuivant(dejaLa))).toContain(`appareil=${dejaLa}`);
  });

  it("ne fait pas tourner l'identité en la réémettant", () => {
    const dejaLa = creerIdAppareil();
    const deuxRequetes = [
      setCookie(chargementSuivant(dejaLa)),
      setCookie(chargementSuivant(dejaLa)),
    ];

    expect(deuxRequetes.every((entete) => entete.includes(dejaLa))).toBe(true);
  });

  it("donne un identifiant différent à deux appareils vierges", () => {
    expect(setCookie(premierChargement())).not.toBe(setCookie(premierChargement()));
  });
});
