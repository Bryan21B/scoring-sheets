import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import type { InValue } from "@libsql/client";
import type { Base } from "@/db/base";
import { trouverEntree } from "@/lib/jeux/catalogue";
import { resoudreRegles } from "@/lib/jeux/resolution";
import { cloturerLaManche } from "@/lib/manche/cloture";
import { lireLaGrille } from "@/lib/manche/lecture";
import { ouvrirLaMancheSuivante } from "@/lib/manche/ouverture";
import { ecrireLaCase } from "@/lib/manche/saisie";
import { lirePartieEnCours } from "@/lib/partie/en-cours";
import { retirerParticipant } from "@/lib/partie/salle-attente";
import { doitRafraichir } from "@/lib/partie/sondage";
import { chercherLaVersion, lireLaVersion, selectionDeVersion } from "@/lib/partie/version";
import { type BaseDeTest, creerBaseDeTest } from "../helpers/base-de-test";
import {
  joueurDeLaPartie,
  ouvrirUnePartieDeTest,
  type PartieDeTest,
} from "../helpers/partie-de-test";

/** Les règles figées à l'ouverture de la partie de test : 6 qui prend à trois. */
const REGLES = resoudreRegles(trouverEntree("6-qui-prend"), { nombreDeJoueurs: 3 });

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

describe("lireLaVersion", () => {
  it("rend l'estampille de la partie que ce code désigne, et non d'une voisine", async () => {
    const voisine = await ouvrirUnePartieDeTest(base, { noms: ["Zoé", "Tom"] });
    await ouvrirLaMancheSuivante(base, voisine.partieId);
    await ouvrirLaMancheSuivante(base, voisine.partieId);

    const ici = await lireLaVersion(base, partie.code);
    const laBas = await lireLaVersion(base, voisine.code);

    expect(ici).not.toBe(laBas);
    expect(await lireLaVersion(base, partie.code)).toBe(ici);
  });

  it("rend null pour un code que personne ne porte", async () => {
    expect(await lireLaVersion(base, "ZZZZZZ")).toBeNull();
  });

  it("rend null pour un code malformé plutôt que de lever", async () => {
    expect(await lireLaVersion(base, "pas-un-code")).toBeNull();
  });

  it("ne lit qu'une seule ligne, et par l'index du code", async () => {
    // La promesse du poll, tenue mécaniquement : à trois secondes fois cinq
    // téléphones fois trois heures, un balayage de table serait le coût de la
    // soirée entière. Le plan d'exécution est la seule preuve qui ne se périme
    // pas quand la requête est réécrite.
    const requete = selectionDeVersion(base, "A1B2C3").toSQL();
    const plan = await baseDeTest.client.execute({
      sql: `explain query plan ${requete.sql}`,
      args: requete.params as InValue[],
    });

    expect(plan.rows).toHaveLength(1);
    expect(String(plan.rows[0]?.detail)).toContain("partie_code_unique");
  });
});

describe("chercherLaVersion", () => {
  it("rend l'estampille sous une limite ouverte", async () => {
    const trouvee = await chercherLaVersion(base, limiteOuverte(), {
      code: partie.code,
      cle: "un-appareil",
      maintenant: 0,
    });

    expect(trouvee.statut).toBe("lue");
  });

  it("refuse sans toucher la base quand la limite est fermée", async () => {
    const refus = await chercherLaVersion(base, limiteFermee(), {
      code: partie.code,
      cle: "un-appareil",
      maintenant: 0,
    });

    expect(refus.statut).toBe("tropDeTentatives");
  });

  it("compte un code inconnu comme un échec : le poll n'est pas une porte dérobée", async () => {
    // Sans ça, énumérer les codes par `/version` contournerait la limite posée
    // sur la recherche — un deuxième chemin non limité annule le premier.
    const echecs: string[] = [];
    const limiteur = {
      estOuvert: () => true,
      noterUnEchec: (cle: string) => {
        echecs.push(cle);
      },
    };

    await chercherLaVersion(base, limiteur, { code: "ZZZZZZ", cle: "un-appareil", maintenant: 0 });

    expect(echecs).toEqual(["un-appareil"]);
  });
});

