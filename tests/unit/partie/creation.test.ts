import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import type { Base } from "@/db/base";
import { appareil, joueur, participant, partie } from "@/db/schema";
import { creerIdAppareil } from "@/lib/appareil/cookie";
import { trouverEntree } from "@/lib/jeux/catalogue";
import { parseRegles } from "@/lib/jeux/regles";
import { resoudreRegles } from "@/lib/jeux/resolution";
import { codeSchema } from "@/lib/partie/code";
import { creerPartie, RefusDeCreation } from "@/lib/partie/creation";
import { type BaseDeTest, creerBaseDeTest } from "../helpers/base-de-test";

let baseDeTest: BaseDeTest;
let base: Base;

const APPAREIL = creerIdAppareil();

/** La saisie de l'écran de la tablée, dans sa forme la plus courante. */
function ouverture(surcharges: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    idAppareil: APPAREIL,
    jeuId: "6-qui-prend",
    nombreDeJoueurs: "4",
    finValeur: "66",
    identite: { mode: "nouveau", nom: "Marie" },
    ...surcharges,
  };
}

/** Le code d'une création réussie, ou l'échec du test si elle ne l'était pas. */
async function creerEtLireLeCode(saisie: Record<string, unknown>): Promise<string> {
  const resultat = await creerPartie(base, saisie);

  if (resultat.statut !== "creee") {
    throw new Error(`Création attendue, reçu « ${resultat.statut} ».`);
  }

  return resultat.code;
}

beforeEach(() => {
  baseDeTest = creerBaseDeTest();
  base = baseDeTest.base;
});

afterEach(() => {
  baseDeTest.fermer();
});

describe("ce que la partie créée porte", () => {
  it("fige l'instantané des règles résolues", async () => {
    await creerEtLireLeCode(ouverture());

    const [ligne] = await base.select().from(partie);

    expect(parseRegles(ligne?.regles ?? "")).toEqual(
      resoudreRegles(trouverEntree("6-qui-prend"), { nombreDeJoueurs: 4 }),
    );
  });

  it("garde l'identifiant du jeu, que rien en base ne contraint", async () => {
    await creerEtLireLeCode(ouverture({ jeuId: "uno", finValeur: "500" }));

    const [ligne] = await base.select().from(partie);

    expect(ligne?.jeuId).toBe("uno");
  });

  it("porte un code de la forme dictée", async () => {
    const code = await creerEtLireLeCode(ouverture());

    expect(codeSchema.safeParse(code).success).toBe(true);
  });

  it("donne à chaque partie son propre code", async () => {
    const premier = await creerEtLireLeCode(ouverture());
    const second = await creerEtLireLeCode(
      ouverture({ identite: { mode: "roster", joueurId: 1 } }),
    );

    expect(second).not.toBe(premier);
  });

  it("inscrit son créateur comme participant", async () => {
    await creerEtLireLeCode(ouverture());

    const [inscription] = await base.select().from(participant);
    const [creatrice] = await base.select().from(joueur);
    const [ligne] = await base.select().from(partie);

    expect(inscription?.partieId).toBe(ligne?.id ?? -1);
    expect(inscription?.joueurId).toBe(creatrice?.id ?? -1);
    expect(creatrice?.nom).toBe("Marie");
  });

  it("naît sans fin — les trois colonnes bougent ensemble ou pas du tout", async () => {
    await creerEtLireLeCode(ouverture());

    const [ligne] = await base.select().from(partie);

    expect(ligne?.finLe).toBeNull();
    expect(ligne?.finCause).toBeNull();
    expect(ligne?.finPar).toBeNull();
  });
});

describe("la surcharge du seuil", () => {
  it("remplace la valeur imprimée par celle de la tablée", async () => {
    await creerEtLireLeCode(ouverture({ finValeur: "30" }));

    const [ligne] = await base.select().from(partie);

    expect(parseRegles(ligne?.regles ?? "").fin).toEqual({ type: "seuil", valeur: 30 });
  });

  it("garde le type de fin du jeu, jamais celui de la tablée", async () => {
    // « On s'arrête à 3 » à deux joueurs à Dnup vaut trois manches gagnées, pas
    // trois jetons : le type vient du jeu, la valeur de la table.
    await creerEtLireLeCode(ouverture({ jeuId: "dnup", nombreDeJoueurs: "2", finValeur: "3" }));

    const [ligne] = await base.select().from(partie);

    expect(parseRegles(ligne?.regles ?? "").fin).toEqual({ type: "manchesGagnees", valeur: 3 });
  });

  it("refuse zéro, un négatif et un décimal", async () => {
    await expect(creerPartie(base, ouverture({ finValeur: "0" }))).rejects.toThrow();
    await expect(creerPartie(base, ouverture({ finValeur: "-4" }))).rejects.toThrow();
    await expect(creerPartie(base, ouverture({ finValeur: "6.5" }))).rejects.toThrow();
  });
});

