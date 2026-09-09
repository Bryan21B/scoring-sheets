/**
 * PROTOTYPE JETABLE — maquette de la fin de partie, issue #10.
 *
 * Données figées, aucune persistance. Les trois jeux sont là pour éprouver le
 * même écran dans les deux sens de classement et sur une unité qui n'est pas un
 * point : *6 qui prend* se gagne au plus bas, *Uno* et *Dnup* au plus haut, et
 * *Dnup* compte en jetons lettre.
 */

/** Un jeu, réduit à ce que l'écran de fin doit savoir. */
export type Jeu = {
  id: string;
  nom: string;
  court: string;
  direction: "haut" | "bas";
  unite: { un: string; plusieurs: string };
  /** Pourquoi la partie s'est arrêtée, en une phrase affichable. */
  raisonFin: string;
};

/** Le parcours d'un joueur : son cumul après chaque manche. */
export type Trajectoire = { joueur: string; cumuls: readonly number[] };

/** Une partie terminée, telle que l'écran de fin la reçoit. */
export type PartieFinie = {
  jeu: Jeu;
  trajectoires: readonly Trajectoire[];
  /** La date d'une revisite, pour l'état « rouvert trois jours plus tard ». */
  quand: string;
};

const SIX = {
  id: "6-qui-prend",
  nom: "6 qui prend",
  court: "6 qui prend",
  direction: "bas",
  unite: { un: "tête de bœuf", plusieurs: "têtes de bœuf" },
  raisonFin: "Marc a dépassé 66 têtes de bœuf",
} as const satisfies Jeu;

const UNO = {
  id: "uno",
  nom: "Uno",
  court: "Uno",
  direction: "haut",
  unite: { un: "point", plusieurs: "points" },
  raisonFin: "Bryan a atteint 500 points",
} as const satisfies Jeu;

const DNUP = {
  id: "dnup",
  nom: "Dnup",
  court: "Dnup",
  direction: "haut",
  unite: { un: "jeton", plusieurs: "jetons" },
  raisonFin: "Léa a réuni 4 jetons lettre",
} as const satisfies Jeu;

export const JEUX: readonly Jeu[] = [SIX, UNO, DNUP];

/** Le jeu portant cet identifiant, ou *6 qui prend* par défaut. */
export function jeuParId(id: string | undefined): Jeu {
  return JEUX.find((j) => j.id === id) ?? SIX;
}

const PARTIES: Record<string, PartieFinie> = {
  "6-qui-prend": {
    jeu: SIX,
    quand: "vendredi soir",
    trajectoires: [
      { joueur: "Léa", cumuls: [3, 27, 35, 38, 45, 53, 61] },
      { joueur: "Sofia", cumuls: [7, 25, 36, 40, 48, 57, 64] },
      { joueur: "Bryan", cumuls: [12, 21, 52, 55, 60, 64, 68] },
      { joueur: "Théo", cumuls: [15, 17, 43, 50, 58, 60, 71] },
      { joueur: "Marc", cumuls: [21, 26, 40, 49, 58, 62, 74] },
    ],
  },
  uno: {
    jeu: UNO,
    quand: "mardi",
    trajectoires: [
      { joueur: "Bryan", cumuls: [0, 143, 143, 361, 512] },
      { joueur: "Sofia", cumuls: [96, 96, 314, 314, 430] },
      { joueur: "Nadia", cumuls: [0, 0, 0, 0, 275] },
    ],
  },
  dnup: {
    jeu: DNUP,
    quand: "dimanche",
    trajectoires: [
      { joueur: "Léa", cumuls: [2, 2, 4] },
      { joueur: "Bryan", cumuls: [0, 1, 3] },
      { joueur: "Marc", cumuls: [1, 3, 3] },
      { joueur: "Sofia", cumuls: [0, 0, 1] },
      { joueur: "Théo", cumuls: [0, 0, 0] },
    ],
  },
};

/** La partie finie d'un jeu, éventuellement forcée en ex æquo. */
export function partieDe(jeu: Jeu, exAequo: boolean): PartieFinie {
  const base = PARTIES[jeu.id] ?? PARTIES["6-qui-prend"];
  if (base === undefined) {
    throw new Error("prototype : jeu inconnu");
  }
  if (!exAequo) {
    return base;
  }
  // Égaliser les deux premiers, pour voir ce que l'écran fait de deux vainqueurs.
  const classe = classement(base);
  const premier = classe[0];
  const second = classe[1];
  if (premier === undefined || second === undefined) {
    return base;
  }
  return {
    ...base,
    trajectoires: base.trajectoires.map((t) =>
      t.joueur === second.joueur ? { ...t, cumuls: [...t.cumuls.slice(0, -1), premier.total] } : t,
    ),
  };
}

/** Une ligne du classement final. `rang` est partagé par les ex æquo. */
export type Ligne = { joueur: string; total: number; rang: number; trajectoire: readonly number[] };

/**
 * Le classement final, trié selon la direction du jeu.
 *
 * **Les ex æquo ne se départagent pas** — la règle imprimée de *6 qui prend* dit
 * « il peut y avoir plusieurs vainqueurs en cas d'égalité », et le moteur a été
 * posé ainsi. Deux joueurs à égalité partagent donc le même rang, et le rang
 * suivant saute d'autant.
 */
export function classement(partie: PartieFinie): readonly Ligne[] {
  const bruts = partie.trajectoires.map((t) => ({
    joueur: t.joueur,
    total: t.cumuls[t.cumuls.length - 1] ?? 0,
    trajectoire: t.cumuls,
  }));
  const tries = [...bruts].sort((a, b) =>
    partie.jeu.direction === "bas" ? a.total - b.total : b.total - a.total,
  );
  let rang = 0;
  let precedent: number | null = null;
  return tries.map((ligne, index) => {
    if (precedent === null || ligne.total !== precedent) {
      rang = index + 1;
      precedent = ligne.total;
    }
    return { ...ligne, rang };
  });
}

/** Les vainqueurs : tous ceux qui partagent le rang 1. */
export function vainqueurs(lignes: readonly Ligne[]): readonly Ligne[] {
  return lignes.filter((l) => l.rang === 1);
}

/** Accorde l'unité du jeu au nombre. */
export function unite(jeu: Jeu, valeur: number): string {
  return Math.abs(valeur) >= 2 ? jeu.unite.plusieurs : jeu.unite.un;
}

/** L'écart avec le vainqueur, dans le sens qui fait sens pour le jeu. */
export function ecart(jeu: Jeu, ligne: Ligne, meilleur: number): number {
  return jeu.direction === "bas" ? ligne.total - meilleur : meilleur - ligne.total;
}

/** Les états de la maquette : la fin fraîche, l'égalité, et le lien rouvert plus tard. */
export const ETATS = [
  { id: "fin", nom: "Fin de partie" },
  { id: "exaequo", nom: "Ex æquo" },
  { id: "revisite", nom: "Rouvert 3 jours après" },
] as const;

/** L'identifiant d'un état de la maquette. */
export type EtatId = (typeof ETATS)[number]["id"];

/** Normalise le paramètre d'URL en état connu. */
export function etatParId(id: string | undefined): EtatId {
  return ETATS.find((e) => e.id === id)?.id ?? "fin";
}

/** Le nom lisible d'un état, pour la barre de bascule. */
export function nomEtat(id: EtatId): string {
  return ETATS.find((e) => e.id === id)?.nom ?? id;
}
