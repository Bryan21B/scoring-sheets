/**
 * PROTOTYPE JETABLE — maquette de la saisie d'une manche, issue #8.
 *
 * Rien ici n'est du code de production : pas de persistance, pas de validation,
 * pas de tests. Le modèle est en mémoire et se réinitialise au rechargement.
 * Les vrais types vivront dans le schéma Drizzle, une fois #15 tranché.
 */

/** Un joueur de la partie. `moi` marque l'appareil courant, pour montrer ce que ce téléphone voit. */
export type Joueur = { id: string; nom: string; moi?: boolean };

/** Les trois formes de saisie du catalogue. Voir `docs/specs/2026-08-31-configuration-de-jeu.md`. */
export type ModeSaisie = "entierParJoueur" | "sommeAuGagnant" | "podium";

/** Une entrée du catalogue, réduite à ce dont la maquette a besoin. */
export type Jeu = {
  id: string;
  nom: string;
  court: string;
  mode: ModeSaisie;
  direction: "haut" | "bas";
  unite: { un: string; plusieurs: string };
  /** Total qui arrête la partie. `null` quand la fin ne se lit pas sur un total. */
  seuil: number | null;
  finAlternative?: string;
};

/** Les scores d'une manche close, par identifiant de joueur. */
export type Manche = Record<string, number>;

/**
 * Une manche close et son identité.
 *
 * L'identifiant est porté par la manche, pas déduit de sa position : une manche
 * annulée ou réordonnée ferait glisser les index, et la ligne suivrait la
 * mauvaise donnée. C'est déjà vrai dans une maquette où l'on corrige des cases.
 */
export type MancheClose = { id: string; scores: Manche };

/**
 * Une valeur saisie mais pas encore close, avec **qui** l'a tapée.
 *
 * L'auteur est l'information qui rend la manche partielle lisible : sans elle,
 * les quatre autres téléphones voient un nombre sans savoir qui répond déjà.
 */
export type ValeurSaisie = { valeur: number; parQui: string };

/** L'état d'une manche en cours, dans la forme propre à chaque mode de saisie. */
export type SaisieEnCours =
  | { mode: "entierParJoueur"; valeurs: Record<string, ValeurSaisie> }
  | { mode: "sommeAuGagnant"; gagnant: string | null; restants: Record<string, ValeurSaisie> }
  | { mode: "podium"; premier: string | null; deuxieme: string | null };

export const JOUEURS: readonly Joueur[] = [
  { id: "bryan", nom: "Bryan", moi: true },
  { id: "lea", nom: "Léa" },
  { id: "marc", nom: "Marc" },
  { id: "sofia", nom: "Sofia" },
  { id: "theo", nom: "Théo" },
];

/** L'entrée servie quand l'URL n'en désigne aucune de valide. */
export const JEU_PAR_DEFAUT: Jeu = {
  id: "6-qui-prend",
  nom: "6 qui prend",
  court: "6 qui prend",
  mode: "entierParJoueur",
  direction: "bas",
  unite: { un: "tête de bœuf", plusieurs: "têtes de bœuf" },
  seuil: 66,
};

export const JEUX: readonly Jeu[] = [
  JEU_PAR_DEFAUT,
  {
    id: "uno",
    nom: "Uno",
    court: "Uno",
    mode: "sommeAuGagnant",
    direction: "haut",
    unite: { un: "point", plusieurs: "points" },
    seuil: 500,
  },
  {
    id: "dnup",
    nom: "Dnup",
    court: "Dnup",
    mode: "podium",
    direction: "haut",
    unite: { un: "jeton", plusieurs: "jetons" },
    seuil: 4,
    finAlternative: "à 2 joueurs, pas de jetons du tout : 2 manches gagnées",
  },
];

/** Manches déjà closes, par jeu. De quoi que les totaux courants aient une histoire derrière eux. */
export const HISTORIQUE: Record<string, readonly Manche[]> = {
  "6-qui-prend": [
    { bryan: 12, lea: 3, marc: 21, sofia: 7, theo: 15 },
    { bryan: 9, lea: 24, marc: 5, sofia: 18, theo: 2 },
    { bryan: 31, lea: 8, marc: 14, sofia: 11, theo: 26 },
  ],
  uno: [
    { bryan: 0, lea: 0, marc: 143, sofia: 0, theo: 0 },
    { bryan: 96, lea: 0, marc: 0, sofia: 0, theo: 0 },
    { bryan: 0, lea: 0, marc: 0, sofia: 218, theo: 0 },
  ],
  dnup: [
    { bryan: 0, lea: 2, marc: 0, sofia: 1, theo: 0 },
    { bryan: 1, lea: 0, marc: 2, sofia: 0, theo: 0 },
    { bryan: 0, lea: 2, marc: 1, sofia: 0, theo: 0 },
  ],
};

