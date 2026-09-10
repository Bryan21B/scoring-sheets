import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { eq } from "drizzle-orm";
import type { Base } from "@/db/base";
import { appareil, joueur, manche } from "@/db/schema";
import { creerIdAppareil } from "@/lib/appareil/cookie";
import { creerPartie } from "@/lib/partie/creation";
import { lirePartieParCode } from "@/lib/partie/lecture";
import {
  ajouterParticipant,
  lireSalleDAttente,
  RefusDArrivee,
  rejoindrePartie,
  retirerParticipant,
} from "@/lib/partie/salle-attente";
import { type BaseDeTest, creerBaseDeTest } from "../helpers/base-de-test";

let baseDeTest: BaseDeTest;
let base: Base;

/** Ce qu'une partie ouverte laisse derrière elle, et qui sert à tout ici. */
type PartieOuverte = { partieId: number; code: string; joueurId: number };

/** Ouvre une partie d'Uno tenue par `nom`, depuis l'appareil donné. */
async function ouvrirUnePartie(nom: string, idAppareil: string): Promise<PartieOuverte> {
  const resultat = await creerPartie(base, {
    idAppareil,
    jeuId: "uno",
    nombreDeJoueurs: "3",
    finValeur: "500",
    identite: { mode: "nouveau", nom },
  });

  if (resultat.statut !== "creee") {
    throw new Error(`Création attendue, reçu « ${resultat.statut} ».`);
  }

  return { partieId: resultat.partieId, code: resultat.code, joueurId: resultat.joueurId };
}

/** La première manche : c'est elle, et rien d'autre, qui gèle la liste. */
async function saisirUneManche(partieId: number): Promise<void> {
  await base.insert(manche).values({ partieId, numero: 1 });
}

/**
 * Le geste qui **dégèle** : supprimer la manche 1.
 *
 * C'est le détour assumé quand on réalise après coup que Paul n'a jamais été
 * ajouté, et c'est lui qui met le gel à l'épreuve : rien ne le stocke, donc
 * rien n'a à être remis à zéro ici.
 */
async function supprimerLesManches(partieId: number): Promise<void> {
  await base.delete(manche).where(eq(manche.partieId, partieId));
}

/**
 * La tablée telle que l'écran la montre, dans l'ordre d'inscription.
 *
 * Relue par la lecture publique et non par un `select` sur `participant` : ce
 * qui compte est ce qu'on voit, pas ce que la table porte — un participant
 * retiré garde sa ligne et doit malgré tout disparaître d'ici.
 */
async function nomsDesParticipants(code: string): Promise<string[]> {
  const vue = await lirePartieParCode(base, code);

  return (vue?.participants ?? []).map((joueur) => joueur.nom);
}

beforeEach(() => {
  baseDeTest = creerBaseDeTest();
  base = baseDeTest.base;
});

afterEach(() => {
  baseDeTest.fermer();
});

describe("ce que la salle d'attente sait de celui qui arrive", () => {
  it("reconnaît un participant à son appareil", async () => {
    const appareilDeMarie = creerIdAppareil();
    const partie = await ouvrirUnePartie("Marie", appareilDeMarie);

    const salle = await lireSalleDAttente(base, partie.partieId, appareilDeMarie);

    expect(salle.arrivee).toEqual({
      statut: "participant",
      joueur: { id: partie.joueurId, nom: "Marie" },
    });
  });

  it("propose son nom à un appareil lié à quelqu'un qui n'est pas de la partie", async () => {
    const appareilDePaul = creerIdAppareil();
    const chezPaul = await ouvrirUnePartie("Paul", appareilDePaul);
    const chezMarie = await ouvrirUnePartie("Marie", creerIdAppareil());

    const salle = await lireSalleDAttente(base, chezMarie.partieId, appareilDePaul);

    expect(salle.arrivee).toEqual({
      statut: "propose",
      joueur: { id: chezPaul.joueurId, nom: "Paul" },
    });
  });

  it("ne propose rien à un appareil que personne n'a encore réclamé", async () => {
    const partie = await ouvrirUnePartie("Marie", creerIdAppareil());

    const salle = await lireSalleDAttente(base, partie.partieId, creerIdAppareil());

    expect(salle.arrivee).toEqual({ statut: "inconnu" });
  });
});

