import { and, eq, isNull } from "drizzle-orm";
import { z } from "zod";
import type { Base, Ecriture } from "@/db/base";
import { manche, participant, partie, saisie } from "@/db/schema";
import { parseRegles, type Regles } from "@/lib/jeux/regles";
import { agissantSchema, consignerUnGesteDeCase, type GesteDeCase } from "@/lib/journal/ligne";
import { exigerUnePartieOuverte } from "@/lib/partie/fin";

/**
 * Ce que porte une case : un entier, ou **le vide, qui est une valeur**.
 *
 * C'est ce qui laisse « saisir » et « corriger » être le même geste, et la
 * condition d'écriture les couvrir sans les distinguer.
 */
export type ValeurDeCase = number | null;

/**
 * Le vide arrive d'un formulaire en chaîne vide, et d'une action typée en
 * `null` : les deux disent la même chose, et la frontière les recolle ici
 * plutôt que dans chaque appelant.
 */
const valeurMontreeSchema = z.preprocess(
  (brut) => (brut === "" || brut === undefined ? null : brut),
  z.coerce.number().int().nonnegative().nullable(),
);

/**
 * La valeur à poser, qui elle ne peut **pas** être vide.
 *
 * La chaîne vide est écartée avant toute coercition, parce que `Number("")`
 * vaut zéro et que zéro est une manche réussie à 6 qui prend : coercer sans
 * regarder écrirait un score que personne n'a tapé, et le journal le
 * confirmerait.
 */
const valeurAPoserSchema = z.preprocess(
  (brut) => (brut === "" ? undefined : brut),
  z.coerce.number().int().nonnegative(),
);

/**
 * Une demande d'écriture de case, telle qu'un écran l'envoie.
 *
 * `valeurMontree` est le cœur du contrat : ce n'est pas la valeur qu'on veut
 * poser mais **celle qui était à l'écran** au moment de taper. Sans elle, une
 * écriture ne peut être ni conditionnée ni journalisée comme une correction.
 *
 * `agissant` n'est pas déduit de la case : celui qui tape n'est pas forcément
 * celui que la case concerne — c'est même le cas normal au récapitulatif, où
 * l'on saisit pour un participant sans appareil.
 */
export const demandeDEcritureSchema = z.strictObject({
  mancheId: z.coerce.number().int().positive(),
  joueurConcerneId: z.coerce.number().int().positive(),
  valeurMontree: valeurMontreeSchema,
  valeur: valeurAPoserSchema,
  agissant: agissantSchema,
});

/** Une demande d'écriture validée. */
export type DemandeDEcriture = z.infer<typeof demandeDEcritureSchema>;

/**
 * Les trois issues d'une écriture, et il n'y en a pas de quatrième.
 *
 * `sansEffet` n'est pas un succès dégradé : poser sur une case la valeur
 * qu'elle porte déjà donne le résultat voulu, sans rien déplacer et sans rien à
 * annoncer. `refusee` rend **la valeur arrivée**, parce que l'écran qui montre
 * le refus n'a rien d'autre pour se rendre lisible — et qu'aller la relire
 * après coup rouvrirait la course qu'on vient de fermer.
 *
 * Elle rend aussi **la valeur qui vient d'être refusée**, coercée comme elle est
 * entrée : l'écran de refus la garde sous la main pour la réappliquer d'un
 * appui, et la lui faire revenir du serveur est ce qui lui évite d'avoir à
 * survivre au remplacement de la saisie par lui.
 */
export type ResultatDEcriture =
  | { statut: "ecrite"; valeur: number }
  | { statut: "sansEffet"; valeur: number }
  | { statut: "refusee"; valeurArrivee: ValeurDeCase; valeurRefusee: number };

/** La partie à laquelle une manche appartient, et sous quelles règles. */
type ContexteDeManche = {
  partieId: number;
  numero: number;
  regles: Regles;
};

/**
 * Relit la manche, sa partie et l'instantané de règles qui la gouverne.
 *
 * @throws si la manche n'existe pas — un écran ne propose que des manches
 * lues à l'instant, donc un id absent est un envoi forgé ou une manche
 * supprimée sous les doigts, pas un cas à afficher.
 */
async function lireLeContexte(tx: Ecriture, mancheId: number): Promise<ContexteDeManche> {
  const [ligne] = await tx
    .select({ partieId: manche.partieId, numero: manche.numero, regles: partie.regles })
    .from(manche)
    .innerJoin(partie, eq(partie.id, manche.partieId))
    .where(eq(manche.id, mancheId))
    .limit(1);

  if (ligne === undefined) {
    throw new Error(`Aucune manche ${mancheId}.`);
  }

  return { partieId: ligne.partieId, numero: ligne.numero, regles: parseRegles(ligne.regles) };
}

