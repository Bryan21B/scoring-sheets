import { z } from "zod";
import { formatZodIssues } from "@/lib/zod";

/**
 * Condition qui clôt une partie.
 *
 * Le franchissement se lit **toujours par le total le plus haut**, y compris à
 * 6 qui prend où l'on accumule des têtes de bœuf jusqu'à 66 et où le plus bas
 * gagne : `classement.direction` ne sert qu'à ordonner, jamais à déclencher.
 */
/**
 * Ce que vaut une fin de partie : un entier ≥ 1, et pas d'autre borne — 30 et
 * 200 sont deux soirées valides, 0 n'en est pas une.
 *
 * Exporté parce que la surcharge par partie porte sur ce même nombre : une
 * borne recopiée là-bas dériverait de celle-ci le jour où l'une est corrigée.
 */
export const finValeurSchema = z.number().int().min(1);

export const finSchema = z.discriminatedUnion("type", [
  z.strictObject({ type: z.literal("seuil"), valeur: finValeurSchema }),
  z.strictObject({ type: z.literal("manchesFixes"), valeur: finValeurSchema }),
  z.strictObject({ type: z.literal("manchesGagnees"), valeur: finValeurSchema }),
]);

/** Condition de fin d'une partie, résolue pour le nombre de joueurs de la table. */
export type Fin = z.infer<typeof finSchema>;

/**
 * Forme d'une manche, et transformation de ce qui est saisi vers ce qui est
 * marqué.
 *
 * Les `max` sont des garde-fous anti-doigt-gras, pas des règles de jeu. Le `min`
 * est littéralement `0` : aucun des trois modes ne marque de valeur négative —
 * à 6 qui prend variante, la carte « Négatif = Positif » perd son excédent
 * plutôt que de descendre sous zéro.
 *
 * `podium` n'a pas de bornes : on y désigne des joueurs, les jetons sont un
 * résultat et jamais une saisie.
 */
const bornes = { min: z.literal(0), max: z.number().int().positive() };

const saisieSchema = z.discriminatedUnion("mode", [
  z.strictObject({ mode: z.literal("entierParJoueur"), ...bornes }),
  z.strictObject({ mode: z.literal("sommeAuGagnant"), ...bornes }),
  z.strictObject({
    mode: z.literal("podium"),
    jetons: z.array(z.number().int().nonnegative()).readonly(),
  }),
]);

/**
 * Les règles **résolues** : le seul bloc que le moteur reçoit, et celui que la
 * partie fige à son ouverture.
 *
 * Ni `finSelonJoueurs` ni la présentation n'y entrent — le schéma est strict, et
 * c'est ce qui le garantit. La surcharge par nombre de joueurs est déjà
 * appliquée quand l'objet se construit ; le nom, la famille, l'unité et les
 * liens de règles se relisent du catalogue à l'affichage, ce qui laisse un id
 * de catalogue les porter pour toujours.
 *
 * Ce schéma est la **source** de `Regles` : le type s'en infère, il ne se
 * réécrit pas à côté.
 */
export const reglesSchema = z.strictObject({
  classement: z.strictObject({ direction: z.enum(["haut", "bas"]) }),
  saisie: saisieSchema,
  fin: finSchema,
  joueursMin: z.number().int().positive(),
  joueursMax: z.number().int().positive(),
});

/** Règles résolues d'une partie : ce que le moteur voit, et ce que la partie stocke. */
export type Regles = z.infer<typeof reglesSchema>;

/**
 * Relit l'instantané de règles d'une partie depuis sa colonne JSON.
 *
 * Frontière de confiance : le catalogue est du code que le compilateur garde,
 * mais l'instantané a fait un aller-retour par la base, où rien ne garantit
 * qu'il ait gardé sa forme. Une forme inconnue est refusée sèchement plutôt que
 * rabotée — des règles à moitié comprises feraient un décompte faux, pas une
 * dégradation.
 */
export function parseRegles(json: string): Regles {
  let brut: unknown;

  try {
    brut = JSON.parse(json);
  } catch (cause) {
    throw new Error("Instantané de règles illisible : le JSON ne se parse pas.", { cause });
  }

  const parsed = reglesSchema.safeParse(brut);

  if (!parsed.success) {
    throw new Error(`Instantané de règles invalide :\n${formatZodIssues(parsed.error)}`);
  }

  return parsed.data;
}