describe("le gel de la liste", () => {
  it("laisse la salle ouverte tant qu'aucune manche n'existe", async () => {
    const partie = await ouvrirUnePartie("Marie", creerIdAppareil());

    expect((await lireSalleDAttente(base, partie.partieId, creerIdAppareil())).gelee).toBe(false);
  });

  it("se déduit de la première manche, sans colonne d'état", async () => {
    const partie = await ouvrirUnePartie("Marie", creerIdAppareil());

    await saisirUneManche(partie.partieId);

    expect((await lireSalleDAttente(base, partie.partieId, creerIdAppareil())).gelee).toBe(true);
  });

  it("ne gèle pas la partie d'à côté", async () => {
    const chezMarie = await ouvrirUnePartie("Marie", creerIdAppareil());
    const chezPaul = await ouvrirUnePartie("Paul", creerIdAppareil());

    await saisirUneManche(chezMarie.partieId);

    expect((await lireSalleDAttente(base, chezPaul.partieId, creerIdAppareil())).gelee).toBe(false);
  });

  it("se défait quand la manche 1 disparaît, parce que rien ne le stocke", async () => {
    // Le test qui distingue le gel déduit d'une colonne d'état : une colonne
    // resterait à « gelée » après la suppression, et le détour ne rouvrirait
    // plus rien.
    const chezMarie = await ouvrirUnePartie("Marie", creerIdAppareil());

    await saisirUneManche(chezMarie.partieId);
    await supprimerLesManches(chezMarie.partieId);

    expect((await lireSalleDAttente(base, chezMarie.partieId, creerIdAppareil())).gelee).toBe(
      false,
    );
  });

  it("rend le détour praticable : supprimer la manche 1, ajouter Paul", async () => {
    // Le prix assumé de l'interdiction de rejoindre en cours de partie. S'il
    // ne se paie pas, l'interdiction n'a plus de porte de sortie.
    const chezMarie = await ouvrirUnePartie("Marie", creerIdAppareil());

    await saisirUneManche(chezMarie.partieId);
    await supprimerLesManches(chezMarie.partieId);
    const resultat = await rejoindrePartie(base, chezMarie.partieId, {
      idAppareil: creerIdAppareil(),
      identite: { mode: "nouveau", nom: "Paul" },
    });

    expect(resultat.statut).toBe("rejoint");
    expect(await nomsDesParticipants(chezMarie.code)).toEqual(["Marie", "Paul"]);
  });
});

