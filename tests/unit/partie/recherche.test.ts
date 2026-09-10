import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { eq } from "drizzle-orm";
import type { Base } from "@/db/base";
import { partie } from "@/db/schema";
import { creerIdAppareil } from "@/lib/appareil/cookie";
import { creerPartie } from "@/lib/partie/creation";
import { creerLimiteur, type Limiteur } from "@/lib/partie/limite-de-debit";
import { chercherPartieParCode } from "@/lib/partie/recherche";
import { type BaseDeTest, creerBaseDeTest } from "../helpers/base-de-test";

let baseDeTest: BaseDeTest;
let base: Base;
let limiteur: Limiteur;

/** Ouvre une partie d'Uno tenue par un nom donné, et rend son code. */
async function ouvrirUnePartie(nom: string): Promise<string> {
  const resultat = await creerPartie(base, {
    idAppareil: creerIdAppareil(),
    jeuId: "uno",
    nombreDeJoueurs: "3",
    finValeur: "500",
    identite: { mode: "nouveau", nom },
  });

  if (resultat.statut !== "creee") {
    throw new Error("Création attendue.");
  }

  return resultat.code;
}

/** Une recherche depuis un même téléphone, à un instant donné. */
function chercher(code: string, maintenant = 0) {
  return chercherPartieParCode(base, limiteur, { code, cle: "le-telephone", maintenant });
}

beforeEach(() => {
  baseDeTest = creerBaseDeTest();
  base = baseDeTest.base;
  limiteur = creerLimiteur({ echecs: 3, fenetreMs: 60_000 });
});

afterEach(() => {
  baseDeTest.fermer();
});

describe("chercher une partie par son code", () => {
  it("rend la partie que ce code désigne", async () => {
    const code = await ouvrirUnePartie("Marie");

    const trouvee = await chercher(code);

    expect(trouvee.statut).toBe("trouvee");
    expect(trouvee.statut === "trouvee" ? trouvee.partie.code : null).toBe(code);
  });

  it("mène le code retapé à la partie du lien", async () => {
    const code = await ouvrirUnePartie("Marie");
    const dicte = `${code.slice(0, 3).toLowerCase()}-${code.slice(3)}`;

    const parLeLien = await chercher(code);
    const aLaMain = await chercher(dicte);

    expect(aLaMain).toEqual(parLeLien);
  });

  it("ne rend rien pour un code inconnu, jamais la partie d'à côté", async () => {
    await ouvrirUnePartie("Marie");
    await ouvrirUnePartie("Paul");

    expect((await chercher("ZZZZZZ")).statut).toBe("inconnue");
  });

  it("traite un code malformé comme un code inconnu", async () => {
    expect((await chercher("pas un code")).statut).toBe("inconnue");
  });

  it("ferme la recherche quand les codes inconnus s'enchaînent", async () => {
    for (const essai of ["ZZZZZZ", "ZZZZZY", "ZZZZZX"]) {
      expect((await chercher(essai)).statut).toBe("inconnue");
    }

    expect((await chercher("ZZZZZW")).statut).toBe("tropDeTentatives");
  });

  it("fermée, elle ne rend pas non plus la partie dont on a le bon code", async () => {
    // Sinon la limite se contourne en glissant le bon code entre deux tirages.
    const code = await ouvrirUnePartie("Marie");

    for (const essai of ["ZZZZZZ", "ZZZZZY", "ZZZZZX"]) {
      await chercher(essai);
    }

    expect((await chercher(code)).statut).toBe("tropDeTentatives");
  });

  it("ne compte que les échecs : relire sa propre partie n'use rien", async () => {
    // La table relit la même partie tout au long de la soirée ; elle ne
    // tâtonne pas, et la limite n'a rien à lui dire.
    const code = await ouvrirUnePartie("Marie");

    for (let relecture = 0; relecture < 20; relecture += 1) {
      expect((await chercher(code)).statut).toBe("trouvee");
    }
  });

  it("rend la recherche à la fenêtre suivante", async () => {
    for (const essai of ["ZZZZZZ", "ZZZZZY", "ZZZZZX"]) {
      await chercher(essai);
    }

    expect((await chercher("ZZZZZW", 60_001)).statut).toBe("inconnue");
  });
});

describe("ce que la recherche rend de la partie", () => {
  it("désigne bien celle-là, et pas une autre ligne du même code", async () => {
    // Le code n'est pas la clé primaire : la page écrit sur `id`, et c'est
    // cette égalité qui dit que les deux désignent la même partie.
    await ouvrirUnePartie("Paul");
    const code = await ouvrirUnePartie("Marie");
    const trouvee = await chercher(code);

    const [ligne] = await base.select().from(partie).where(eq(partie.code, code));

    expect(trouvee.statut === "trouvee" ? trouvee.partie.id : -1).toBe(ligne?.id ?? -2);
  });
});
