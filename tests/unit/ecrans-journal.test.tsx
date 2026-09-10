import { describe, expect, it } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { TiroirDuJournal } from "@/components/tiroir-journal";
import type { LigneDuTiroir, VueDuTiroir } from "@/lib/journal/tiroir";
import { LEA, MARIE, PAUL } from "./helpers/tablee";

const CODE = "ABC123";

/** Une horloge fixe : l'horodatage se lit, il ne se recalcule pas à chaque test. */
const ECRIT_LE = new Date("2026-09-10T12:32:00.000Z");

function ligne(surcharges: Partial<LigneDuTiroir> = {}): LigneDuTiroir {
  return {
    id: 1,
    geste: "correction",
    agissant: MARIE,
    appareil: "A",
    joueurConcerne: PAUL,
    mancheNumero: 3,
    detail: { forme: "correction", ancienne: 12, nouvelle: 15 },
    ecritLe: ECRIT_LE,
    ...surcharges,
  };
}

function rendre(tiroir: VueDuTiroir): string {
  return renderToStaticMarkup(<TiroirDuJournal code={CODE} tiroir={tiroir} />);
}

describe("l'entrée de menu du journal", () => {
  it("n'est qu'un ⋯, jamais un interrupteur qui s'annonce", () => {
    const html = rendre({ etat: "ferme" });

    expect(html).toContain("⋯");
    expect(html).toContain(`href="/p/${CODE}?journal=corrections"`);
  });

  it("ne rend rien du tiroir tant qu'il est fermé", () => {
    const html = rendre({ etat: "ferme" });

    expect(html).not.toContain("Tout afficher");
    expect(html).not.toContain("<ul");
  });

  it("se nomme pour qui ne voit pas les trois points", () => {
    expect(rendre({ etat: "ferme" })).toContain('aria-label="Ouvrir le journal de la partie"');
  });
});

describe("le tiroir ouvert", () => {
  it("s'ouvre sans rien savoir de qui regarde : un spectateur le lit comme un joueur", () => {
    // Le composant ne prend **aucune identité de lecteur**, et c'est tout le
    // sujet : un journal que seul le créateur pourrait ouvrir ne réglerait pas
    // une dispute autour de la table, ce qui est son unique métier. Le test
    // vaut par ce qu'il n'a pas à passer.
    const html = rendre({ etat: "ouvert", portee: "corrections", lignes: [ligne()] });

    expect(html).toContain("Journal de la partie");
    expect(html).toContain("<ul");
  });

  it("se referme par un lien vers la page nue", () => {
    const html = rendre({ etat: "ouvert", portee: "corrections", lignes: [] });

    expect(html).toContain(`href="/p/${CODE}"`);
  });
});

describe("la bascule « tout afficher »", () => {
  it("mène de la vue par défaut au journal entier", () => {
    const html = rendre({ etat: "ouvert", portee: "corrections", lignes: [ligne()] });

    expect(html).toContain("Tout afficher");
    expect(html).toContain(`href="/p/${CODE}?journal=tout"`);
  });

  it("ramène du journal entier à la vue par défaut", () => {
    const html = rendre({ etat: "ouvert", portee: "tout", lignes: [ligne()] });

    expect(html).toContain("Ne montrer que les corrections");
    expect(html).toContain(`href="/p/${CODE}?journal=corrections"`);
  });
});

describe("une ligne du journal", () => {
  function uneLigne(surcharges: Partial<LigneDuTiroir> = {}): string {
    return rendre({ etat: "ouvert", portee: "tout", lignes: [ligne(surcharges)] });
  }

  it("nomme le geste, la manche concernée et l'horloge du serveur", () => {
    const html = uneLigne();

    expect(html).toContain("Correction");
    expect(html).toContain("Manche 3");
    expect(html).toContain("Paul");
    expect(html).toContain("10/09/2026 à 14:32");
    // Insensible à la casse : HTML l'est, et React rend l'attribut sous le nom
    // JSX qu'on lui a donné.
    expect(html).toMatch(new RegExp(`datetime="${ECRIT_LE.toISOString()}"`, "i"));
  });

  it("montre d'une correction l'ancienne valeur et la nouvelle", () => {
    expect(uneLigne()).toContain("12 → 15");
  });

  it("montre d'une saisie la valeur posée", () => {
    const html = uneLigne({ geste: "saisie", detail: { forme: "valeur", valeur: 12 } });

    expect(html).toContain("Saisie");
    expect(html).toContain("12");
  });

  it("reste lisible quand la charge utile n'a pas de forme connue", () => {
    // Le journal ne se migre jamais : une ligne d'une version antérieure garde
    // la forme de son époque, et le tiroir doit encore s'ouvrir dessus.
    const html = uneLigne({ geste: "abandon", detail: { forme: "aucun" }, mancheNumero: null });

    expect(html).toContain("Partie abandonnée");
  });
});