describe("se choisir dans la salle d'attente", () => {
  it("fait d'un joueur du roster un participant", async () => {
    const chezPaul = await ouvrirUnePartie("Paul", creerIdAppareil());
    const chezMarie = await ouvrirUnePartie("Marie", creerIdAppareil());

    const resultat = await rejoindrePartie(base, chezMarie.partieId, {
      idAppareil: creerIdAppareil(),
      identite: { mode: "roster", joueurId: String(chezPaul.joueurId) },
    });

    expect(resultat).toEqual({ statut: "rejoint", joueurId: chezPaul.joueurId });
    expect(await nomsDesParticipants(chezMarie.code)).toEqual(["Marie", "Paul"]);
  });

  it("fait d'un nom neuf un joueur du roster et un participant", async () => {
    const chezMarie = await ouvrirUnePartie("Marie", creerIdAppareil());

    await rejoindrePartie(base, chezMarie.partieId, {
      idAppareil: creerIdAppareil(),
      identite: { mode: "nouveau", nom: "Zoé" },
    });

    expect(await nomsDesParticipants(chezMarie.code)).toEqual(["Marie", "Zoé"]);
    expect(await base.select().from(joueur)).toHaveLength(2);
  });

  it("lie l'appareil au joueur choisi, globalement et pour de bon", async () => {
    const chezMarie = await ouvrirUnePartie("Marie", creerIdAppareil());
    const telephoneDeZoe = creerIdAppareil();

    const resultat = await rejoindrePartie(base, chezMarie.partieId, {
      idAppareil: telephoneDeZoe,
      identite: { mode: "nouveau", nom: "Zoé" },
    });

    const [lien] = await base.select().from(appareil).where(eq(appareil.id, telephoneDeZoe));

    expect(lien?.joueurId).toBe(resultat.statut === "rejoint" ? resultat.joueurId : -1);
  });

  it("demande de trancher quand le nom tapé existe déjà, et n'écrit rien", async () => {
    const chezMarie = await ouvrirUnePartie("Marie", creerIdAppareil());

    const resultat = await rejoindrePartie(base, chezMarie.partieId, {
      idAppareil: creerIdAppareil(),
      identite: { mode: "nouveau", nom: "marie" },
    });

    expect(resultat.statut).toBe("desambiguiser");
    expect(await base.select().from(joueur)).toHaveLength(1);
    expect(await nomsDesParticipants(chezMarie.code)).toEqual(["Marie"]);
  });

  it("réclamer sa place n'ajoute personne à la liste", async () => {
    // La tablette de Marie ouvre le lien : Marie est déjà là, il n'y a qu'un
    // appareil de plus à faire pointer vers elle.
    const chezMarie = await ouvrirUnePartie("Marie", creerIdAppareil());
    const tabletteDeMarie = creerIdAppareil();

    const resultat = await rejoindrePartie(base, chezMarie.partieId, {
      idAppareil: tabletteDeMarie,
      identite: { mode: "roster", joueurId: String(chezMarie.joueurId) },
    });

    expect(resultat).toEqual({ statut: "reclame", joueurId: chezMarie.joueurId });
    expect(await nomsDesParticipants(chezMarie.code)).toEqual(["Marie"]);
    expect(
      (await lireSalleDAttente(base, chezMarie.partieId, tabletteDeMarie)).arrivee.statut,
    ).toBe("participant");
  });

  it("laisse réclamer sa place même une fois la partie gelée", async () => {
    // Paul, ajouté par Marie à la création, ouvre le lien après la manche 1 :
    // sans ça, il serait spectateur de sa propre partie.
    const chezMarie = await ouvrirUnePartie("Marie", creerIdAppareil());

    await saisirUneManche(chezMarie.partieId);
    const resultat = await rejoindrePartie(base, chezMarie.partieId, {
      idAppareil: creerIdAppareil(),
      identite: { mode: "roster", joueurId: String(chezMarie.joueurId) },
    });

    expect(resultat.statut).toBe("reclame");
  });

  it("refuse de rejoindre dès qu'une manche existe", async () => {
    const chezMarie = await ouvrirUnePartie("Marie", creerIdAppareil());

    await saisirUneManche(chezMarie.partieId);

    await expect(
      rejoindrePartie(base, chezMarie.partieId, {
        idAppareil: creerIdAppareil(),
        identite: { mode: "nouveau", nom: "Zoé" },
      }),
    ).rejects.toBeInstanceOf(RefusDArrivee);
    expect(await base.select().from(joueur)).toHaveLength(1);
  });

  it("refuse un joueur du roster qui n'existe pas, sans rien en dire à l'écran", async () => {
    const chezMarie = await ouvrirUnePartie("Marie", creerIdAppareil());

    await expect(
      rejoindrePartie(base, chezMarie.partieId, {
        idAppareil: creerIdAppareil(),
        identite: { mode: "roster", joueurId: "404" },
      }),
    ).rejects.not.toBeInstanceOf(RefusDArrivee);
  });
});

