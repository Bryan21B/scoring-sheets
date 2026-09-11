import { and, asc, desc, eq, inArray, isNotNull, isNull } from "drizzle-orm";
import type { Lecture } from "@/db/base";
import { joueur, manche, participant, partie, saisie } from "@/db/schema";
import { type EntreeCatalogue, type JeuId, jeuIdSchema, trouverEntree } from "@/lib/jeux/catalogue";
import { parseRegles } from "@/lib/jeux/regles";
import { etatDesLignes, type LigneDeGrille } from "@/lib/manche/lecture";
import type { CodeDePartie } from "@/lib/partie/code";
import type { FinDePartie } from "@/lib/partie/fin";
import type { JoueurConnu } from "@/lib/roster/noms";

/**
 * Une ligne de l'historique : **le jeu, la date, le vainqueur, le nombre de
 * joueurs** — et le code qui mène à la fiche.
 *
 * Quatre choses et pas cinq. La tablée complète et les scores sont sur la
 * fiche : sur une ligne de téléphone, une de plus est une de trop. Le code n'en
 * est pas une cinquième — il n'est pas montré, il est l'adresse de la ligne.
 *
 * `vainqueur` est `null` deux fois plutôt qu'une : une partie **abandonnée** n'en
 * a pas — elle a eu lieu, elle ne s'est pas jouée jusqu'au bout — et une partie
 * dont la **tête est à égalité** n'en a pas non plus. Le moteur sort son
 * classement en groupes de rang, et un groupe de deux ne se départage nulle
 * part ; nommer l'un des deux ici inventerait un podium que rien ne soutient.
 */
export type LigneDHistorique = {
  code: CodeDePartie;
  jeu: EntreeCatalogue;
  finLe: Date;
  /** Terminée ou abandonnée : ce qui distingue les deux façons de finir. */
  cause: FinDePartie["cause"];
  vainqueur: JoueurConnu | null;
  nombreDeJoueurs: number;
};

/**
 * Ce que l'historique demande : quel jeu, et combien de lignes.
 *
 * **Un seul axe de filtre**, et c'est le jeu. Filtrer par joueur est la fiche de
 * joueur : deux entrées vers la même liste demanderaient de choisir laquelle est
 * la bonne avant d'avoir rien lu.
 *
 * `combien` remplace une pagination numérotée, qui n'a pas de sens à dix
 * joueurs : le « voir plus » augmente ce nombre, il ne saute pas à une page.
 */
export type FiltreDHistorique = {
  jeuId: JeuId | null;
  combien: number;
};

/**
 * L'historique tel qu'un écran le reçoit.
 *
 * `encore` dit qu'il reste des parties **derrière** celles-ci, sans dire combien :
 * c'est tout ce dont un « voir plus » a besoin, et compter le reste coûterait
 * une seconde requête pour un nombre que personne ne lit.
 */
export type VueDHistorique = {
  lignes: readonly LigneDHistorique[];
  encore: boolean;
};

/** Une partie finie, telle que la première requête la rend. */
type PartieFinie = {
  id: number;
  code: CodeDePartie;
  jeu: EntreeCatalogue;
  regles: string;
  finLe: Date;
  cause: FinDePartie["cause"];
};

/**
 * La page de parties finies, la plus récente en tête.
 *
 * `fin_le IS NOT NULL` n'est pas qu'un filtre métier : c'est la condition qui
 * rend l'**index partiel** `partie_fin_le_idx` utilisable, et sans elle le
 * planificateur relirait toute la table pour la trier. Le tri est celui de
 * l'index — `fin_le` décroissant — donc il ne coûte rien : aucun tri temporaire,
 * et la limite arrête le parcours dès qu'il a assez de lignes. C'est ce que
 * l'estampille de fin achète (`docs/adr/0006`).
 *
 * Aucun départage par identifiant dans le `ORDER BY`, à dessein : l'ajouter
 * sortirait de l'ordre de l'index et forcerait un tri de toute la table. À
 * égalité de milliseconde, c'est l'ordre du parcours d'index qui tranche, ce
 * qui suffit — deux parties finies dans la même milliseconde ne s'ordonnent de
 * toute façon par rien de réel.
 *
 * Une ligne de plus que demandé est lue, et elle n'est jamais rendue : c'est
 * elle, et non un `count(*)`, qui répond à « y en a-t-il d'autres ? ».
 */
export function requeteDesPartiesFinies(base: Lecture, filtre: FiltreDHistorique) {
  const finies = isNotNull(partie.finLe);

  return base
    .select({
      id: partie.id,
      code: partie.code,
      jeuId: partie.jeuId,
      regles: partie.regles,
      finLe: partie.finLe,
      finCause: partie.finCause,
    })
    .from(partie)
    .where(filtre.jeuId === null ? finies : and(finies, eq(partie.jeuId, filtre.jeuId)))
    .orderBy(desc(partie.finLe))
    .limit(filtre.combien + 1);
}

