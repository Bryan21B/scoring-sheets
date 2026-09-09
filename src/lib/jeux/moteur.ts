import type { Regles } from "@/lib/jeux/regles";

/**
 * L'identifiant d'un joueur du roster, tel que la base le porte.
 *
 * Un entier nu, et rien de plus : le moteur ne lit jamais une ligne, il reçoit
 * des identités déjà résolues par son appelant.
 */
export type JoueurId = number;

/**
 * Une case : ce qu'un joueur a marqué dans une manche.
 *
 * `valeur` à `null` dit **touchée mais vide** — l'état par lequel Uno passe
 * entre « qui est sorti ? » et le total tapé. Ce que le nombre signifie est
 * donné par le mode de saisie des règles : l'entier compté devant soi, le total
 * unique crédité au gagnant, ou le rang au podium.
 *
 * Une case **concerne toujours quelqu'un qui a été participant** : la table
 * `saisie` ne sait pas en produire d'autre. Le moteur ne s'en défend pas, et
 * c'est délibéré — il ne saurait pas distinguer un joueur qui n'a jamais été là
 * d'un participant retiré, dont la manche remportée avant son départ doit rester
 * la sienne.
 */
export type Case = {
  readonly joueurId: JoueurId;
  readonly valeur: number | null;
};

/**
 * Une manche telle que le moteur la reçoit : ce qu'elle attend, ce qu'elle
 * porte, et si elle est close.
 *
 * `close` est la clôture **déclarée**, jamais déduite de la complétude — c'est
 * l'entrée de plus que le contrat du moteur a gagnée, et non un état de plus.
 *
 * `participants` porte les joueurs que cette manche **attend**. Un participant
 * retiré n'y figure plus, ce qui le sort de la complétude des manches suivantes
 * et du classement, tandis que ses valeurs déjà saisies restent dans `cases` :
 * l'histoire est vraie et ne se réécrit pas.
 *
 * L'appelant est libre de la remplir de deux façons — l'effectif historique de
 * chaque manche, ou l'effectif courant recopié sur toutes — parce que le moteur
 * en lit l'**intersection** : les deux lectures donnent le même effectif.
 */
export type Manche = {
  readonly close: boolean;
  readonly participants: readonly JoueurId[];
  readonly cases: readonly Case[];
};

/**
 * L'état d'une partie. Rien de ce qui suit n'est stocké : tout se recalcule à
 * chaque lecture.
 *
 * La frontière que ce type existe pour tenir : **`totaux` lit tout**, y compris
 * une manche en cours de saisie, tandis que **`fini`, `manchesJouees` et
 * `manchesGagnees` ne lisent que les manches closes**. On voit le seuil arriver ;
 * la partie ne ferme qu'à un acte humain.
 *
 * `classement` sort en **groupes de rang** : deux joueurs à égalité sont dans le
 * même groupe, et l'égalité n'est jamais départagée. Une liste plate afficherait
 * un podium faux sans que rien ne proteste ; ici, un consommateur ne *peut pas*
 * l'oublier. Il se lit à tout moment, partie non finie comprise ; à zéro manche
 * il n'y a personne à ranger et il sort vide, ce qui est une sortie et non un
 * cas limite — une salle d'attente n'a pas de podium.
 *
 * Le moteur dit `fini`, jamais `gagnant` : il constate que la condition est
 * remplie et donne l'ordre, il ne nomme personne.
 */
export type Etat = {
  readonly totaux: ReadonlyMap<JoueurId, number>;
  readonly manchesGagnees: ReadonlyMap<JoueurId, number>;
  readonly classement: readonly (readonly JoueurId[])[];
  readonly fini: boolean;
  readonly manchesJouees: number;
};

/**
 * Le moteur de décompte : des règles et des manches, rien d'autre, vers l'état.
 *
 * Pure par construction. Sa signature interdit **mécaniquement** de brancher sur
 * l'identifiant du jeu — elle ne le reçoit pas — et c'est le seul dispositif qui
 * protège « un moteur unique » contre la première urgence. Ce qui n'est pas dans
 * `regles` ne peut pas influencer un calcul.
 */