describe("ce que le tiroir affirme, et ce qu'il n'affirme pas", () => {
  const deuxLignes: readonly LigneDuTiroir[] = [
    ligne(),
    ligne({
      id: 2,
      geste: "saisie",
      agissant: LEA,
      appareil: "B",
      detail: { forme: "valeur", valeur: 7 },
    }),
  ];

  function toutes(): string {
    return rendre({ etat: "ouvert", portee: "tout", lignes: deuxLignes });
  }

  it("attribue le geste à l'appareil, jamais à la personne", () => {
    const html = toutes();

    expect(html).toContain("Depuis l’appareil A se déclarant Marie");
    expect(html).toContain("Depuis l’appareil B se déclarant Léa");
  });

  it("nomme l'appareil, ce que le seul joueur ne dirait pas", () => {
    // Deux téléphones qui se déclarent la même personne sont l'anomalie pour
    // laquelle le tiroir existe : sans étiquette, les deux lignes seraient
    // indiscernables.
    const html = rendre({
      etat: "ouvert",
      portee: "tout",
      lignes: [ligne(), ligne({ id: 2, appareil: "B" })],
    });

    expect(html).toContain("l’appareil A se déclarant Marie");
    expect(html).toContain("l’appareil B se déclarant Marie");
  });

  it("se contente d'« un appareil » quand la ligne n'en porte plus", () => {
    const html = rendre({ etat: "ouvert", portee: "tout", lignes: [ligne({ appareil: null })] });

    expect(html).toContain("Depuis un appareil se déclarant Marie");
  });

  it("n'écrit jamais qu'une personne a agi", () => {
    // Les tournures que la spec interdit, dans les formes où elles arriveraient
    // si quelqu'un « simplifiait » la ligne un jour : « Marie a changé cette
    // case », « corrigé par Marie », « Marie : correction ».
    const html = toutes();

    expect(html).not.toMatch(/Marie a\s/);
    expect(html).not.toMatch(/Léa a\s/);
    expect(html).not.toMatch(/par (Marie|Léa)/);
    expect(html).not.toMatch(/(Marie|Léa)\s*:/);
  });

  it("fait porter chaque ligne par un appareil, sans exception", () => {
    // Le compte, et pas seulement la présence : réécrire une seule ligne en
    // « Marie a corrigé » laisserait l'autre tournure intacte et passerait un
    // test qui se contenterait de chercher « se déclarant ».
    const html = toutes();

    expect(html.match(/Depuis (l’appareil [A-Z]+|un appareil) se déclarant/g)).toHaveLength(
      deuxLignes.length,
    );
  });

  it("dit en tête que le lien appareil-joueur est une déclaration, pas une preuve", () => {
    const html = toutes();

    expect(html).toContain("Un appareil se déclare, il ne se prouve pas");
    expect(html).toContain("jamais qui l’a fait");
  });

  it("nomme les gestes au participe, jamais au verbe conjugué", () => {
    // Un verbe conjugué réclame un sujet, et ce sujet serait une personne. Le
    // libellé au nom est ce qui empêche la phrase de se former.
    const html = rendre({
      etat: "ouvert",
      portee: "tout",
      lignes: [
        ligne({ id: 3, geste: "suppressionDeManche", detail: { forme: "aucun" } }),
        ligne({ id: 4, geste: "participantRetire", detail: { forme: "aucun" } }),
      ],
    });

    expect(html).toContain("Manche supprimée");
    expect(html).toContain("Joueur retiré");
    expect(html).not.toContain("a supprimé");
    expect(html).not.toContain("a retiré");
  });
});