/**
 * La page relue et validée : le jeu résolu, la fin recomposée.
 *
 * Séparée de {@link requeteDesPartiesFinies} pour que le plan d'exécution se
 * vérifie sur la requête elle-même, sans avoir à la réécrire dans un test — une
 * requête recopiée à la main prouverait qu'un index existe, jamais qu'il sert.
 */
async function lireLaPage(base: Lecture, filtre: FiltreDHistorique): Promise<PartieFinie[]> {
  const lignes = await requeteDesPartiesFinies(base, filtre);

  return lignes.map((ligne) => {
    const jeuId = jeuIdSchema.safeParse(ligne.jeuId);

    if (!jeuId.success) {
      // Comme `lirePartieParCode` : la colonne n'a pas de clé étrangère, le
      // catalogue étant une constante, donc une écriture directe a pu y mettre
      // n'importe quoi. Refuser sèchement vaut mieux que d'inventer un jeu.
      throw new Error(`La partie ${ligne.code} porte un jeu inconnu : ${ligne.jeuId}.`);
    }

    if (ligne.finLe === null || ligne.finCause === null) {
      // Le `CHECK` de la base tient les trois colonnes de fin ensemble, et la
      // requête n'a demandé que des parties finies : y arriver serait un schéma
      // qui a bougé sous nos pieds, pas un cas à afficher.
      throw new Error(`La partie ${ligne.code} est dans l'historique sans porter de fin.`);
    }

    return {
      id: ligne.id,
      code: ligne.code,
      jeu: trouverEntree(jeuId.data),
      regles: ligne.regles,
      finLe: ligne.finLe,
      cause: ligne.finCause,
    };
  });
}

/**
 * Les participants encore de chaque partie de la page, en **une** requête.
 *
 * Groupés dans l'ordre de la tablée, comme `lirePartieParCode` les rend, parce
 * que c'est cet ordre-là que les colonnes d'une grille suivent. Un participant
 * retiré n'y est pas : il ne compte ni dans l'effectif affiché, ni au
 * classement, et ses valeurs déjà saisies restent en base intactes.
 */
async function lireLesTablees(
  base: Lecture,
  partieIds: readonly number[],
): Promise<Map<number, JoueurConnu[]>> {
  const lignes = await base
    .select({ partieId: participant.partieId, id: joueur.id, nom: joueur.nom })
    .from(participant)
    .innerJoin(joueur, eq(joueur.id, participant.joueurId))
    .where(and(inArray(participant.partieId, partieIds), isNull(participant.retireLe)))
    .orderBy(asc(participant.id));

  return grouper(
    lignes,
    (ligne) => ligne.partieId,
    ({ id, nom }) => ({ id, nom }),
  );
}

/** Une manche de la page, avec la partie dont elle relève. */
type MancheDeLaPage = { id: number; partieId: number; numero: number; close: boolean };

/**
 * Toutes les manches des parties **à totaliser**, en une requête.
 *
 * Le tri est global et non par partie : `numero` croissant à l'intérieur d'un
 * même `partie_id` est tout ce dont le regroupement a besoin, et un `ORDER BY`
 * par partie n'existe pas en SQL.
 */
async function lireLesManches(
  base: Lecture,
  partieIds: readonly number[],
): Promise<MancheDeLaPage[]> {
  if (partieIds.length === 0) {
    return [];
  }

  const lignes = await base
    .select({
      id: manche.id,
      partieId: manche.partieId,
      numero: manche.numero,
      closeLe: manche.closeLe,
    })
    .from(manche)
    .where(inArray(manche.partieId, partieIds))
    .orderBy(asc(manche.partieId), asc(manche.numero));

  return lignes.map((ligne) => ({
    id: ligne.id,
    partieId: ligne.partieId,
    numero: ligne.numero,
    close: ligne.closeLe !== null,
  }));
}

/**
 * Les valeurs saisies de toutes ces manches, indexées par manche puis par joueur.
 *
 * Une seule requête pour la page entière : c'est le contraire d'une lecture par
 * partie, et c'est ce qui empêche l'historique de coûter en requêtes ce que la
 * liste coûte en lignes.
 */
async function lireLesValeurs(
  base: Lecture,
  mancheIds: readonly number[],
): Promise<Map<number, Map<number, number | null>>> {
  const valeurs = new Map<number, Map<number, number | null>>();

  if (mancheIds.length === 0) {
    return valeurs;
  }

  const lignes = await base
    .select({ mancheId: saisie.mancheId, joueurId: saisie.joueurId, valeur: saisie.valeur })
    .from(saisie)
    .where(inArray(saisie.mancheId, mancheIds));

  for (const ligne of lignes) {
    const parJoueur = valeurs.get(ligne.mancheId) ?? new Map<number, number | null>();

    parJoueur.set(ligne.joueurId, ligne.valeur);
    valeurs.set(ligne.mancheId, parJoueur);
  }

  return valeurs;
}