export function evaluer(regles: Regles, manches: readonly Manche[]): Etat {
  const effectif = effectifCourant(manches);
  const joueurs = tousLesJoueurs(manches, effectif);
  const closes = manches.filter((manche) => manche.close);
  const manchesGagnees = compterVictoires(regles, closes, joueurs);
  const totaux = cumuler(regles, manches, joueurs);

  return {
    totaux,
    manchesGagnees,
    classement: classer(effectif, totaux, regles.classement.direction),
    fini: estFinie(regles, closes, {
      effectif,
      totauxClos: cumuler(regles, closes, joueurs),
      victoires: manchesGagnees,
    }),
    manchesJouees: closes.length,
  };
}

/**
 * Range les joueurs par total, en **groupes de rang**.
 *
 * Deux joueurs à égalité sortent dans le même groupe, et le rang suivant est
 * sauté par construction — un groupe de deux occupe une marche, la marche
 * d'après est la troisième place. C'est la seule sortie possible : une liste
 * plate afficherait un podium faux sans que rien ne proteste.
 *
 * `direction` ne sert qu'ici. Elle décide qui gagne, jamais quand la partie
 * s'arrête.
 */
function classer(
  joueurs: readonly JoueurId[],
  totaux: ReadonlyMap<JoueurId, number>,
  direction: Direction,
): JoueurId[][] {
  const groupes = new Map<number, JoueurId[]>();

  for (const joueurId of joueurs) {
    const total = totaux.get(joueurId) ?? 0;
    const groupe = groupes.get(total);

    if (groupe === undefined) {
      groupes.set(total, [joueurId]);
    } else {
      groupe.push(joueurId);
    }
  }

  return [...groupes.entries()]
    .sort(([un], [autre]) => (direction === "haut" ? autre - un : un - autre))
    .map(([, groupe]) => groupe);
}

/**
 * Compte les manches remportées, sur les manches **closes** seulement.
 *
 * Une manche sans gagnant — égalité — ne crédite personne, et le compteur reste
 * à zéro pour tout le monde plutôt que de disparaître : un joueur sans victoire
 * doit se lire, pas se déduire d'une absence.
 */
function compterVictoires(
  regles: Regles,
  closes: readonly Manche[],
  joueurs: readonly JoueurId[],
): Map<JoueurId, number> {
  const victoires = new Map<JoueurId, number>(joueurs.map((joueurId) => [joueurId, 0]));

  for (const manche of closes) {
    const gagnant = gagnantDeManche(regles, manche);

    if (gagnant === undefined) {
      continue;
    }

    victoires.set(gagnant, (victoires.get(gagnant) ?? 0) + 1);
  }

  return victoires;
}

/**
 * La condition de fin est-elle remplie ?
 *
 * Ne reçoit que des manches **closes** et le cumul qui en sort : une manche en
 * cours ne peut donc jamais rendre `fini` vrai, quel que soit ce qu'elle porte.
 *
 * Le franchissement d'un seuil se lit **toujours par le total le plus haut**, y
 * compris à 6 qui prend où l'on accumule des têtes de bœuf jusqu'à 66 et où le
 * plus bas gagne. `direction` n'entre pas ici : deux champs orthogonaux, une
 * seule règle de franchissement. Le `some` est cette lecture-là — un total au
 * moins atteint le seuil, donc le plus haut l'atteint — restreinte aux joueurs
 * encore de la partie.
 */
function estFinie(
  regles: Regles,
  closes: readonly Manche[],
  compteurs: {
    readonly effectif: readonly JoueurId[];
    readonly totauxClos: ReadonlyMap<JoueurId, number>;
    readonly victoires: ReadonlyMap<JoueurId, number>;
  },
): boolean {
  const { fin } = regles;
  const { effectif, totauxClos, victoires } = compteurs;

  switch (fin.type) {
    case "seuil":
      return effectif.some((joueurId) => (totauxClos.get(joueurId) ?? 0) >= fin.valeur);
    case "manchesFixes":
      return closes.length >= fin.valeur;
    case "manchesGagnees":
      return effectif.some((joueurId) => (victoires.get(joueurId) ?? 0) >= fin.valeur);
  }
}

