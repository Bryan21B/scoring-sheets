import type { Base } from "@/db/base";
import { joueur, participant } from "@/db/schema";
import { creerIdAppareil, type IdAppareil } from "@/lib/appareil/cookie";
import { creerPartie } from "@/lib/partie/creation";
import type { JoueurConnu } from "@/lib/roster/noms";

/**
 * Une partie ouverte, avec sa tablée déjà inscrite.
 *
 * `creerPartie` n'inscrit que le créateur — les autres arrivent par le code, ce
 * qui n'est pas encore construit. Les tests de manche ont pourtant besoin d'une
 * table garnie : ce helper la garnit, en écrivant les participants comme
 * l'arrivée les écrira.
 */
export type PartieDeTest = {
  partieId: number;
  code: string;
  /** L'appareil du créateur : celui qui tient le téléphone dans les tests. */
  idAppareil: IdAppareil;
  /** Les participants dans l'ordre de la tablée, le créateur en tête. */
  joueurs: JoueurConnu[];
};

/** Les noms de la table par défaut : trois joueurs, ce qui suffit à un conflit. */
const TABLE_PAR_DEFAUT = ["Marie", "Paul", "Léa"] as const;

/** Ouvre une partie et y inscrit toute la tablée. */
export async function ouvrirUnePartieDeTest(
  base: Base,
  options: { jeuId?: string; finValeur?: string; noms?: readonly string[] } = {},
): Promise<PartieDeTest> {
  const noms = options.noms ?? TABLE_PAR_DEFAUT;
  const premier = noms[0];

  if (premier === undefined) {
    throw new Error("Une partie de test a besoin d'au moins un joueur.");
  }

  const idAppareil = creerIdAppareil();
  const resultat = await creerPartie(base, {
    idAppareil,
    jeuId: options.jeuId ?? "6-qui-prend",
    nombreDeJoueurs: String(noms.length),
    finValeur: options.finValeur ?? "66",
    identite: { mode: "nouveau", nom: premier },
  });

  if (resultat.statut !== "creee") {
    throw new Error(`Création attendue, reçu « ${resultat.statut} ».`);
  }

  const joueurs: JoueurConnu[] = [{ id: resultat.joueurId, nom: premier }];

  for (const nom of noms.slice(1)) {
    const [ligne] = await base
      .insert(joueur)
      .values({ nom, creeLe: new Date() })
      .returning({ id: joueur.id });

    if (ligne === undefined) {
      throw new Error(`Insertion du joueur ${nom} sans id rendu.`);
    }

    await base.insert(participant).values({ partieId: resultat.partieId, joueurId: ligne.id });
    joueurs.push({ id: ligne.id, nom });
  }

  return { partieId: resultat.partieId, code: resultat.code, idAppareil, joueurs };
}

/**
 * Le joueur assis à ce rang de la tablée.
 *
 * Lève plutôt que de rendre un identifiant de repli : un rang absent est un
 * test mal écrit, et un `0` silencieux le ferait échouer trois assertions plus
 * loin, sur une clé étrangère.
 */
export function joueurDeLaPartie(partie: PartieDeTest, rang: number): number {
  const joueur = partie.joueurs[rang];

  if (joueur === undefined) {
    throw new Error(`La partie de test n'a pas de joueur au rang ${rang}.`);
  }

  return joueur.id;
}