/** Range des lignes plates sous la clé qui les groupe, dans l'ordre reçu. */
function grouper<Ligne, Valeur>(
  lignes: readonly Ligne[],
  cle: (ligne: Ligne) => number,
  valeur: (ligne: Ligne) => Valeur,
): Map<number, Valeur[]> {
  const groupes = new Map<number, Valeur[]>();

  for (const ligne of lignes) {
    const groupe = groupes.get(cle(ligne)) ?? [];

    groupe.push(valeur(ligne));
    groupes.set(cle(ligne), groupe);
  }

  return groupes;
}

/**
 * Les lignes de grille d'une partie, reconstruites depuis la lecture groupée.
 *
 * Une case par participant, la vide comprise, exactement comme la jointure
 * gauche de `lireLesCases` les rend une partie à la fois — et, comme elle,
 * chacune dit si elle a été **touchée**. Ce n'est pas un détail de forme : à
 * Uno, une case absente et une case touchée mais vide portent toutes deux
 * `null`, et les confondre rendrait toute manche d'Uno incomplète, donc tout
 * historique d'Uno sans vainqueur.
 */
function lignesDeGrille(
  manches: readonly MancheDeLaPage[],
  tablee: readonly JoueurConnu[],
  valeurs: ReadonlyMap<number, ReadonlyMap<number, number | null>>,
): LigneDeGrille[] {
  return manches.map((une) => ({
    numero: une.numero,
    close: une.close,
    cases: tablee.map((joueur) => ({
      joueur,
      valeur: valeurs.get(une.id)?.get(joueur.id) ?? null,
      touchee: valeurs.get(une.id)?.has(joueur.id) ?? false,
    })),
  }));
}

/**
 * Le vainqueur d'une partie terminée, ou personne.
 *
 * Le premier groupe du classement, **à condition qu'il n'y ait qu'un joueur
 * dedans**. Le moteur ne nomme jamais de gagnant — il constate l'ordre — et
 * c'est ici, une seule fois, que « premier tout seul » se lit.
 */
function vainqueurDuClassement(
  classement: readonly (readonly number[])[],
  tablee: readonly JoueurConnu[],
): JoueurConnu | null {
  const tete = classement[0];

  if (tete === undefined || tete.length !== 1) {
    return null;
  }

  return tablee.find((joueur) => joueur.id === tete[0]) ?? null;
}

/**
 * L'historique : les parties finies, la plus récente d'abord, filtrées par jeu.
 *
 * **Quatre requêtes, quelle que soit la taille de la page.** Une pour désigner
 * les parties — sur l'index partiel de date de fin, jamais sur toute la table —
 * puis trois lectures groupées qui rapportent d'un coup les tablées, les manches
 * et les valeurs de ces parties-là. Le moteur ne voit donc jamais que les
 * quelques parties affichées, et une base qui grossit n'ajoute ni requête ni
 * manche à relire.
 *
 * Le vainqueur vient du **moteur** et d'aucune addition faite en SQL. Rien du
 * décompte n'est stocké — un total agrégé par la base serait un second décompte,
 * qui se désaccorderait de la grille montrée sur la fiche sans que rien ne
 * proteste — et c'est exactement pour ça que le lecteur va chercher les manches
 * plutôt qu'une colonne.
 *
 * Une partie **abandonnée** ne passe pas par le moteur du tout : elle n'a pas de
 * vainqueur par décision de domaine, pas par calcul, et ses manches ne sont donc
 * même pas relues.
 */
export async function lireLHistorique(
  base: Lecture,
  filtre: FiltreDHistorique,
): Promise<VueDHistorique> {
  const page = await lireLaPage(base, filtre);

  if (page.length === 0) {
    return { lignes: [], encore: false };
  }

  const montrees = page.slice(0, filtre.combien);
  const tablees = await lireLesTablees(
    base,
    montrees.map((une) => une.id),
  );
  const aTotaliser = montrees.filter((une) => une.cause === "terminee");
  const manches = await lireLesManches(
    base,
    aTotaliser.map((une) => une.id),
  );
  const valeurs = await lireLesValeurs(
    base,
    manches.map((une) => une.id),
  );
  const manchesParPartie = grouper(
    manches,
    (une) => une.partieId,
    (une) => une,
  );

  return {
    encore: page.length > filtre.combien,
    lignes: montrees.map((une) => {
      const tablee = tablees.get(une.id) ?? [];
      const grille = lignesDeGrille(manchesParPartie.get(une.id) ?? [], tablee, valeurs);

      return {
        code: une.code,
        jeu: une.jeu,
        finLe: une.finLe,
        cause: une.cause,
        vainqueur:
          une.cause === "abandonnee"
            ? null
            : vainqueurDuClassement(
                etatDesLignes(parseRegles(une.regles), grille).classement,
                tablee,
              ),
        nombreDeJoueurs: tablee.length,
      };
    }),
  };
}
