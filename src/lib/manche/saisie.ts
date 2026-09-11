import { and, eq, isNull } from "drizzle-orm";
import { z } from "zod";
import type { Base, Ecriture } from "@/db/base";
import { manche, participant, partie, saisie } from "@/db/schema";
import { rangsDuPodium } from "@/lib/jeux/moteur";
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
 * Ce qu'une case peut porter, à l'arrivée comme au départ : un entier, ou le
 * vide.
 *
 * Le vide arrive d'un formulaire en chaîne vide, et d'une action typée en
 * `null` : les deux disent la même chose, et la frontière les recolle ici
 * plutôt que dans chaque appelant. La chaîne vide est écartée **avant** toute
 * coercition, parce que `Number("")` vaut zéro et que zéro est une manche
 * réussie à 6 qui prend : coercer sans regarder écrirait un score que personne
 * n'a tapé, et le journal le confirmerait.
 *
 * Un seul schéma pour la valeur montrée et pour la valeur à poser, parce que
 * le vide est **une valeur** des deux côtés : c'est l'état qu'Uno traverse
 * entre désigner le sorti et taper son total. Ce qui décide si ce vide est
 * légal, c'est le mode — {@link verifierLaValeur} et personne d'autre.
 */
const valeurDeCaseSchema = z.preprocess(
  (brut) => (brut === "" || brut === undefined ? null : brut),
  z.coerce.number().int().nonnegative().nullable(),
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
  valeurMontree: valeurDeCaseSchema,
  valeur: valeurDeCaseSchema,
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
  | { statut: "ecrite"; valeur: ValeurDeCase }
  | { statut: "sansEffet"; valeur: ValeurDeCase }
  | { statut: "refusee"; valeurArrivee: ValeurDeCase; valeurRefusee: ValeurDeCase };

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

/**
 * Vérifie que ce que la case reçoit est **de l'espèce que le mode attend**.
 *
 * Deux espèces de gestes décrivent les trois jeux, et c'est ici qu'elles se
 * séparent. Une **valeur** est un nombre compté devant soi, borné par le
 * garde-fou anti-doigt-gras. Une **désignation** nomme un joueur : au podium
 * elle s'écrit comme le **rang** lui-même, à Uno comme le **vide** — la ligne
 * y est la désignation, et le total se tape ensuite dans la même case.
 *
 * D'où les trois refus, un par mode : une case ne se vide pas à 6 qui prend,
 * un rang que le barème ne porte pas n'existe pas, et une case de podium ne
 * reste jamais vide puisque le rang **est** ce qu'on y pose.
 *
 * Le pavé refuse déjà, et sèchement ; ce contrôle-ci n'est pas un doublon
 * d'interface mais la frontière de confiance — une action serveur s'appelle
 * sans passer par le pavé. D'où une `Error` nue : rien à en dire à l'écran,
 * personne n'a pu taper ça.
 */
function verifierLaValeur(regles: Regles, valeur: ValeurDeCase): void {
  const { saisie } = regles;

  if (saisie.mode === "podium") {
    verifierLeRang(rangsDuPodium(saisie.jetons), valeur);
    return;
  }

  if (valeur === null) {
    if (saisie.mode === "entierParJoueur") {
      throw new Error("Une case ne se vide pas : ce mode attend un entier de chaque joueur.");
    }

    // Le vide d'Uno : la case du sorti existe, son total reste à taper.
    return;
  }

  if (valeur < saisie.min || valeur > saisie.max) {
    throw new Error(
      `Valeur hors des bornes du jeu : ${valeur} n'est pas entre ${saisie.min} et ${saisie.max}.`,
    );
  }
}

/** Le rang posé est-il l'un de ceux que ce barème fait désigner ? */
function verifierLeRang(rangs: readonly number[], valeur: ValeurDeCase): void {
  if (valeur === null || !rangs.includes(valeur)) {
    throw new Error(
      `Rang hors du podium : ${valeur ?? "le vide"} n'est pas un rang à désigner (${rangs.join(", ")}).`,
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
 * Ce que la case porte à cet instant, et si elle **existe**.
 *
 * La condition d'écriture, elle, confond le vide et l'absence : les deux disent
 * « vide », et les distinguer là ferait deux régimes de condition là où le
 * domaine n'en a qu'un. L'existence ne sert qu'à une chose, et c'est
 * {@link ecrireLaCase} qui la lit : poser le vide sur une case **absente** n'est
 * pas sans effet, c'est la désignation d'Uno — la ligne naît, et le total reste
 * à taper.
 */
type EtatDeLaCase = { touchee: boolean; valeur: ValeurDeCase };

async function lireLaCase(
  tx: Ecriture,
  mancheId: number,
  joueurConcerneId: number,
): Promise<EtatDeLaCase> {
  const [ligne] = await tx
    .select({ valeur: saisie.valeur })
    .from(saisie)
    .where(and(eq(saisie.mancheId, mancheId), eq(saisie.joueurId, joueurConcerneId)))
    .limit(1);

  return { touchee: ligne !== undefined, valeur: ligne?.valeur ?? null };
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
 * C'est la branche de l'upsert qui **crée** la case vide d'une désignation à
 * Uno : la ligne existe, sa valeur est `NULL`, et la manche est dès lors en
 * cours plutôt qu'absente.
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
 *
 * La désignation d'Uno passe par la même porte : poser le vide sur une case
 * absente est une `saisie`, et le journal garde `null` — « celui-là est sorti,
 * son total reste à taper ». C'est un geste comme un autre, il a bougé quelque
 * chose.
 */
function gesteDe(avant: ValeurDeCase, nouvelle: ValeurDeCase): GesteDeCase {
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
 * la manche n'existe pas, si ce que la case reçoit n'est pas de l'espèce que
 * son mode attend — voir {@link verifierLaValeur} — ou si la case concerne
 * quelqu'un qui n'est pas de la partie : autant d'envois qu'aucun écran ne
 * produit.
 */
export async function ecrireLaCase(base: Base, brut: unknown): Promise<ResultatDEcriture> {
  const demande = demandeDEcritureSchema.parse(brut);

  return base.transaction(async (tx) => {
    const contexte = await lireLeContexte(tx, demande.mancheId);

    await exigerUnePartieOuverte(tx, contexte.partieId);
    verifierLaValeur(contexte.regles, demande.valeur);
    await verifierLeParticipant(tx, contexte.partieId, demande.joueurConcerneId);

    const etat = await lireLaCase(tx, demande.mancheId, demande.joueurConcerneId);
    const avant = etat.valeur;

    // Avant la condition, et non après : deux joueurs qui font le même constat
    // à trois secondes d'intervalle corrigent vers la même valeur, et annoncer
    // un conflit dont le résultat est celui qu'on demandait serait absurde.
    //
    // `touchee` et non la seule valeur : désigner le sorti à Uno pose le vide
    // sur une case qui n'existe pas encore, et la faire passer pour sans effet
    // ne créerait jamais la ligne qui **est** la désignation.
    if (etat.touchee && avant === demande.valeur) {
      return { statut: "sansEffet", valeur: demande.valeur };
    }

    if (avant !== demande.valeurMontree) {
      return { statut: "refusee", valeurArrivee: avant, valeurRefusee: demande.valeur };
    }

    if (!(await ecrireSousCondition(tx, demande))) {
      return {
        statut: "refusee",
        valeurArrivee: (await lireLaCase(tx, demande.mancheId, demande.joueurConcerneId)).valeur,
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
