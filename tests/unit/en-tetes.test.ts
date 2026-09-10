import { describe, expect, it } from "bun:test";
import { EN_TETE_REFERENT, POLITIQUE_DE_REFERENT } from "@/lib/partie/referent";
import nextConfig from "../../next.config";

/** Les règles d'en-têtes déclarées par la configuration Next. */
async function reglesDEnTetes() {
  return (await nextConfig.headers?.()) ?? [];
}

describe("la politique de référent des pages de partie", () => {
  it("couvre l'adresse où vit le code", async () => {
    const sources = (await reglesDEnTetes()).map((regle) => regle.source);

    expect(sources).toContain("/p/:code*");
  });

  it("interdit au code de partir dans l'en-tête Referer", async () => {
    // Le code d'une partie vit dans l'URL, et la page porte le lien vers les
    // règles de l'éditeur : sans ça, le premier clic sortant l'emporte avec lui.
    const [pourLaPartie] = (await reglesDEnTetes()).filter((regle) =>
      regle.source.startsWith("/p/"),
    );

    expect(pourLaPartie?.headers).toContainEqual({
      key: EN_TETE_REFERENT,
      value: POLITIQUE_DE_REFERENT,
    });
  });

  it("choisit la plus restrictive des politiques", async () => {
    expect(POLITIQUE_DE_REFERENT).toBe("no-referrer");
  });
});
