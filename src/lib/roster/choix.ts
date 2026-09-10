import { eq } from "drizzle-orm";
import type { Base, Ecriture } from "@/db/base";
import { idRendu } from "@/db/insertion";
import { joueur } from "@/db/schema";
import type { IdentiteChoisie } from "@/lib/partie/identite";
import { listerLeRoster } from "@/lib/roster/lecture";
import { evaluerNom, type Homonymie } from "@/lib/roster/noms";

/**
 * L'identité déclarée, une fois confrontée au roster et **avant** toute
 * écriture.
 *
 * Trois issues et pas deux : l'homonyme n'est pas une erreur, c'est une
 * question posée à l'humain, et elle remonte donc par la valeur de retour et
 * non par une exception.
 */
export type ChoixDeJoueur =
  | { statut: "connu"; joueurId: number }
  | { statut: "aCreer"; nom: string }
  | Homonymie;

/** Le choix une fois tranché : ce qui reste quand la question ne se pose plus. */
export type ChoixTranche = Exclude<ChoixDeJoueur, Homonymie>;

/**
 * Résout une identité déclarée contre le roster, **sans rien écrire**.
 *
 * Partagée par la création d'une partie et par l'arrivée en salle d'attente :
 * « je suis Marie » veut dire la même chose aux deux endroits, et deux lectures
 * du roster divergeraient le jour où l'une seule est corrigée.
 *
 * @throws si le joueur choisi dans la liste n'existe pas — un écran ne propose
 * que des lignes lues à l'instant, donc un id absent est un envoi forgé ou
 * périmé, pas un choix. D'où une `Error` nue : il n'y a rien à en dire à
 * l'écran, et le dire raconterait la base.
 */
export async function resoudreIdentite(
  base: Base,
  identite: IdentiteChoisie,
): Promise<ChoixDeJoueur> {
  if (identite.mode === "roster") {
    const [connu] = await base
      .select({ id: joueur.id })
      .from(joueur)
      .where(eq(joueur.id, identite.joueurId))
      .limit(1);

    if (connu === undefined) {
      throw new Error(`Aucun joueur ${identite.joueurId} au roster.`);
    }

    return { statut: "connu", joueurId: connu.id };
  }

  const decision = evaluerNom(identite.nom, await listerLeRoster(base));

  return decision.statut === "creer" ? { statut: "aCreer", nom: decision.nom } : decision;
}

/**
 * L'id du joueur désigné, créé au besoin.
 *
 * Prend la transaction en cours et non la base : la ligne du roster et celle
 * qui la référence doivent tomber ou tenir ensemble.
 */
export async function assurerLeJoueur(
  tx: Ecriture,
  choix: ChoixTranche,
  maintenant: Date,
): Promise<number> {
  if (choix.statut === "connu") {
    return choix.joueurId;
  }

  return idRendu(
    await tx
      .insert(joueur)
      .values({ nom: choix.nom, creeLe: maintenant })
      .returning({ id: joueur.id }),
    "joueur",
  );
}