/** Ce qu'une case accepte : le garde-fou anti-doigt-gras, pas une règle de jeu. */
export type Bornes = { min: number; max: number };

/**
 * Les bornes d'une case, ou `null` si ce mode **ne se saisit pas case par case**.
 *
 * La question « ce jeu se tape-t-il un entier par joueur ? » se pose à trois
 * couches — le serveur qui écrit, la page qui décide d'ouvrir l'écran, le pavé
 * qui borne les touches — et chacune y répond autrement : une exception, un
 * 404, une borne haute. La poser une seule fois est ce qui laisse le ticket des
 * deux autres modes trouver les trois endroits d'un coup.
 */
export function bornesDeSaisie(regles: Regles): Bornes | null {
  return regles.saisie.mode === "entierParJoueur"
    ? { min: regles.saisie.min, max: regles.saisie.max }
    : null;
}

/**
 * Vérifie que la valeur tient dans ce que le mode accepte.
 *
 * Le pavé refuse déjà, et sèchement ; ce contrôle-ci n'est pas un doublon
 * d'interface mais la frontière de confiance — une action serveur s'appelle
 * sans passer par le pavé. D'où une `Error` nue : rien à en dire à l'écran,
 * personne n'a pu taper ça.
 */
function verifierLesBornes(regles: Regles, valeur: number): void {
  const bornes = bornesDeSaisie(regles);

  if (bornes === null) {
    throw new Error(`Le mode ${regles.saisie.mode} ne se saisit pas case par case.`);
  }

  if (valeur < bornes.min || valeur > bornes.max) {
    throw new Error(
      `Valeur hors des bornes du jeu : ${valeur} n'est pas entre ${bornes.min} et ${bornes.max}.`,
    );
  }
}

/**
 * Vérifie que la case concerne bien quelqu'un de cette partie.
 *
 * Une case concerne **toujours un participant** — c'est écrit dans le contrat du
 * moteur, « la table `saisie` ne sait pas en produire d'autre » — et rien en
 * base ne le tient : la clé étrangère pointe vers `joueur`, pas vers
 * `participant`. Cette garde est donc ce qui rend la phrase vraie.
 *
 * Elle ne dit rien de **qui écrit**, et l'asymétrie est voulue : le joueur
 * concerné est une donnée dont le moteur dépend, tandis que le joueur agissant
 * est une **déclaration, jamais une preuve** — la conditionner reviendrait à
 * inventer une autorisation là où ce design n'en a aucune. Une ligne écrite pour
 * un joueur étranger ne serait jamais montrée ni comptée, mais elle traînerait,
 * et le journal la porterait comme un geste vrai.
 *
 * Un participant **retiré** passe : ses valeurs déjà saisies restent siennes, et
 * corriger une manche qu'il a jouée avant de partir est légitime. Ce qu'on
 * refuse ici, c'est l'inconnu.
 */
async function verifierLeParticipant(
  tx: Ecriture,
  partieId: number,
  joueurConcerneId: number,
): Promise<void> {
  const [inscrit] = await tx
    .select({ id: participant.id })
    .from(participant)
    .where(and(eq(participant.partieId, partieId), eq(participant.joueurId, joueurConcerneId)))
    .limit(1);

  if (inscrit === undefined) {
    throw new Error(`Le joueur ${joueurConcerneId} n'est pas de la partie ${partieId}.`);
  }
}

/**
 * Ce que la case porte à cet instant, le vide et l'absence confondus.
 *
 * Les deux disent « vide » : une ligne n'existe qu'à partir du moment où la
 * case est **touchée**, et une case touchée mais non remplie porte `NULL`. Les
 * distinguer ici ferait deux régimes de condition là où le domaine n'en a qu'un.
 */
async function lireLaCase(
  tx: Ecriture,
  mancheId: number,
  joueurConcerneId: number,
): Promise<ValeurDeCase> {
  const [ligne] = await tx
    .select({ valeur: saisie.valeur })
    .from(saisie)
    .where(and(eq(saisie.mancheId, mancheId), eq(saisie.joueurId, joueurConcerneId)))
    .limit(1);

  return ligne?.valeur ?? null;
}

/**
 * L'écriture conditionnelle elle-même : une seule instruction SQL, dont la
 * condition **porte sur la case** et jamais sur la partie.
 *
 * Deux branches parce que le vide n'est pas stocké comme un nombre : montrée
 * vide, la case peut être absente — d'où l'upsert, dont le `setWhere` refuse de
 * réveiller une case qui aurait entre-temps reçu une valeur ; montrée pleine,
 * elle existe forcément et un `UPDATE` conditionné suffit.
 *
 * Rend le nombre de lignes touchées : zéro veut dire « quelqu'un est passé
 * avant », et c'est la seule lecture de la course qui ne puisse pas mentir.
 */