/** Les manches closes d'un jeu, chacune dotée d'un identifiant stable. */
export function historiqueDe(jeu: Jeu): readonly MancheClose[] {
  return (HISTORIQUE[jeu.id] ?? []).map((scores, index) => ({
    id: `${jeu.id}-m${index + 1}`,
    scores,
  }));
}

/** Le jeu du catalogue portant cet identifiant, ou le premier par défaut. */
export function jeuParId(id: string | undefined): Jeu {
  return JEUX.find((j) => j.id === id) ?? JEU_PAR_DEFAUT;
}

/** Somme des manches closes, par joueur. */
export function totaux(manches: readonly Manche[]): Record<string, number> {
  const acc: Record<string, number> = {};
  for (const joueur of JOUEURS) {
    acc[joueur.id] = manches.reduce((somme, manche) => somme + (manche[joueur.id] ?? 0), 0);
  }
  return acc;
}

/**
 * Ce que la manche en cours vaut **si on la fermait maintenant**.
 *
 * Une manche partielle a des totaux, et ce sont eux qui disent si le seuil est
 * franchi. C'est la question que la maquette doit trancher : montrer ce chiffre
 * en direct, ou attendre la clôture.
 */
export function pointsProvisoires(saisie: SaisieEnCours): Record<string, number> {
  if (saisie.mode === "entierParJoueur") {
    return Object.fromEntries(
      Object.entries(saisie.valeurs).map(([id, { valeur }]) => [id, valeur]),
    );
  }
  if (saisie.mode === "sommeAuGagnant") {
    const somme = Object.values(saisie.restants).reduce((total, { valeur }) => total + valeur, 0);
    return saisie.gagnant === null ? {} : { [saisie.gagnant]: somme };
  }
  const points: Record<string, number> = {};
  if (saisie.premier !== null) {
    points[saisie.premier] = 2;
  }
  if (saisie.deuxieme !== null) {
    points[saisie.deuxieme] = 1;
  }
  return points;
}

/** Combien de joueurs restent à saisir, et sur combien. Le dénominateur dépend du mode. */
export function avancement(saisie: SaisieEnCours): { faits: number; total: number } {
  if (saisie.mode === "entierParJoueur") {
    return { faits: Object.keys(saisie.valeurs).length, total: JOUEURS.length };
  }
  if (saisie.mode === "sommeAuGagnant") {
    const attendus = JOUEURS.length - 1;
    return {
      faits: saisie.gagnant === null ? 0 : Object.keys(saisie.restants).length,
      total: attendus,
    };
  }
  // Dnup s'arrête au deuxième sorti : il n'y a jamais de troisième à saisir.
  const faits = (saisie.premier === null ? 0 : 1) + (saisie.deuxieme === null ? 0 : 1);
  return { faits, total: 2 };
}

/** La manche est-elle complète ? Dérivé du mode, jamais un champ stocké. */
export function estComplete(saisie: SaisieEnCours): boolean {
  const { faits, total } = avancement(saisie);
  return faits === total;
}

/** Une saisie vide, dans la forme du mode. */
export function saisieVide(mode: ModeSaisie): SaisieEnCours {
  if (mode === "entierParJoueur") {
    return { mode, valeurs: {} };
  }
  if (mode === "sommeAuGagnant") {
    return { mode, gagnant: null, restants: {} };
  }
  return { mode, premier: null, deuxieme: null };
}

/**
 * Qui franchit le seuil si la manche se ferme maintenant, et ne l'avait pas franchi avant.
 *
 * Renvoie une liste vide quand la fin ne se lit pas sur un total.
 */
export function franchissements(
  jeu: Jeu,
  totauxClos: Record<string, number>,
  provisoires: Record<string, number>,
): readonly string[] {
  if (jeu.seuil === null) {
    return [];
  }
  const seuil = jeu.seuil;
  return JOUEURS.filter((joueur) => {
    const avant = totauxClos[joueur.id] ?? 0;
    const apres = avant + (provisoires[joueur.id] ?? 0);
    return avant < seuil && apres >= seuil;
  }).map((joueur) => joueur.id);
}

/** Le classement courant, trié selon la direction du jeu. */
export function classement(
  jeu: Jeu,
  totauxCourants: Record<string, number>,
): readonly { joueur: Joueur; total: number }[] {
  return [...JOUEURS]
    .map((joueur) => ({ joueur, total: totauxCourants[joueur.id] ?? 0 }))
    .sort((a, b) => (jeu.direction === "bas" ? a.total - b.total : b.total - a.total));
}

/** Accorde l'unité du jeu au nombre. */
export function unite(jeu: Jeu, valeur: number): string {
  return Math.abs(valeur) >= 2 ? jeu.unite.plusieurs : jeu.unite.un;
}