describe("ajouter un joueur qui n'a pas de téléphone", () => {
  it("l'inscrit sans lui inventer d'appareil", async () => {
    // Le mode « un seul téléphone au milieu de la table » : Marie ajoute Paul,
    // qui réclamera sa place s'il ouvre le lien un jour.
    const telephoneDeMarie = creerIdAppareil();
    const chezMarie = await ouvrirUnePartie("Marie", telephoneDeMarie);

    const resultat = await ajouterParticipant(base, chezMarie.partieId, {
      idAppareil: telephoneDeMarie,
      identite: { mode: "nouveau", nom: "Paul" },
    });

    expect(resultat.statut).toBe("ajoute");
    expect(await nomsDesParticipants(chezMarie.code)).toEqual(["Marie", "Paul"]);
    expect(await base.select().from(appareil)).toHaveLength(1);
  });

  it("prend aussi bien quelqu'un que le roster porte déjà", async () => {
    const telephoneDeMarie = creerIdAppareil();
    const chezPaul = await ouvrirUnePartie("Paul", creerIdAppareil());
    const chezMarie = await ouvrirUnePartie("Marie", telephoneDeMarie);

    await ajouterParticipant(base, chezMarie.partieId, {
      idAppareil: telephoneDeMarie,
      identite: { mode: "roster", joueurId: String(chezPaul.joueurId) },
    });

    expect(await nomsDesParticipants(chezMarie.code)).toEqual(["Marie", "Paul"]);
  });

  it("ne repointe pas l'appareil de celui qui ajoute", async () => {
    // Marie ajoute Paul depuis son téléphone : le téléphone reste celui de
    // Marie, sans quoi elle saisirait la soirée sous le nom de Paul.
    const telephoneDeMarie = creerIdAppareil();
    const chezMarie = await ouvrirUnePartie("Marie", telephoneDeMarie);

    await ajouterParticipant(base, chezMarie.partieId, {
      idAppareil: telephoneDeMarie,
      identite: { mode: "nouveau", nom: "Paul" },
    });

    const [lien] = await base.select().from(appareil).where(eq(appareil.id, telephoneDeMarie));

    expect(lien?.joueurId).toBe(chezMarie.joueurId);
  });

  it("demande de trancher sur un homonyme, sans rien écrire", async () => {
    const telephoneDeMarie = creerIdAppareil();
    const chezMarie = await ouvrirUnePartie("Marie", telephoneDeMarie);

    const resultat = await ajouterParticipant(base, chezMarie.partieId, {
      idAppareil: telephoneDeMarie,
      identite: { mode: "nouveau", nom: "Marie" },
    });

    expect(resultat.statut).toBe("desambiguiser");
    expect(await base.select().from(joueur)).toHaveLength(1);
  });

  it("ne double pas quelqu'un qui est déjà de la partie", async () => {
    const telephoneDeMarie = creerIdAppareil();
    const chezMarie = await ouvrirUnePartie("Marie", telephoneDeMarie);

    const resultat = await ajouterParticipant(base, chezMarie.partieId, {
      idAppareil: telephoneDeMarie,
      identite: { mode: "roster", joueurId: String(chezMarie.joueurId) },
    });

    expect(resultat).toEqual({ statut: "dejaLa", joueurId: chezMarie.joueurId });
    expect(await nomsDesParticipants(chezMarie.code)).toEqual(["Marie"]);
  });

  it("refuse à qui n'est pas de la partie : le code donne la lecture, pas l'écriture", async () => {
    const chezMarie = await ouvrirUnePartie("Marie", creerIdAppareil());

    await expect(
      ajouterParticipant(base, chezMarie.partieId, {
        idAppareil: creerIdAppareil(),
        identite: { mode: "nouveau", nom: "Paul" },
      }),
    ).rejects.toBeInstanceOf(RefusDArrivee);
    expect(await nomsDesParticipants(chezMarie.code)).toEqual(["Marie"]);
  });

  it("refuse dès qu'une manche existe", async () => {
    const telephoneDeMarie = creerIdAppareil();
    const chezMarie = await ouvrirUnePartie("Marie", telephoneDeMarie);

    await saisirUneManche(chezMarie.partieId);

    await expect(
      ajouterParticipant(base, chezMarie.partieId, {
        idAppareil: telephoneDeMarie,
        identite: { mode: "nouveau", nom: "Paul" },
      }),
    ).rejects.toBeInstanceOf(RefusDArrivee);
    expect(await base.select().from(joueur)).toHaveLength(1);
  });
});