/**
 * Une manche a-t-elle reçu tout ce que son mode de saisie attend ?
 *
 * La complétude se **dérive du mode**, ce n'est pas un champ. Elle ne dit rien
 * de la clôture, qui est déclarée : une manche complète attend encore qu'on la
 * close, et une manche incomplète se répare au lieu de se clore.
 *
 * `entierParJoueur` attend une valeur de chaque **participant** — un joueur
 * retiré n'en est plus un, ce qui laisse la table finir sans lui.
 * `sommeAuGagnant` attend une seule case portant une valeur : un gagnant
 * désigné et le total des cartes des autres, jamais une valeur par perdant.
 * `podium` attend qu'un joueur occupe chaque rang du barème.
 */
export function estComplete(regles: Regles, manche: Manche): boolean {
  const { saisie } = regles;
  const remplies = casesRemplies(manche);

  switch (saisie.mode) {
    case "entierParJoueur": {
      const marques = new Set(remplies.map((uneCase) => uneCase.joueurId));
      return manche.participants.every((joueurId) => marques.has(joueurId));
    }
    case "sommeAuGagnant": {
      const attendus = new Set(manche.participants);
      const videAttendue = manche.cases.some(
        (uneCase) => uneCase.valeur === null && attendus.has(uneCase.joueurId),
      );

      return remplies.length === 1 && !videAttendue;
    }
    case "podium": {
      const rangs = new Set(remplies.map((uneCase) => uneCase.valeur));
      return [...saisie.jetons.keys()].every((index) => rangs.has(index + PREMIER));
    }
  }
}

/**
 * Qui a gagné cette manche ? Personne, si rien ne le désigne.
 *
 * Le gagnant est **dérivé**, jamais saisi, et défini pour les trois modes : le
 * premier du podium, le gagnant désigné d'un `sommeAuGagnant`, le meilleur score
 * d'un `entierParJoueur` selon `direction`. C'est le seul endroit où
 * `direction` sert au décompte — jamais au franchissement d'un seuil.
 *
 * **Une égalité ne fait aucun gagnant** : la manche se joue à deux, personne ne
 * la remporte, et rien nulle part ne départage.
 *
 * Une manche **incomplète** n'a pas de gagnant non plus : le meilleur score des
 * trois joueurs qui ont saisi n'est pas le gagnant de la manche, et faire une
 * exception pour les deux autres modes rendrait la règle illisible.
 */
export function gagnantDeManche(regles: Regles, manche: Manche): JoueurId | undefined {
  if (!estComplete(regles, manche)) {
    return undefined;
  }

  const { saisie } = regles;
  const remplies = casesRemplies(manche);

  switch (saisie.mode) {
    case "entierParJoueur":
      return seulJoueur(meilleures(remplies, regles.classement.direction));
    case "sommeAuGagnant":
      return seulJoueur(remplies);
    case "podium":
      return seulJoueur(remplies.filter((uneCase) => uneCase.valeur === PREMIER));
  }
}

/**
 * Le rang de tête au podium.
 *
 * La colonne porte le **rang**, `1` puis `2` — c'est `docs/specs/2026-09-09-schema.md`
 * qui le fixe — tandis que `jetons` s'indexe depuis zéro. Le décalage entre les
 * deux s'écrit ici, une seule fois, plutôt que dans chaque lecture.
 */
const PREMIER = 1;

/** Le sens du classement, dérivé des règles plutôt que réécrit à côté. */
type Direction = Regles["classement"]["direction"];

/** Le joueur d'une case, à condition qu'il n'y en ait qu'une : sinon, personne. */
function seulJoueur(cases: readonly CaseRemplie[]): JoueurId | undefined {
  return cases.length === 1 ? cases[0]?.joueurId : undefined;
}

/**
 * Les cases qui portent le meilleur score de la manche — plusieurs quand il y a
 * égalité, ce qui est exactement ce qu'il faut pour ne désigner personne.
 */
function meilleures(cases: readonly CaseRemplie[], direction: Direction): CaseRemplie[] {
  let extremum: number | undefined;

  for (const uneCase of cases) {
    if (extremum === undefined) {
      extremum = uneCase.valeur;
      continue;
    }

    if (direction === "haut" ? uneCase.valeur > extremum : uneCase.valeur < extremum) {
      extremum = uneCase.valeur;
    }
  }

  return cases.filter((uneCase) => uneCase.valeur === extremum);
}

/** Une case qui porte vraiment un nombre, le `null` déjà écarté. */
type CaseRemplie = {
  readonly joueurId: JoueurId;
  readonly valeur: number;
};

