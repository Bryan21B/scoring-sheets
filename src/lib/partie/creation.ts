import { eq } from "drizzle-orm";
import { z } from "zod";
import type { Base, Ecriture } from "@/db/base";
import { appareil, joueur, participant, partie } from "@/db/schema";
import { idAppareilSchema } from "@/lib/appareil/cookie";
import { type EntreeCatalogue, jeuIdSchema, trouverEntree } from "@/lib/jeux/catalogue";
import { finValeurSchema, type Regles } from "@/lib/jeux/regles";
import { resoudreRegles } from "@/lib/jeux/resolution";
import { type CodeDePartie, genererCodeUnique } from "@/lib/partie/code";
import { identiteSchema } from "@/lib/partie/identite";
import { listerLeRoster } from "@/lib/roster/lecture";
import { evaluerNom, type Homonymie } from "@/lib/roster/noms";

/**
 * Tout ce que l'écran de la tablée envoie, et la seule porte d'entrée de la
 * création.
 *
 * Strict, et coercitif là où le HTML n'envoie que des chaînes : un champ
 * inattendu est un formulaire qui a dérivé de son action, et le refuser vaut
 * mieux que l'ignorer. `jeuIdSchema` tient ici l'intégrité que la base ne tient
 * pas : `partie.jeu_id` n'a aucune clé étrangère, le catalogue étant une
 * constante TypeScript.
 */
export const creationSchema = z.strictObject({
  idAppareil: idAppareilSchema,
  jeuId: jeuIdSchema,
  nombreDeJoueurs: z.coerce.number().int().positive(),
  finValeur: z.coerce.number().pipe(finValeurSchema),
  identite: identiteSchema,
});

/** La saisie de création, une fois validée. */
export type Creation = z.infer<typeof creationSchema>;

/**
 * Ce que la création rend.
 *
 * L'homonyme n'est pas une erreur : c'est une question posée à l'humain, et
 * elle a donc sa branche plutôt qu'une exception. Tout le reste — bornes de
 * joueurs, seuil hors bornes, entrée malformée — est un refus sec : une partie
 * ouverte sur des règles approximatives se découvre au décompte, trop tard.
 */
export type ResultatDeCreation =
  | { statut: "creee"; code: CodeDePartie; partieId: number; joueurId: number }
  | Homonymie;

/**
 * Un refus **écrit pour être lu** au-dessus du formulaire.
 *
 * Il existe pour trancher entre deux sortes d'échecs qui ne s'affichent pas
 * pareil : « 6 qui prend se joue de 2 à 10 joueurs, pas à 1 » est une phrase
 * destinée à la personne qui vient de taper ; « aucun joueur 404 au roster »
 * vient d'un envoi forgé, n'aide personne, et raconte la base. Sans ce type,
 * l'écran ne pourrait que tout montrer ou tout cacher.
 */
export class RefusDeCreation extends Error {
  override readonly name = "RefusDeCreation";
}

/** Le créateur, une fois l'identité confrontée au roster. */
type CreateurResolu =
  | { statut: "connu"; joueurId: number }
  | { statut: "aCreer"; nom: string }
  | Homonymie;

/**
 * Résout l'identité déclarée contre le roster, sans rien écrire.
 *
 * @throws si le joueur choisi dans la liste n'existe pas — le formulaire ne
 * peut proposer que des lignes lues à l'instant, donc un id absent est un envoi
 * forgé ou périmé, pas un choix. D'où une `Error` nue et non un
 * {@link RefusDeCreation} : il n'y a rien à en dire à l'écran.
 */
async function resoudreCreateur(
  base: Base,
  identite: Creation["identite"],
): Promise<CreateurResolu> {
  if (identite.mode === "roster") {
    const [connu] = await base
      .select({ id: joueur.id })
      .from(joueur)
      .where(eq(joueur.id, identite.joueurId))
      .limit(1);

    if (!connu) {
      throw new Error(`Aucun joueur ${identite.joueurId} au roster.`);
    }

    return { statut: "connu", joueurId: connu.id };
  }

  const decision = evaluerNom(identite.nom, await listerLeRoster(base));

  return decision.statut === "creer" ? { statut: "aCreer", nom: decision.nom } : decision;
}

/**
 * Fige les règles, en traduisant le refus de `resoudreRegles` en refus lisible.
 *
 * Les bornes de joueurs et la surcharge de seuil sont les deux seules choses
 * qu'une personne peut se tromper à cet écran, et `resoudreRegles` les refuse
 * déjà avec la bonne phrase — celle qui nomme le jeu et ses bornes. La
 * réécrire ici en ferait une deuxième à corriger.
 */