async function ecrireSousCondition(tx: Ecriture, demande: DemandeDEcriture): Promise<boolean> {
  const { mancheId, joueurConcerneId, valeurMontree, valeur } = demande;

  if (valeurMontree === null) {
    const touchees = await tx
      .insert(saisie)
      .values({ mancheId, joueurId: joueurConcerneId, valeur })
      .onConflictDoUpdate({
        target: [saisie.mancheId, saisie.joueurId],
        set: { valeur },
        setWhere: isNull(saisie.valeur),
      })
      .returning({ id: saisie.id });

    return touchees.length > 0;
  }

  const touchees = await tx
    .update(saisie)
    .set({ valeur })
    .where(
      and(
        eq(saisie.mancheId, mancheId),
        eq(saisie.joueurId, joueurConcerneId),
        eq(saisie.valeur, valeurMontree),
      ),
    )
    .returning({ id: saisie.id });

  return touchees.length > 0;
}

/**
 * Le geste qu'une écriture effective enregistre : poser sur du vide est une
 * `saisie`, écrire par dessus un nombre est une `correction`.
 *
 * Le discriminant se **dérive de ce que la case portait**, il ne se déclare
 * pas : l'écran ne connaît qu'un geste, on retape la ligne, et lui demander
 * lequel c'était lui ferait porter une décision qu'il n'a pas les moyens de
 * prendre juste.
 */
function gesteDe(avant: ValeurDeCase, nouvelle: number): GesteDeCase {
  return avant === null
    ? { geste: "saisie", detail: { valeur: nouvelle } }
    : { geste: "correction", detail: { ancienne: avant, nouvelle } };
}

/**
 * Écrit une case, **à condition qu'elle porte encore la valeur montrée**.
 *
 * Le garde-fou porte sur la case et jamais sur la partie : cinq joueurs
 * saisissant chacun la leur sont le cas normal à 6 qui prend, et une condition
 * portée par la partie en ferait échouer quatre. L'estampille de version reste
 * au poll, elle n'est jamais un jeton d'écriture.
 *
 * La relecture avant écriture classe l'issue — sans effet, refusée, écrite —
 * mais ne la garantit pas : c'est la clause SQL qui tranche, et un zéro ligne
 * touchée l'emporte sur ce que la relecture croyait savoir.
 *
 * Une partie **scellée** refuse tout, saisie comme correction : c'est le prix
 * assumé de l'estampille de fin, et le seul recours est de corriger *avant* de
 * clore la manche qui termine la partie.
 *
 * @throws {@link PartieScellee} si la partie porte une fin. Une `Error` nue si
 * la manche n'existe pas, si le mode n'est pas `entierParJoueur`, si la valeur
 * sort des bornes, ou si la case concerne quelqu'un qui n'est pas de la partie :
 * autant d'envois qu'aucun écran ne produit.
 */
export async function ecrireLaCase(base: Base, brut: unknown): Promise<ResultatDEcriture> {
  const demande = demandeDEcritureSchema.parse(brut);

  return base.transaction(async (tx) => {
    const contexte = await lireLeContexte(tx, demande.mancheId);

    await exigerUnePartieOuverte(tx, contexte.partieId);
    verifierLesBornes(contexte.regles, demande.valeur);
    await verifierLeParticipant(tx, contexte.partieId, demande.joueurConcerneId);

    const avant = await lireLaCase(tx, demande.mancheId, demande.joueurConcerneId);

    // Avant la condition, et non après : deux joueurs qui font le même constat
    // à trois secondes d'intervalle corrigent vers la même valeur, et annoncer
    // un conflit dont le résultat est celui qu'on demandait serait absurde.
    if (avant === demande.valeur) {
      return { statut: "sansEffet", valeur: demande.valeur };
    }

    if (avant !== demande.valeurMontree) {
      return { statut: "refusee", valeurArrivee: avant, valeurRefusee: demande.valeur };
    }

    if (!(await ecrireSousCondition(tx, demande))) {
      return {
        statut: "refusee",
        valeurArrivee: await lireLaCase(tx, demande.mancheId, demande.joueurConcerneId),
        valeurRefusee: demande.valeur,
      };
    }

    await consignerUnGesteDeCase(tx, {
      partieId: contexte.partieId,
      mancheNumero: contexte.numero,
      joueurConcerneId: demande.joueurConcerneId,
      agissant: demande.agissant,
      ...gesteDe(avant, demande.valeur),
    });

    return { statut: "ecrite", valeur: demande.valeur };
  });
}
