import { describe, expect, it } from "bun:test";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { CATALOGUE, entreeCatalogueSchema, jeuIdSchema, trouverEntree } from "@/lib/jeux/catalogue";

/**
 * Les identifiants gelés, recopiés à la main et jamais dérivés du catalogue.
 *
 * Une partie ne stocke que son `jeuId` : nom, famille et unité se relisent du
 * catalogue à l'affichage. Supprimer ou renommer un id ferait donc perdre son
 * nom à une partie de l'an dernier — ce test échoue avant que ça n'arrive.
 * Ajouter une entrée est libre ; retirer une ligne d'ici ne l'est pas.
 */
const IDS_GELES = ["6-qui-prend", "6-qui-prend-cartes-speciales", "uno", "dnup"] as const;

const racineDuRepo = join(import.meta.dir, "..", "..", "..");
const entrees = Object.values(CATALOGUE);

describe("CATALOGUE", () => {
  it("ne supprime ni ne renomme jamais un identifiant", () => {
    for (const id of IDS_GELES) {
      expect(Object.keys(CATALOGUE)).toContain(id);
    }
  });

  it("déclare les quatre entrées jouables", () => {
    expect(entrees).toHaveLength(IDS_GELES.length);
  });

  it("donne à chaque entrée son identité, sa présentation, ses liens et ses règles", () => {
    // Le catalogue n'est pas validé par Zod à la déclaration — c'est du code,
    // le compilateur le garde. Le passer au schéma **ici** attrape ce que le
    // compilateur ne voit pas : un libellé vide, une URL qui n'en est pas une,
    // un `max` négatif.
    for (const entree of entrees) {
      expect(entreeCatalogueSchema.safeParse(entree).error?.issues ?? []).toEqual([]);
    }
  });

  it("classe chaque entrée sous la clé qui porte son id", () => {
    for (const [cle, entree] of Object.entries(CATALOGUE)) {
      expect(cle).toBe(entree.id);
    }
  });

  it("pointe sur un digest de règles qui existe vraiment", () => {
    // Le chemin est une constante que rien ne relie au disque : un `git mv` du
    // digest ne casserait que la page de règles, silencieusement et en prod.
    // Aucun garde-fou sur le `null` du type : les quatre entrées en déclarent
    // une, et le jour où l'une ne le fera plus, c'est `tsc` qui le dira ici.
    for (const entree of entrees) {
      expect(existsSync(join(racineDuRepo, entree.rulesDigestPath))).toBe(true);
    }
  });

  it("donne les valeurs de la spec à chaque entrée", () => {
    expect(trouverEntree("6-qui-prend").regles).toMatchObject({
      classement: { direction: "bas" },
      saisie: { mode: "entierParJoueur", min: 0, max: 200 },
      fin: { type: "seuil", valeur: 66 },
    });
    expect(trouverEntree("uno").regles).toMatchObject({
      classement: { direction: "haut" },
      saisie: { mode: "sommeAuGagnant", min: 0, max: 999 },
      fin: { type: "seuil", valeur: 500 },
      joueursMin: 2,
      joueursMax: 10,
    });
    expect(trouverEntree("dnup").regles).toMatchObject({
      classement: { direction: "haut" },
      saisie: { mode: "podium", jetons: [2, 1] },
      fin: { type: "seuil", valeur: 4 },
      joueursMin: 2,
      joueursMax: 5,
      finSelonJoueurs: { 2: { type: "manchesGagnees", valeur: 2 } },
    });
  });

  it("nomme l'unité au singulier et au pluriel", () => {
    expect(trouverEntree("6-qui-prend").unite).toEqual({
      un: "tête de bœuf",
      plusieurs: "têtes de bœuf",
    });
    expect(trouverEntree("uno").unite).toEqual({ un: "point", plusieurs: "points" });
    expect(trouverEntree("dnup").unite).toEqual({ un: "jeton", plusieurs: "jetons" });
  });
});

describe("les deux 6 qui prend", () => {
  const base = trouverEntree("6-qui-prend");
  const variante = trouverEntree("6-qui-prend-cartes-speciales");

  it("partagent leur famille", () => {
    expect(variante.famille).toBe(base.famille);
    expect(base.famille).toBe("6-qui-prend");
  });

  it("héritent par spread : la variante reprend tout ce qu'elle ne redéclare pas", () => {
    // Le spread est le mécanisme d'héritage — pas de `parentId`, donc pas de
    // résolution à faire ni de boucle possible. Ce qui suit est ce qu'il porte.
    expect(variante.unite).toEqual(base.unite);
    expect(variante.rulesUrl).toBe(base.rulesUrl);
    expect(variante.regles.classement).toEqual(base.regles.classement);
    expect(variante.regles.saisie).toEqual(base.regles.saisie);
  });

  it("se distinguent par leur fin, leur digest et leur plafond de joueurs", () => {
    expect(base.regles.fin).toEqual({ type: "seuil", valeur: 66 });
    expect(variante.regles.fin).toEqual({ type: "manchesFixes", valeur: 2 });
    expect(variante.rulesDigestPath).not.toBe(base.rulesDigestPath);
    // Le livret imprime « pour 2 à 8 joueurs » sur la seule variante : le spread
    // hérite aussi de ce qui ne se transmet pas, il faut le redéclarer.
    expect(variante.regles.joueursMax).toBe(8);
  });
});

describe("jeuIdSchema", () => {
  it("accepte les ids du catalogue et refuse le reste", () => {
    for (const id of IDS_GELES) {
      expect(jeuIdSchema.parse(id)).toBe(id);
    }

    expect(jeuIdSchema.safeParse("belote").success).toBe(false);
  });
});
