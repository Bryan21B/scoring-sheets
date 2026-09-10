import { and, asc, eq, isNull } from "drizzle-orm";
import type { Base } from "@/db/base";
import { joueur, participant, partie } from "@/db/schema";
import { type EntreeCatalogue, jeuIdSchema, trouverEntree } from "@/lib/jeux/catalogue";
import { parseRegles, type Regles } from "@/lib/jeux/regles";
import { type CodeDePartie, codeSchema } from "@/lib/partie/code";
import type { JoueurConnu } from "@/lib/roster/noms";

/**
 * Une partie telle qu'un écran la montre.
 *
 * Les règles sont l'**instantané figé à l'ouverture**, relu du JSON ; le jeu
 * vient du catalogue, parce que le nom, l'unité et les liens de règles ne sont
 * volontairement pas dans l'instantané. Les deux chemins partent du même id et
 * ne se rejoignent jamais : l'un se fige, l'autre se relit.
 */
export type VueDePartie = {
  /** L'identité interne : ce que visent les écritures de la page — mouvements
   * de la tablée comme saisies d'une manche. Le code n'est pas la clé primaire
   * — il doit pouvoir se régénérer sans casser les références — donc une page
   * qui écrit a besoin des deux. */
  id: number;
  code: CodeDePartie;
  jeu: EntreeCatalogue;
  regles: Regles;
  participants: JoueurConnu[];
};

/**
 * Retrouve une partie par le code qu'on lui a dicté.
 *
 * Le code arrive du lien ou d'un champ tapé à la main : il est normalisé avant
 * la requête, et un code malformé rend `null` plutôt que de lever — « ce code
 * n'existe pas » est la même réponse pour qui se trompe d'une lettre et pour
 * qui invente.
 *
 * Ne prend **aucune identité de lecteur** : le code donne la lecture, et la
 * page de partie montre le sien à tout le monde. Ce n'est pas toujours le
 * créateur qui a son téléphone en main quand quelqu'un arrive.
 */
export async function lirePartieParCode(base: Base, codeBrut: string): Promise<VueDePartie | null> {
  const code = codeSchema.safeParse(codeBrut);

  if (!code.success) {
    return null;
  }

  const [ligne] = await base
    .select({ id: partie.id, code: partie.code, jeuId: partie.jeuId, regles: partie.regles })
    .from(partie)
    .where(eq(partie.code, code.data))
    .limit(1);

  if (!ligne) {
    return null;
  }

  const jeuId = jeuIdSchema.safeParse(ligne.jeuId);

  if (!jeuId.success) {
    // Une écriture directe en base a pu mettre n'importe quoi dans cette
    // colonne : elle n'a pas de clé étrangère, le catalogue étant une
    // constante. Refuser sèchement vaut mieux que de rendre une partie sans jeu.
    throw new Error(`La partie ${ligne.code} porte un jeu inconnu : ${ligne.jeuId}.`);
  }

  return {
    id: ligne.id,
    code: ligne.code,
    jeu: trouverEntree(jeuId.data),
    regles: parseRegles(ligne.regles),
    participants: await lireLesParticipants(base, ligne.id),
  };
}

/**
 * Les joueurs encore de la partie, dans l'ordre où ils s'y sont inscrits.
 *
 * L'ordre d'insertion **est** l'ordre de la tablée, d'où le tri par
 * `participant.id` : c'est pour ça que cette colonne est `AUTOINCREMENT` et ne
 * se réattribue jamais. Un participant retiré sort de la liste sans que ses
 * valeurs déjà saisies ne bougent.
 */
async function lireLesParticipants(base: Base, partieId: number): Promise<JoueurConnu[]> {
  return base
    .select({ id: joueur.id, nom: joueur.nom })
    .from(participant)
    .innerJoin(joueur, eq(joueur.id, participant.joueurId))
    .where(and(eq(participant.partieId, partieId), isNull(participant.retireLe)))
    .orderBy(asc(participant.id));
}