describe("les bornes de joueurs", () => {
  it("refuse sous le plancher du jeu", async () => {
    await expect(creerPartie(base, ouverture({ nombreDeJoueurs: "1" }))).rejects.toThrow();
  });

  it("refuse au-dessus du plafond du jeu", async () => {
    await expect(
      creerPartie(base, ouverture({ jeuId: "dnup", nombreDeJoueurs: "6", finValeur: "4" })),
    ).rejects.toThrow();
  });

  it("suit le plafond propre à la variante, pas celui du jeu de base", async () => {
    await expect(
      creerPartie(
        base,
        ouverture({ jeuId: "6-qui-prend-cartes-speciales", nombreDeJoueurs: "9", finValeur: "2" }),
      ),
    ).rejects.toThrow();
  });

  it("n'écrit rien du tout quand elle refuse", async () => {
    await expect(creerPartie(base, ouverture({ nombreDeJoueurs: "1" }))).rejects.toThrow();

    expect(await base.select().from(partie)).toHaveLength(0);
    expect(await base.select().from(joueur)).toHaveLength(0);
  });
});

describe("le lien de l'appareil vers le joueur", () => {
  it("pointe vers celui qui vient de se choisir", async () => {
    await creerEtLireLeCode(ouverture());

    const [lien] = await base.select().from(appareil);
    const [creatrice] = await base.select().from(joueur);

    expect(lien?.id).toBe(APPAREIL);
    expect(lien?.joueurId).toBe(creatrice?.id ?? -1);
  });

  it("est global : une deuxième partie repointe la même ligne, elle n'en ajoute pas", async () => {
    await creerEtLireLeCode(ouverture());
    await creerEtLireLeCode(ouverture({ identite: { mode: "nouveau", nom: "Paul" } }));

    const liens = await base.select().from(appareil);
    const roster = await base.select().from(joueur);

    expect(liens).toHaveLength(1);
    expect(liens[0]?.joueurId).toBe(roster[1]?.id ?? -1);
  });

  it("refuse une valeur de cookie qui n'a pas la forme émise", async () => {
    await expect(creerPartie(base, ouverture({ idAppareil: "bricole" }))).rejects.toThrow();
  });
});

describe("le nom du créateur, contre le roster", () => {
  it("crée le joueur quand personne ne porte ce nom", async () => {
    await creerEtLireLeCode(ouverture());

    expect(await base.select().from(joueur)).toHaveLength(1);
  });

  it("demande de trancher quand le nom existe déjà, et n'écrit rien", async () => {
    await creerEtLireLeCode(ouverture());

    const resultat = await creerPartie(
      base,
      ouverture({ identite: { mode: "nouveau", nom: "Marie" } }),
    );

    expect(resultat.statut).toBe("desambiguiser");
    expect(await base.select().from(joueur)).toHaveLength(1);
    expect(await base.select().from(partie)).toHaveLength(1);
  });

  it("réutilise le joueur choisi explicitement, sans créer de doublon", async () => {
    await creerEtLireLeCode(ouverture());
    const [marie] = await base.select().from(joueur);

    await creerEtLireLeCode(ouverture({ identite: { mode: "roster", joueurId: marie?.id } }));

    expect(await base.select().from(joueur)).toHaveLength(1);
    expect(await base.select().from(partie)).toHaveLength(2);
  });

  it("crée la deuxième personne une fois le nom rendu distinctif", async () => {
    await creerEtLireLeCode(ouverture());

    await creerEtLireLeCode(ouverture({ identite: { mode: "nouveau", nom: "Marie B." } }));

    expect(await base.select().from(joueur)).toHaveLength(2);
  });

  it("refuse un joueur du roster qui n'existe pas", async () => {
    await expect(
      creerPartie(base, ouverture({ identite: { mode: "roster", joueurId: 404 } })),
    ).rejects.toThrow();
  });
});

describe("ce qu'un refus dit à l'écran", () => {
  it("rend lisible le refus de bornes : c'est une phrase, pas une trace", async () => {
    await expect(creerPartie(base, ouverture({ nombreDeJoueurs: "1" }))).rejects.toBeInstanceOf(
      RefusDeCreation,
    );
    await expect(creerPartie(base, ouverture({ nombreDeJoueurs: "1" }))).rejects.toThrow(
      "6 qui prend se joue de 2 à 10 joueurs, pas à 1.",
    );
  });

  it("garde pour lui ce qui ne regarde que le serveur", async () => {
    // « Aucun joueur 404 au roster » vient d'un envoi forgé : le dire à
    // l'écran n'aide personne et raconte la base.
    await expect(
      creerPartie(base, ouverture({ identite: { mode: "roster", joueurId: 404 } })),
    ).rejects.not.toBeInstanceOf(RefusDeCreation);
  });
});

describe("la frontière Zod", () => {
  it("refuse un identifiant de jeu hors catalogue", async () => {
    await expect(creerPartie(base, ouverture({ jeuId: "belote" }))).rejects.toThrow();
  });

  it("refuse un nombre de joueurs qui n'est pas un entier", async () => {
    await expect(creerPartie(base, ouverture({ nombreDeJoueurs: "quatre" }))).rejects.toThrow();
    await expect(creerPartie(base, ouverture({ nombreDeJoueurs: "3.5" }))).rejects.toThrow();
  });

  it("refuse un nom vide", async () => {
    await expect(
      creerPartie(base, ouverture({ identite: { mode: "nouveau", nom: "   " } })),
    ).rejects.toThrow();
  });

  it("refuse un champ que le formulaire n'a pas à envoyer", async () => {
    await expect(creerPartie(base, ouverture({ regles: "{}" }))).rejects.toThrow();
  });
});
