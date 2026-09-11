import { z } from "zod";
import type { Ecriture } from "@/db/base";
import { journal } from "@/db/schema";
import { idAppareilSchema } from "@/lib/appareil/cookie";

/**
 * Qui a fait le geste : le **joueur figé à l'écriture**, et l'appareil à côté.
 *
 * Le joueur est gravé et jamais résolu à la lecture — le lien appareil vers
 * joueur se repointe vers l'avant, et le relire réécrirait tout l'historique
 * des lignes de ce téléphone. L'appareil est gardé **en plus** parce que le
 * joueur seul ne distingue pas deux téléphones qui se déclarent la même
 * personne, et que c'est précisément l'anomalie pour laquelle le tiroir existe.
 *
 * Le schéma vit ici et non dans les modules qui écrivent : « qui agit » est une
 * notion du journal, et l'y laisser garde une seule forme à corriger.
 */
export const agissantSchema = z.strictObject({
  joueurId: z.coerce.number().int().positive(),
  /** Nullable comme la colonne : un appareil peut avoir été effacé depuis. */
  appareilId: idAppareilSchema.nullable(),
});

/** L'auteur d'une ligne de journal, validé. */
export type Agissant = z.infer<typeof agissantSchema>;

/**
 * Ce qu'une ligne `saisie` garde en plus des colonnes : la valeur posée.
 *
 * Le schéma est la **source** du type — la charge utile ne s'écrit pas deux
 * fois — et il est devenu une vraie frontière le jour où le tiroir a relu ce
 * JSON depuis la base : `src/lib/journal/lecture.ts` le repasse à la lecture,
 * parce qu'une colonne `TEXT` ne promet rien de ce qu'on y a mis.
 */
export const detailDeSaisieSchema = z.strictObject({
  /**
   * Nullable comme la colonne qu'elle enregistre : la **désignation** d'Uno
   * pose le vide, et c'est un geste — la case du sorti existe désormais, son
   * total reste à taper.
   */
  valeur: z.number().int().nonnegative().nullable(),
});

/** Ce qu'une ligne `correction` garde : d'où l'on venait, et où l'on va. */
export const detailDeCorrectionSchema = z.strictObject({
  ancienne: z.number().int().nonnegative().nullable(),
  nouvelle: z.number().int().nonnegative().nullable(),
});

/**
 * Un geste **sur une case**, et la charge utile que son discriminant impose.
 *
 * Union discriminée plutôt que deux champs optionnels : une correction sans
 * ancienne valeur ne se représente pas, et c'est la seule chose qu'on serait
 * venu lire dans le tiroir.
 */
export type GesteDeCase =
  | { geste: "saisie"; detail: z.infer<typeof detailDeSaisieSchema> }
  | { geste: "correction"; detail: z.infer<typeof detailDeCorrectionSchema> };

/** Une ligne à consigner : la case que le geste touche, et son auteur. */
export type LigneDeCase = GesteDeCase & {
  partieId: number;
  /** Un entier nu, sans clé étrangère : un numéro de manche ne se réutilise pas. */
  mancheNumero: number;
  joueurConcerneId: number;
  agissant: Agissant;
};

/**
 * Écrit une ligne, **dans la transaction de la mutation qu'elle enregistre**.
 *
 * Prend `Ecriture` et non `Base`, et ce n'est pas une commodité : c'est le type
 * qui interdit d'appeler cette fonction hors d'une transaction. Un journal qui
 * peut rater des lignes en silence est pire que pas de journal — on lui fait
 * confiance sans qu'il l'ait mérité, et il ne sert que le jour où on le
 * consulte pour trancher. Son échec doit donc faire échouer la mutation.
 *
 * L'horodatage est celui du **serveur** : l'horloge d'un téléphone à table se
 * règle à la main, et deux lignes prises sur deux téléphones ne s'ordonneraient
 * plus entre elles.
 */
export async function consignerUnGesteDeCase(tx: Ecriture, ligne: LigneDeCase): Promise<void> {
  await tx.insert(journal).values({
    partieId: ligne.partieId,
    geste: ligne.geste,
    joueurAgissantId: ligne.agissant.joueurId,
    appareilId: ligne.agissant.appareilId,
    mancheNumero: ligne.mancheNumero,
    joueurConcerneId: ligne.joueurConcerneId,
    detail: JSON.stringify(ligne.detail),
    ecritLe: new Date(),
  });
}

/**
 * Un geste qui porte sur **la partie entière**, et sur aucune case.
 *
 * Les deux seuls qui changent ce que les autres ont le **droit** de faire, et
 * c'est exactement ce qu'on vient lire dans un journal : sans eux, il montrerait
 * une partie qui recommence à bouger sans dire pourquoi elle avait cessé, ni qui
 * l'a rouverte. Ils entrent donc en paire, ou pas du tout.
 */
export type GesteDePartie = "abandon" | "reprise";

/** Une ligne qui n'a ni manche, ni joueur concerné, ni charge utile. */
export type LigneDePartie = {
  partieId: number;
  geste: GesteDePartie;
  agissant: Agissant;
};

/**
 * Écrit une ligne sans case, **dans la transaction du geste qu'elle enregistre**.
 *
 * Séparée de {@link consignerUnGesteDeCase} plutôt que pliée dedans avec trois
 * champs optionnels : la case est ce qui définit l'autre — sa manche, son joueur
 * concerné, sa valeur — et une ligne d'abandon n'en a aucun. Les réunir
 * obligerait chaque appelant à passer trois `null` dont le type ne dirait plus
 * qu'ils sont obligatoires ici et interdits là.
 *
 * `Ecriture` et non `Base`, pour la même raison que sa jumelle, et pour une de
 * plus : **aucun déclencheur ne porte sur `partie`**, si bien que c'est cette
 * insertion-là qui fait bouger l'estampille de version. Écrite hors de la
 * transaction de l'abandon, elle laisserait les autres téléphones devant une
 * partie close sans l'avoir appris. Voir `src/db/triggers.sql`.
 */
export async function consignerUnGesteDePartie(tx: Ecriture, ligne: LigneDePartie): Promise<void> {
  await tx.insert(journal).values({
    partieId: ligne.partieId,
    geste: ligne.geste,
    joueurAgissantId: ligne.agissant.joueurId,
    appareilId: ligne.agissant.appareilId,
    mancheNumero: null,
    joueurConcerneId: null,
    detail: null,
    ecritLe: new Date(),
  });
}