describe("ce qu'un téléphone voit bouger sur l'autre", () => {
  it("ne rafraîchit rien tant que personne n'écrit", async () => {
    const auRendu = await lireLaVersion(base, partie.code);
    const troisSecondesPlusTard = await lireLaVersion(base, partie.code);

    expect(doitRafraichir(auRendu ?? 0, troisSecondesPlusTard ?? 0)).toBe(false);
  });

  it("rafraîchit après une valeur saisie ailleurs, et la grille la porte alors", async () => {
    // La preuve tenue à la couture, faute de deux navigateurs : l'estampille
    // que le téléphone de Léa a en main, l'écriture faite sur celui de Bryan,
    // et la décision que le sondage suivant en tire. Ce que cela n'établit pas
    // est le câblage du `setInterval` dans le navigateur.
    const mancheId = (await ouvrirLaMancheSuivante(base, partie.partieId)).id;
    const chezLea = await lireLaVersion(base, partie.code);

    await ecrireLaCase(base, {
      mancheId,
      joueurConcerneId: joueurDeLaPartie(partie, 1),
      valeurMontree: null,
      valeur: 12,
      agissant: { joueurId: joueurDeLaPartie(partie, 0), appareilId: partie.idAppareil },
    });

    const sondee = await lireLaVersion(base, partie.code);

    expect(doitRafraichir(chezLea ?? 0, sondee ?? 0)).toBe(true);

    const grille = await lireLaGrille(base, partie.partieId, REGLES);

    expect(grille.manches[0]?.cases.map((une) => une.valeur)).toEqual([null, 12, null]);
    expect(grille.etat.totaux.get(joueurDeLaPartie(partie, 1))).toBe(12);
  });

  it("voit bouger l'estampille sur un mouvement de tablée, pas seulement sur une saisie", async () => {
    const avant = await lireLaVersion(base, partie.code);

    await retirerParticipant(base, partie.partieId, {
      idAppareil: partie.idAppareil,
      joueurId: joueurDeLaPartie(partie, 2),
    });

    expect(doitRafraichir(avant ?? 0, (await lireLaVersion(base, partie.code)) ?? 0)).toBe(true);
  });
});

/** Un limiteur toujours ouvert : la limite n'est pas le sujet de ce test. */
function limiteOuverte() {
  return { estOuvert: () => true, noterUnEchec: () => undefined };
}

/** Un limiteur toujours fermé, pour voir le refus sans attendre une fenêtre. */
function limiteFermee() {
  return { estOuvert: () => false, noterUnEchec: () => undefined };
}

describe("la fin d'une partie, vue du poll", () => {
  /** Remplit et clôt une manche pour toute la tablée, à la valeur donnée. */
  async function jouerUneManche(valeur: number): Promise<void> {
    const mancheId = (await ouvrirLaMancheSuivante(base, partie.partieId)).id;

    for (const rang of [0, 1, 2]) {
      await ecrireLaCase(base, {
        mancheId,
        joueurConcerneId: joueurDeLaPartie(partie, rang),
        valeurMontree: null,
        valeur,
        agissant: { joueurId: joueurDeLaPartie(partie, 0), appareilId: partie.idAppareil },
      });
    }

    await cloturerLaManche(base, { mancheId, parJoueurId: joueurDeLaPartie(partie, 0) });
  }

  it("fait bouger l'estampille quand la partie se scelle, alors que la fin n'écrit que `partie`", async () => {
    // `src/db/triggers.sql` le dit noir sur blanc : aucun déclencheur ne
    // surveille `partie`, et la fin n'écrit que ses trois colonnes. Ce qui
    // sauve le poll est la ligne de journal posée dans la même transaction.
    // Sans elle, les autres téléphones verraient une partie close sans jamais
    // l'apprendre — c'est exactement ce que ce test empêche de régresser.
    await jouerUneManche(30);
    const avantLaDerniere = await lireLaVersion(base, partie.code);

    await jouerUneManche(40);

    expect(
      doitRafraichir(avantLaDerniere ?? 0, (await lireLaVersion(base, partie.code)) ?? 0),
    ).toBe(true);
  });

  it("sort de l'accueil une partie que la clôture vient de sceller", async () => {
    await jouerUneManche(30);
    await jouerUneManche(40);

    expect(await lirePartieEnCours(base)).toBeNull();
  });
});