describe("se retirer de la salle d'attente", () => {
  /** Marie ouvre, Zoé rejoint depuis son téléphone. */
  async function marieEtZoe(): Promise<{
    partie: PartieOuverte;
    telephoneDeMarie: string;
    telephoneDeZoe: string;
    zoeId: number;
  }> {
    const telephoneDeMarie = creerIdAppareil();
    const telephoneDeZoe = creerIdAppareil();
    const partie = await ouvrirUnePartie("Marie", telephoneDeMarie);
    const arrivee = await rejoindrePartie(base, partie.partieId, {
      idAppareil: telephoneDeZoe,
      identite: { mode: "nouveau", nom: "Zoé" },
    });

    if (arrivee.statut !== "rejoint") {
      throw new Error("Arrivée attendue.");
    }

    return { partie, telephoneDeMarie, telephoneDeZoe, zoeId: arrivee.joueurId };
  }

  it("laisse un participant s'en aller lui-même", async () => {
    const { partie, telephoneDeZoe, zoeId } = await marieEtZoe();

    await retirerParticipant(base, partie.partieId, {
      idAppareil: telephoneDeZoe,
      joueurId: String(zoeId),
    });

    expect(await nomsDesParticipants(partie.code)).toEqual(["Marie"]);
  });

  it("laisse retirer celui qui n'a pas de téléphone pour le faire", async () => {
    const telephoneDeMarie = creerIdAppareil();
    const chezMarie = await ouvrirUnePartie("Marie", telephoneDeMarie);
    const ajout = await ajouterParticipant(base, chezMarie.partieId, {
      idAppareil: telephoneDeMarie,
      identite: { mode: "nouveau", nom: "Paul" },
    });

    await retirerParticipant(base, chezMarie.partieId, {
      idAppareil: telephoneDeMarie,
      joueurId: String(ajout.statut === "ajoute" ? ajout.joueurId : -1),
    });

    expect(await nomsDesParticipants(chezMarie.code)).toEqual(["Marie"]);
  });

  it("rend l'appareil du retiré à l'état « peut rejoindre »", async () => {
    const { partie, telephoneDeZoe, zoeId } = await marieEtZoe();

    await retirerParticipant(base, partie.partieId, {
      idAppareil: telephoneDeZoe,
      joueurId: String(zoeId),
    });

    expect((await lireSalleDAttente(base, partie.partieId, telephoneDeZoe)).arrivee).toEqual({
      statut: "propose",
      joueur: { id: zoeId, nom: "Zoé" },
    });
  });

  it("sans effacer le lien global de cet appareil vers son joueur", async () => {
    // Le lien appareil → joueur est global : partir d'une partie n'est pas
    // cesser d'être Zoé, sinon il faudrait se rechoisir à la partie suivante.
    const { partie, telephoneDeZoe, zoeId } = await marieEtZoe();

    await retirerParticipant(base, partie.partieId, {
      idAppareil: telephoneDeZoe,
      joueurId: String(zoeId),
    });

    const [lien] = await base.select().from(appareil).where(eq(appareil.id, telephoneDeZoe));

    expect(lien?.joueurId).toBe(zoeId);
  });

  it("laisse revenir celui qui était parti, sur la même ligne", async () => {
    const { partie, telephoneDeZoe, zoeId } = await marieEtZoe();

    await retirerParticipant(base, partie.partieId, {
      idAppareil: telephoneDeZoe,
      joueurId: String(zoeId),
    });
    await rejoindrePartie(base, partie.partieId, {
      idAppareil: telephoneDeZoe,
      identite: { mode: "roster", joueurId: String(zoeId) },
    });

    expect(await nomsDesParticipants(partie.code)).toEqual(["Marie", "Zoé"]);
  });

  it("refuse de retirer dès qu'une manche existe", async () => {
    const { partie, telephoneDeZoe, zoeId } = await marieEtZoe();

    await saisirUneManche(partie.partieId);

    await expect(
      retirerParticipant(base, partie.partieId, {
        idAppareil: telephoneDeZoe,
        joueurId: String(zoeId),
      }),
    ).rejects.toBeInstanceOf(RefusDArrivee);
    expect(await nomsDesParticipants(partie.code)).toEqual(["Marie", "Zoé"]);
  });

  it("refuse à qui n'est pas de la partie", async () => {
    const { partie, zoeId } = await marieEtZoe();

    await expect(
      retirerParticipant(base, partie.partieId, {
        idAppareil: creerIdAppareil(),
        joueurId: String(zoeId),
      }),
    ).rejects.toBeInstanceOf(RefusDArrivee);
    expect(await nomsDesParticipants(partie.code)).toEqual(["Marie", "Zoé"]);
  });
});

describe("la proposition est armée, elle n'est pas inscrite", () => {
  it("lire la salle d'attente n'inscrit personne", async () => {
    // C'est exactement ce qui rend le spectateur possible : on reconnaît
    // l'appareil, on propose son nom, et rien ne bouge tant qu'on n'appuie pas.
    const telephoneDePaul = creerIdAppareil();
    await ouvrirUnePartie("Paul", telephoneDePaul);
    const chezMarie = await ouvrirUnePartie("Marie", creerIdAppareil());

    const salle = await lireSalleDAttente(base, chezMarie.partieId, telephoneDePaul);

    expect(salle.arrivee.statut).toBe("propose");
    expect(await nomsDesParticipants(chezMarie.code)).toEqual(["Marie"]);
  });

  it("et ne repointe pas non plus l'appareil qu'elle reconnaît", async () => {
    const telephoneDePaul = creerIdAppareil();
    const chezPaul = await ouvrirUnePartie("Paul", telephoneDePaul);
    const chezMarie = await ouvrirUnePartie("Marie", creerIdAppareil());

    await lireSalleDAttente(base, chezMarie.partieId, telephoneDePaul);

    const [lien] = await base.select().from(appareil).where(eq(appareil.id, telephoneDePaul));

    expect(lien?.joueurId).toBe(chezPaul.joueurId);
  });
});

describe("une page ne pose pas de cookie : elle lit celui qui est là", () => {
  it("ne propose rien quand la requête n'a aucun appareil", async () => {
    // Le cookie est posé par le proxy, jamais par la page — Next refuse
    // d'écrire un cookie hors action. La lecture doit donc tolérer son absence
    // plutôt que d'exiger qu'on l'ait posé juste avant.
    const partie = await ouvrirUnePartie("Marie", creerIdAppareil());

    expect((await lireSalleDAttente(base, partie.partieId, undefined)).arrivee).toEqual({
      statut: "inconnu",
    });
  });
});
