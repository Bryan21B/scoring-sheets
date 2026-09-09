import { z } from "zod";
import { finSchema, reglesSchema } from "@/lib/jeux/regles";

/**
 * Une entrée du catalogue : une identité, une présentation, et des règles.
 *
 * `finSelonJoueurs` n'existe **qu'ici** — c'est toute la raison d'avoir deux
 * schémas plutôt qu'un. Il est appliqué au moment où les règles se résolvent,
 * si bien que le moteur ne peut pas le voir : sa signature ne reçoit que
 * `Regles`, et rien qui dépende encore du nombre de joueurs.
 *
 * Ce schéma est la **source** de `EntreeCatalogue`. Le catalogue lui-même n'est
 * pas parsé à la déclaration : c'est du code, le compilateur le garde. Ce qui
 * se valide, c'est l'instantané relu depuis la base (`parseRegles`).
 */
export const entreeCatalogueSchema = z.strictObject({
  /** Jamais supprimé, jamais renommé : une partie n'en garde que ça. */
  id: z.string().min(1),
  nom: z.string().min(1),
  /** Le lien entre deux entrées qui sont le même jeu à une variante près.
   * Déclaré ici, interprété par le palmarès — sans lui, « ces deux ids-là vont
   * ensemble » s'écrirait en dur quelque part. */
  famille: z.string().min(1),
  unite: z.strictObject({ un: z.string().min(1), plusieurs: z.string().min(1) }),
  rulesUrl: z.url().nullable(),
  rulesDigestPath: z.string().min(1).nullable(),
  regles: reglesSchema.extend({
    /** Le jeu change de condition de fin à certains effectifs — Dnup à deux
     * joueurs se joue sans jetons, en manches gagnées. La clé est le nombre de
     * joueurs exact ; les effectifs absents gardent `fin`. */
    finSelonJoueurs: z.record(z.coerce.number().int().positive(), finSchema).optional(),
  }),
});

/** Une entrée du catalogue, telle qu'elle est déclarée en constante. */
export type EntreeCatalogue = z.infer<typeof entreeCatalogueSchema>;

const SIX_QUI_PREND = {
  id: "6-qui-prend",
  nom: "6 qui prend",
  famille: "6-qui-prend",
  unite: { un: "tête de bœuf", plusieurs: "têtes de bœuf" },
  rulesUrl: "https://www.gigamic.com/plus-de-cinq-joueurs/517-six-qui-surprend-3421272418824.html",
  rulesDigestPath: "docs/regles/6-qui-prend.md",
  regles: {
    classement: { direction: "bas" },
    // 200 est un garde-fou anti-doigt-gras : large pour ne jamais refuser une
    // manche vraie, serré pour arrêter un ordre de grandeur de trop.
    saisie: { mode: "entierParJoueur", min: 0, max: 200 },
    fin: { type: "seuil", valeur: 66 },
    joueursMin: 2,
    joueursMax: 10,
  },
} as const satisfies EntreeCatalogue;

/**
 * La variante se déclare **par spread** du jeu de base : l'héritage est déjà
 * dans le langage, et un `parentId` en configuration ajouterait une résolution
 * à faire et une boucle possible.
 *
 * Le spread hérite aussi de ce qui ne se transmet pas : le livret 03-2019
 * n'imprime « pour 2 à 8 joueurs » que sur la variante, d'où le `joueursMax`
 * redéclaré. Les deux entrées partagent leur `rulesUrl` — la variante est une
 * section du même livret, pas un produit — donc seul `rulesDigestPath` les
 * distingue côté règles écrites.
 */
const SIX_QUI_PREND_CARTES_SPECIALES = {
  ...SIX_QUI_PREND,
  id: "6-qui-prend-cartes-speciales",
  nom: "6 qui prend — cartes spéciales",
  rulesDigestPath: "docs/regles/6-qui-prend-cartes-speciales.md",
  regles: {
    ...SIX_QUI_PREND.regles,
    fin: { type: "manchesFixes", valeur: 2 },
    joueursMax: 8,
  },
} as const satisfies EntreeCatalogue;

const UNO = {
  id: "uno",
  nom: "Uno",
  famille: "uno",
  unite: { un: "point", plusieurs: "points" },
  rulesUrl: "https://service.mattel.com/instruction_sheets/GDJ85-FR.pdf",
  rulesDigestPath: "docs/regles/uno.md",
  regles: {
    classement: { direction: "haut" },
    // Une manche s'y saisit en deux gestes — le gagnant, puis le total des
    // cartes restantes de tous les autres — jamais en une valeur par perdant.
    // La borne haute porte donc sur un total, d'où 999 et non 500.
    saisie: { mode: "sommeAuGagnant", min: 0, max: 999 },
    fin: { type: "seuil", valeur: 500 },
    joueursMin: 2,
    joueursMax: 10,
  },
} as const satisfies EntreeCatalogue;

const DNUP = {
  id: "dnup",
  nom: "Dnup",
  famille: "dnup",
  unite: { un: "jeton", plusieurs: "jetons" },
  rulesUrl: "https://www.dnup.game/fr/",
  rulesDigestPath: "docs/regles/dnup.md",
  regles: {
    classement: { direction: "haut" },
    // Une saisie Dnup désigne deux personnes et ne porte aucun nombre : le
    // deuxième sorti arrête la manche, il n'y a ni troisième ni dernier.
    saisie: { mode: "podium", jetons: [2, 1] },
    fin: { type: "seuil", valeur: 4 },
    joueursMin: 2,
    joueursMax: 5,
    // À deux joueurs, Dnup est une autre variante : pas de jetons du tout, la
    // partie se gagne à deux manches.
    finSelonJoueurs: { 2: { type: "manchesGagnees", valeur: 2 } },
  },
} as const satisfies EntreeCatalogue;

/**
 * Les quatre entrées jouables, indexées par leur id.
 *
 * Une constante TypeScript, jamais une table : ajouter un jeu ou ajuster un
 * barème ne coûte alors aucune migration. Le prix assumé est que `partie.jeuId`
 * n'a aucune intégrité référentielle en base — c'est `jeuIdSchema` qui la tient,
 * à l'écriture.
 */
export const CATALOGUE = {
  [SIX_QUI_PREND.id]: SIX_QUI_PREND,
  [SIX_QUI_PREND_CARTES_SPECIALES.id]: SIX_QUI_PREND_CARTES_SPECIALES,
  [UNO.id]: UNO,
  [DNUP.id]: DNUP,
} as const satisfies Record<string, EntreeCatalogue>;

/** L'id d'une entrée du catalogue. Il ne se supprime ni ne se renomme jamais. */
export type JeuId = keyof typeof CATALOGUE;

/**
 * Valide un `jeuId` venu de l'extérieur — formulaire de création, ligne relue
 * en base — contre les ids réellement déclarés.
 *
 * Les options se dérivent du catalogue plutôt que de se recopier : une liste
 * recopiée dérive de son original le jour où l'une des deux est corrigée seule.
 */
export const jeuIdSchema = z.enum(Object.keys(CATALOGUE) as [JeuId, ...JeuId[]]);

/**
 * L'entrée derrière un id, pour tout ce qui est présentation.
 *
 * Total par construction : `JeuId` ne peut nommer qu'une entrée déclarée, et
 * c'est `jeuIdSchema` qui fait passer une chaîne quelconque dans ce type.
 */
export function trouverEntree(id: JeuId): EntreeCatalogue {
  return CATALOGUE[id];
}
