import { describe, expect, it } from "bun:test";

/**
 * Les lignes de **code** d'un fichier source, commentaires ôtés.
 *
 * Une JSDoc qui dit « pas de `useEffect` ici » n'est pas un `useEffect`, et une
 * qui dit « on sonde toutes les trois secondes » n'est pas un `setInterval` :
 * c'est le code qu'on épingle, jamais le vocabulaire autour.
 */
async function codeDe(chemin: string): Promise<string> {
  const source = await Bun.file(new URL(`../../${chemin}`, import.meta.url)).text();

  return source
    .split("\n")
    .filter((ligne) => !/^\s*(\/\/|\/\*|\*)/.test(ligne))
    .join("\n");
}

describe("le poll de la partie", () => {
  it("bat sur l'intervalle mesuré, et ne réécrit pas le nombre à côté", async () => {
    const code = await codeDe("src/components/poll-de-partie.tsx");

    expect(code).toContain("setInterval");
    expect(code).toContain("INTERVALLE_DE_POLL_MS");
    expect(code).not.toContain("3000");
  });

  it("délègue la décision à `doitRafraichir` plutôt que de la refaire en ligne", async () => {
    // C'est ce qui rend « inchangée, on ne fait rien ; changée, on rafraîchit »
    // vérifiable : un `!==` noyé dans le `useEffect` ne se teste pas.
    const code = await codeDe("src/components/poll-de-partie.tsx");

    expect(code).toContain("doitRafraichir");
    expect(code).toContain("refresh()");
  });

  it("range son battement : un intervalle non nettoyé s'empile à chaque rendu", async () => {
    const code = await codeDe("src/components/poll-de-partie.tsx");

    expect(code).toContain("clearInterval");
  });

  it("n'emporte pas la base dans le navigateur", async () => {
    // Le composant est `use client` : importer le module qui lit la base
    // ferait partir Drizzle et le schéma dans le paquet servi au téléphone.
    const code = await codeDe("src/components/poll-de-partie.tsx");

    expect(code).toContain("@/lib/partie/sondage");
    expect(code).not.toContain("@/lib/partie/version");
    expect(code).not.toContain("@/db");
  });
});

describe("la passe avant reste sans poll", () => {
  // Elle ne montre aucun total et aucune alerte : elle n'a rien à rafraîchir,
  // et c'est ce qui dissout la question « ma valeur est-elle remplacée pendant
  // que je tape ». Le garde-fou est mécanique plutôt qu'en prose.
  const ecransSansPoll = [
    "src/components/passe-avant.tsx",
    "src/app/p/[code]/manche/[numero]/page.tsx",
  ] as const;

  for (const ecran of ecransSansPoll) {
    it(`${ecran} n'ouvre aucun battement`, async () => {
      const code = await codeDe(ecran);

      expect(code).not.toContain("setInterval");
      expect(code).not.toContain("useEffect");
      expect(code).not.toContain("refresh");
      expect(code).not.toContain("PollDePartie");
    });
  }
});
