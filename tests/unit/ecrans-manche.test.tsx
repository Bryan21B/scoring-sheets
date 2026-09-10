import { describe, expect, it } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { PasseAvant } from "@/components/passe-avant";
import { Recapitulatif } from "@/components/recapitulatif";
import { trouverEntree } from "@/lib/jeux/catalogue";
import type { CaseDeManche, VueDeManche } from "@/lib/manche/lecture";
import { casesDeLaTablee, LEA, MARIE, PAUL, TABLEE } from "./helpers/tablee";

const SIX_QUI_PREND = trouverEntree("6-qui-prend");
const ADRESSE = "/p/ABC123/manche/1";

/** Une borne quelconque : le pavé la reçoit en prop, sa valeur n'apprend rien ici. */
const BORNE = 200;

function passeAvant(caseASaisir: CaseDeManche): string {
  return renderToStaticMarkup(
    <PasseAvant
      action="/p/ABC123/manche/1"
      mancheId={7}
      mancheNumero={1}
      caseASaisir={caseASaisir}
      max={BORNE}
      unite={SIX_QUI_PREND.unite}
      recapitulatif={`${ADRESSE}/recapitulatif`}
    />,
  );
}

function manche(...valeurs: readonly (number | null)[]): VueDeManche {
  return { id: 7, numero: 1, cases: casesDeLaTablee(...valeurs) };
}

function recapitulatif(vue: VueDeManche, totaux: ReadonlyMap<number, number>): string {
  return renderToStaticMarkup(
    <Recapitulatif
      manche={vue}
      totaux={totaux}
      unite={SIX_QUI_PREND.unite}
      adresseDeLaManche={ADRESSE}
    />,
  );
}

describe("la passe avant", () => {
  it("nomme le joueur dont c'est la case", () => {
    expect(passeAvant({ joueur: PAUL, valeur: null })).toContain("Paul");
  });

  it("dit de quelle manche il s'agit", () => {
    expect(passeAvant({ joueur: PAUL, valeur: null })).toContain("Manche 1");
  });

  it("envoie la valeur montrée avec l'écriture : c'est elle qui la conditionne", () => {
    const html = passeAvant({ joueur: PAUL, valeur: 15 });

    expect(html).toContain('name="valeurMontree"');
    expect(html).toContain('value="15"');
  });

  it("envoie une valeur montrée vide quand la case l'est", () => {
    const html = passeAvant({ joueur: PAUL, valeur: null });

    expect(html).toContain('name="valeurMontree"');
    expect(html).toContain('value=""');
  });

  it("dit quelle case elle écrit, et dans quelle manche", () => {
    const html = passeAvant({ joueur: PAUL, valeur: null });

    expect(html).toContain('name="joueurConcerneId"');
    expect(html).toContain('name="mancheId"');
  });

  it("mène au récapitulatif : un écran, pas cinq", () => {
    expect(passeAvant({ joueur: PAUL, valeur: null })).toContain(`href="${ADRESSE}/recapitulatif"`);
  });
});

describe("le pavé de la passe avant", () => {
  it("est maison : dix touches, et pas un champ que le clavier système remplirait", () => {
    const html = passeAvant({ joueur: PAUL, valeur: null });

    for (const chiffre of [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]) {
      expect(html).toContain(`>${chiffre}</button>`);
    }
    expect(html).not.toContain('type="number"');
    expect(html).not.toContain('type="text"');
  });

  it("est toujours ouvert : rien à déplier pour taper", () => {
    const html = passeAvant({ joueur: PAUL, valeur: null });

    expect(html).not.toContain("<dialog");
    expect(html).not.toContain("<details");
  });
});

describe("ce que la passe avant ne montre pas", () => {
  it("n'affiche aucun total", () => {
    const html = passeAvant({ joueur: PAUL, valeur: 15 }).toLowerCase();

    expect(html).not.toContain("total");
  });

  it("n'affiche aucune alerte de seuil", () => {
    const html = passeAvant({ joueur: PAUL, valeur: 15 }).toLowerCase();

    expect(html).not.toContain("seuil");
    expect(html).not.toContain("s’arrête à");
  });

  it("ne poll pas : rien à rafraîchir, donc rien qui se rafraîchisse", async () => {
    // Le garde-fou est mécanique plutôt qu'en prose : c'est ce qui dissout la
    // question « ma valeur est-elle remplacée pendant que je tape ».
    const source = await Bun.file(
      new URL("../../src/components/passe-avant.tsx", import.meta.url),
    ).text();
    // Ce sont les lignes de code qu'on épingle, pas le vocabulaire : une JSDoc
    // qui dit « pas de `useEffect` ici » n'est pas un `useEffect`.
    const code = source
      .split("\n")
      .filter((ligne) => !/^\s*(\/\/|\/\*|\*)/.test(ligne))
      .join("\n");

    expect(code).not.toContain("setInterval");
    expect(code).not.toContain("useEffect");
    expect(code).not.toContain("refresh");
  });
});

describe("le récapitulatif", () => {
  const totaux = new Map([
    [MARIE.id, 8],
    [PAUL.id, 23],
    [LEA.id, 0],
  ]);

  it("montre les totaux du moteur", () => {
    const html = recapitulatif(manche(8, 15, null), totaux);

    expect(html).toContain("23");
  });

  it("nomme les cases encore vides par le joueur qu'elles concernent", () => {
    const html = recapitulatif(manche(8, 15, null), totaux);

    expect(html).toContain("Léa");
    expect(html).toContain("à saisir");
  });

  it("ne dit pas « à saisir » d'une case remplie à zéro", () => {
    const html = recapitulatif(manche(0, 15, 3), totaux);

    expect(html).not.toContain("à saisir");
  });

  it("laisse retaper n'importe quelle ligne, remplie comprise", () => {
    const html = recapitulatif(manche(8, 15, null), totaux);

    for (const joueur of TABLEE) {
      expect(html).toContain(`href="${ADRESSE}?joueur=${joueur.id}"`);
    }
  });

  it("dit de quelle manche il récapitule", () => {
    expect(recapitulatif(manche(8, 15, null), totaux)).toContain("Manche 1");
  });
});