/**
 * Les cases qui portent une valeur.
 *
 * Écrite en boucle plutôt qu'en `filter` parce qu'un `filter` ne rétrécit pas
 * `number | null`, et que l'assertion non-null qui le rattraperait est interdite.
 */
function casesRemplies(manche: Manche): CaseRemplie[] {
  const remplies: CaseRemplie[] = [];

  for (const uneCase of manche.cases) {
    if (uneCase.valeur !== null) {
      remplies.push({ joueurId: uneCase.joueurId, valeur: uneCase.valeur });
    }
  }

  return remplies;
}

/**
 * Les joueurs **encore de la partie** : ceux qu'aucune manche n'a cessé
 * d'attendre.
 *
 * Une **intersection**, et non la dernière manche ni l'union. La liste des
 * participants ne fait que rétrécir une fois la partie gelée — on ne rejoint
 * plus, on ne peut que partir — donc l'intersection est exactement l'effectif
 * courant, et c'est la seule lecture qui ne dépende pas de l'ordre dans lequel
 * les manches arrivent.
 *
 * C'est ce qui sort un participant retiré du classement et du franchissement.
 * Le laisser dedans avec ses zéros le ferait gagner à 6 qui prend en partant
 * tôt, puisque le plus bas l'emporte ; le laisser franchir le seuil arrêterait
 * la soirée de ceux qui jouent encore.
 */
function effectifCourant(manches: readonly Manche[]): JoueurId[] {
  const attendus = manches.map((manche) => new Set(manche.participants));

  return sansDoublon(manches.flatMap((manche) => manche.participants)).filter((joueurId) =>
    attendus.every((manche) => manche.has(joueurId)),
  );
}

/**
 * Tous les joueurs que l'état doit **nommer** : l'effectif courant, puis — et
 * c'est toute la raison de ne pas s'arrêter à lui — ceux qui n'en sont plus et
 * ne portent qu'une case.
 *
 * Un participant retiré garde un total, il a joué : ses valeurs déjà saisies
 * restent, l'histoire est vraie et ne se réécrit pas. Il est simplement rangé
 * après ceux qui jouent encore, et il n'entre ni au classement ni dans le
 * franchissement.
 */
function tousLesJoueurs(manches: readonly Manche[], effectif: readonly JoueurId[]): JoueurId[] {
  const marqueurs = manches.flatMap((manche) => manche.cases.map((uneCase) => uneCase.joueurId));

  return sansDoublon([...effectif, ...marqueurs]);
}

/** Dédoublonne en gardant l'ordre de première apparition, qui est celui des `Map` rendues. */
function sansDoublon(joueurs: readonly JoueurId[]): JoueurId[] {
  return [...new Set(joueurs)];
}

/**
 * Additionne les points des manches reçues, tous les joueurs recensés partant de
 * zéro.
 *
 * Appelée deux fois par `evaluer`, sur deux jeux de manches différents : c'est
 * là, et nulle part ailleurs, que « les totaux lisent tout » et « la fin ne lit
 * que les manches closes » se séparent.
 */
function cumuler(
  regles: Regles,
  manches: readonly Manche[],
  joueurs: readonly JoueurId[],
): Map<JoueurId, number> {
  const totaux = new Map<JoueurId, number>(joueurs.map((joueurId) => [joueurId, 0]));

  for (const manche of manches) {
    for (const uneCase of manche.cases) {
      if (uneCase.valeur === null) {
        continue;
      }

      const acquis = totaux.get(uneCase.joueurId) ?? 0;
      totaux.set(uneCase.joueurId, acquis + marquer(regles, uneCase.valeur));
    }
  }

  return totaux;
}

/**
 * Ce qu'une valeur saisie **marque**, qui n'est pas toujours ce qui est entré.
 *
 * `entierParJoueur` et `sommeAuGagnant` saisissent déjà des points — le total
 * unique d'Uno est crédité au gagnant, donc à la case qui le porte. `podium` ne
 * saisit aucun nombre : la valeur y est un **rang**, `1` puis `2`, et c'est le
 * barème qui dit ce qu'il rapporte. Un rang hors du barème ne marque rien, ce
 * qui laisse un podium plus court que la table sans cas particulier.
 */
function marquer(regles: Regles, valeur: number): number {
  return regles.saisie.mode === "podium" ? (regles.saisie.jetons[valeur - PREMIER] ?? 0) : valeur;
}