function figerLesRegles(entree: EntreeCatalogue, donnees: Creation): Regles {
  try {
    return resoudreRegles(entree, {
      nombreDeJoueurs: donnees.nombreDeJoueurs,
      finValeur: donnees.finValeur,
    });
  } catch (cause) {
    throw new RefusDeCreation(cause instanceof Error ? cause.message : String(cause), { cause });
  }
}

/**
 * L'id qu'un `RETURNING` vient de rendre, ou un échec sec.
 *
 * `noUncheckedIndexedAccess` oblige à traiter le cas « aucune ligne », et le
 * traiter par un `0` écrirait une clé étrangère qui ne désigne personne — la
 * contrainte la rejetterait, mais après coup et avec un message qui ne dit rien.
 * Une insertion sans id rendu est une base cassée, pas une valeur par défaut.
 */
function idRendu(lignes: readonly { id: number }[], quoi: string): number {
  const id = lignes[0]?.id;

  if (id === undefined) {
    throw new Error(`Insertion de ${quoi} sans id rendu : la base n'a pas répondu.`);
  }

  return id;
}

/**
 * Tire un code que la base ne porte pas encore.
 *
 * Prend la transaction en cours, pas la base : sinon la lecture « ce code
 * est-il libre ? » et l'insertion qui s'en sert seraient deux gestes séparés,
 * et une partie ouverte entre les deux ferait échouer l'insertion sur
 * `partie_code_unique` — une collision de 2³⁰ transformée en erreur brute.
 */
async function reserverUnCode(tx: Ecriture): Promise<CodeDePartie> {
  return genererCodeUnique(async (candidat) => {
    const [pris] = await tx
      .select({ id: partie.id })
      .from(partie)
      .where(eq(partie.code, candidat))
      .limit(1);

    return pris !== undefined;
  });
}

/**
 * Ouvre une partie, et y met celui qui l'ouvre.
 *
 * L'ordre des gestes est la garantie que « refusé » veut dire « rien n'a
 * bougé » : la validation, puis la résolution des règles — qui refuse hors des
 * bornes de joueurs — puis l'identité, et seulement ensuite la moindre
 * écriture. Les quatre lignes qui restent partent dans **une** transaction, si
 * bien qu'une partie sans participant n'existe jamais.
 *
 * L'instantané de règles est figé ici, et c'est le seul rempart contre une
 * édition rétroactive du barème : le catalogue vit dans une constante éditable
 * sans migration, et sans instantané une correction réécrirait les parties
 * passées qui nourrissent le palmarès.
 *
 * Le lien appareil → joueur est **global** : un appareil est une personne,
 * partout. La ligne se repointe donc plutôt que de se dédoubler, et le passé
 * n'est jamais relu — le journal fige le joueur agissant à l'écriture
 * précisément pour ça.
 *
 * @throws {@link RefusDeCreation} si l'effectif sort des bornes du jeu ou si le
 * seuil surchargé n'est pas un entier ≥ 1 — refus à montrer. Une `ZodError` ou
 * une `Error` nue pour tout le reste : saisie malformée, joueur inexistant,
 * base qui ne répond pas. Rien n'est écrit dans aucun de ces cas.
 */
export async function creerPartie(base: Base, saisie: unknown): Promise<ResultatDeCreation> {
  const donnees = creationSchema.parse(saisie);
  const entree = trouverEntree(donnees.jeuId);

  const regles = figerLesRegles(entree, donnees);
  const createur = await resoudreCreateur(base, donnees.identite);

  if (createur.statut === "desambiguiser") {
    return createur;
  }

  const maintenant = new Date();

  return base.transaction(async (tx) => {
    const code = await reserverUnCode(tx);
    const joueurId =
      createur.statut === "connu"
        ? createur.joueurId
        : idRendu(
            await tx
              .insert(joueur)
              .values({ nom: createur.nom, creeLe: maintenant })
              .returning({ id: joueur.id }),
            "joueur",
          );

    const partieId = idRendu(
      await tx
        .insert(partie)
        .values({
          code,
          jeuId: donnees.jeuId,
          regles: JSON.stringify(regles),
          creeLe: maintenant,
        })
        .returning({ id: partie.id }),
      "partie",
    );

    await tx.insert(participant).values({ partieId, joueurId });

    await tx
      .insert(appareil)
      .values({ id: donnees.idAppareil, joueurId, vuLe: maintenant, creeLe: maintenant })
      .onConflictDoUpdate({
        target: appareil.id,
        set: { joueurId, vuLe: maintenant },
      });

    return { statut: "creee", code, partieId, joueurId };
  });
}
