import { type JoueurId, PREMIER, rangsDuPodium } from "@/lib/jeux/moteur";
import type { Regles } from "@/lib/jeux/regles";
import type { CaseDeManche } from "@/lib/manche/lecture";
import type { Tapee } from "@/lib/manche/pave";
import type { ValeurDeCase } from "@/lib/manche/saisie";
import type { JoueurConnu } from "@/lib/roster/noms";

/**
 * Les deux espèces de gestes qui décrivent les trois jeux.
 *
 * Une **désignation** nomme un joueur : « qui est sorti ? » à Uno, « premier ? »
 * et « deuxième ? » à Dnup. L'information est publique, toute la table l'a vue,
 * et une seule personne la pose. Une **valeur** est un nombre compté devant soi,
 * que la case concerne.
 *
 * Il n'y en a pas de troisième, et c'est ce qui laisse la passe avant se
 * distribuer **exactement quand il y a plus d'une valeur** — donc au seul 6 qui
 * prend.
 */
export type GesteAttendu =
  | { geste: "designation"; rang: number }
  | { geste: "valeur"; joueur: JoueurConnu };

/**
 * Ce que cette manche attend encore, dans l'ordre où la passe avant le demande.
 *
 * Tout part d'ici : par où la passe avant démarre, ce que le récapitulatif
 * nomme comme manquant, et — en creux — la complétude. Une seconde énumération
 * ailleurs proposerait un geste que le moteur n'attend pas, ou tairait celui
 * qui bloque la clôture.
 *
 * Ce n'est **pas** la complétude : `estComplete` est au moteur, et cette
 * fonction n'en est pas la source. Les deux se dérivent du même mode et de la
 * même case, ce qui suffit à les garder d'accord sans que l'une dépende de
 * l'autre — le moteur reste pur et ne connaît ni les noms ni les écrans.
 *
 * Les désignations sortent **dans l'ordre des rangs** : on ne nomme pas le
 * deuxième sorti avant le premier.
 */
export function gestesAttendus(regles: Regles, cases: readonly CaseDeManche[]): GesteAttendu[] {
  const { saisie } = regles;

  switch (saisie.mode) {
    case "entierParJoueur":
      return cases
        .filter((une) => une.valeur === null)
        .map((une) => ({ geste: "valeur", joueur: une.joueur }));

    case "sommeAuGagnant": {
      // La ligne **est** la désignation : le gagnant est celui qui en a une.
      const lignes = cases.filter((une) => une.touchee);

      if (lignes.length === 0) {
        return [{ geste: "designation", rang: PREMIER }];
      }

      // Toutes les lignes touchées, et pas seulement la première : deux
      // téléphones qui désignent deux joueurs au même instant écrivent deux
      // cases différentes, que la politique de conflit laisse passer par
      // construction. N'en lire qu'une ferait taire le récapitulatif sur une
      // manche que la clôture refuse pourtant.
      return lignes
        .filter((une) => une.valeur === null)
        .map((une) => ({ geste: "valeur", joueur: une.joueur }));
    }

    case "podium": {
      const tenus = new Set(cases.map((une) => une.valeur));

      return rangsDuPodium(saisie.jetons)
        .filter((rang) => !tenus.has(rang))
        .map((rang) => ({ geste: "designation", rang }));
    }
  }
}

/** Ce qu'une case accepte au pavé : le garde-fou anti-doigt-gras, pas une règle de jeu. */
export type Bornes = { min: number; max: number };

/**
 * Les bornes du **pavé**, ou `null` quand ce mode ne tape aucun chiffre.
 *
 * Deux modes sur trois portent un nombre compté devant soi — l'entier par
 * joueur à 6 qui prend, le total unique à Uno — et la même borne haute les
 * garde du doigt gras. Elle vaut 200 têtes de bœuf et 999 points : sur un
 * **total**, 500 refuserait des manches réelles.
 *
 * `podium` rend `null` : on y **désigne** des joueurs, les jetons sont un
 * résultat, et il n'y a aucune touche à borner. Ce `null` n'est donc pas un
 * refus mais une absence d'écran — la passe avant n'y ouvre jamais de pavé.
 */
export function bornesDeSaisie(regles: Regles): Bornes | null {
  const { saisie } = regles;

  return saisie.mode === "podium" ? null : { min: saisie.min, max: saisie.max };
}

/**
 * La case que **cet appareil** tape lui-même, si ce mode lui en fait taper une.
 *
 * C'est « démarrer sur soi », dit une fois pour les trois modes. À 6 qui prend,
 * chacun compte devant soi et sa case est toujours la sienne, **remplie
 * comprise** — corriger est le même geste que saisir, et sauter sa propre case
 * enverrait ailleurs quelqu'un qui vient précisément se corriger. À Uno, la
 * seule valeur de la manche est le total du sorti : elle n'est sienne que s'il
 * est le sorti. À Dnup, aucun nombre ne se tape, donc jamais.
 *
 * Rend `undefined` quand l'appareil ne se déclare personne, se déclare un
 * joueur qui n'est pas de la table, ou n'a rien à taper ici : les trois se
 * lisent pareil de la manche.
 */
export function caseQuiSeTape(
  regles: Regles,
  cases: readonly CaseDeManche[],
  joueurId: JoueurId | null,
): CaseDeManche | undefined {
  if (regles.saisie.mode === "podium") {
    return undefined;
  }

  const sienne = cases.find((une) => une.joueur.id === joueurId);

  if (sienne === undefined) {
    return undefined;
  }

  return regles.saisie.mode === "entierParJoueur" || sienne.touchee ? sienne : undefined;
}

/** Une désignation qui manque encore, nommée pour être lue. */
export type DesignationManquante = {
  rang: number;
  /** « Premier sorti », « Sorti », « Gagnant de la manche ». */
  libelle: string;
};

/**
 * Les désignations qui manquent, nommées.
 *
 * Le récapitulatif en fait des lignes : une case vide ne s'y nomme pas par le
 * joueur qu'elle concerne quand **personne n'est encore désigné** — il n'y a
 * pas de case, et dire « à saisir » de chacun des quatre perdants d'Uno
 * inventerait quatre gestes que la manche ne demande pas.
 */
export function designationsManquantes(
  regles: Regles,
  cases: readonly CaseDeManche[],
): DesignationManquante[] {
  return gestesAttendus(regles, cases)
    .filter((attendu) => attendu.geste === "designation")
    .map(({ rang }) => ({ rang, libelle: libelleDuRang(regles, rang) }));
}

/**
 * La question que l'écran de désignation pose.
 *
 * Une phrase et non un libellé de colonne : c'est un écran plein, qu'on
 * traverse debout, et « Deuxième sorti » posé seul au-dessus d'une liste de
 * noms se lit comme un titre plutôt que comme une question.
 */
export function questionDeDesignation(regles: Regles, rang: number): string {
  return regles.saisie.mode === "sommeAuGagnant"
    ? "Qui est sorti ?"
    : `${libelleDuRang(regles, rang)} ?`;
}

/**
 * Ce que la case du désigné portera, **tel que le formulaire l'envoie**.
 *
 * Deux modes, deux écritures de la même désignation : au podium c'est le
 * **rang** lui-même, à Uno c'est le **vide** — la ligne y est la désignation,
 * et le total se tape ensuite dans cette case-là. Le vide part donc en chaîne
 * vide, que la frontière d'écriture relit comme le vide qu'il est.
 */
export function valeurDeLaDesignation(regles: Regles, rang: number): Tapee {
  return regles.saisie.mode === "podium" ? String(rang) : "";
}

/**
 * Ceux qu'on peut encore nommer à ce rang.
 *
 * Ceux qui tiennent déjà un rang en sont sortis : personne n'est à la fois
 * premier et deuxième, et les laisser proposés inviterait à fabriquer une
 * manche que le moteur ne saurait pas lire.
 */
export function candidatsADesigner(
  regles: Regles,
  cases: readonly CaseDeManche[],
): readonly JoueurConnu[] {
  const { saisie } = regles;

  if (saisie.mode !== "podium") {
    return cases.map((une) => une.joueur);
  }

  const rangs = new Set(rangsDuPodium(saisie.jetons));

  return cases.filter((une) => !rangs.has(une.valeur ?? 0)).map((une) => une.joueur);
}

/** Une ligne du récapitulatif : un joueur, et ce que la manche porte pour lui. */
export type LigneDeRecapitulatif = {
  joueur: JoueurConnu;
  /**
   * Ce que sa case marque — un nombre, un rang, « à saisir » —, ou `null`
   * quand ce mode ne lui demande rien et ne lui a rien attribué.
   */
  marque: string | null;
  /** Cette ligne mène-t-elle au pavé ? Un rang ne se tape pas. */
  seTape: boolean;
};

/**
 * Le corps du récapitulatif, une ligne par participant.
 *
 * « À saisir » se lit des **gestes attendus** et jamais de la seule case vide :
 * les quatre perdants d'Uno ont une case vide sans que rien ne leur soit
 * demandé, et les nommer ferait croire la manche réparable là où elle est
 * complète. Une case vide dont aucun geste ne parle ne montre donc rien —
 * le total, lui, reste sur la ligne, parce qu'il vaut pour toute la partie.
 */
export function lignesDuRecapitulatif(
  regles: Regles,
  cases: readonly CaseDeManche[],
): LigneDeRecapitulatif[] {
  const attendus = new Set(
    gestesAttendus(regles, cases)
      .filter((attendu) => attendu.geste === "valeur")
      .map(({ joueur }) => joueur.id),
  );

  return cases.map((une) => ({
    joueur: une.joueur,
    marque: attendus.has(une.joueur.id) ? A_SAISIR : marqueDe(regles, une),
    seTape: caseQuiSeTape(regles, cases, une.joueur.id) !== undefined,
  }));
}

/**
 * Où un geste qu'on vient de poser renvoie.
 *
 * Les **désignations d'abord, puis les valeurs** : c'est la forme de la passe
 * avant, et elle ne tient que si une désignation enchaîne sur la suivante. À
 * Uno, nommer le sorti appelle son total — repasser par le récapitulatif entre
 * les deux ferait quatre gestes d'une manche qui en demande deux ; à Dnup, le
 * deuxième sorti suit le premier.
 *
 * Une **valeur**, elle, arrête la passe avant. À 6 qui prend, renvoyer à la
 * passe avant rouvrirait indéfiniment sa propre case, puisque c'est sur elle
 * qu'on démarre, remplie comprise — et « un écran, pas cinq » veut dire qu'on
 * ne pousse personne vers un deuxième.
 *
 * Rendre la **suite** et non une adresse : les adresses se fabriquent dans les
 * pages, qui seules connaissent le code de la partie.
 */
export function suiteDuGeste(regles: Regles, valeurPosee: ValeurDeCase): SuiteDuGeste {
  return estUneDesignation(regles, valeurPosee) ? "passeAvant" : "recapitulatif";
}

/** L'écran vers lequel un geste posé renvoie. */
export type SuiteDuGeste = "passeAvant" | "recapitulatif";

/**
 * Ce geste-là **nomme-t-il quelqu'un**, plutôt que de poser un nombre compté
 * devant soi ?
 *
 * Deux modes, deux écritures de la même désignation : au podium **toute**
 * écriture en est une, puisque la colonne n'y porte qu'un rang ; à Uno, c'est
 * le vide qui désigne, le total qui suit étant une valeur. À 6 qui prend, le
 * vide ne s'écrit pas — la frontière d'écriture le refuse — donc jamais.
 */
function estUneDesignation(regles: Regles, valeurPosee: ValeurDeCase): boolean {
  return regles.saisie.mode === "podium" || valeurPosee === null;
}

/**
 * Ce qu'une valeur de case **veut dire**, mise en mots selon le mode.
 *
 * La colonne `valeur` ne porte pas la même chose partout : des points à 6 qui
 * prend et à Uno, un **rang** au podium. L'afficher nue écrirait « Marie : 1 »
 * là où Marie est première, ce qu'un total de un jeton contredirait sur la même
 * ligne.
 *
 * Le vide se **nomme** plutôt que de se rendre en blanc : c'est un état du
 * domaine — la désignation d'Uno avant son total — et non une absence
 * d'information.
 */
export function valeurEnMots(regles: Regles, valeur: ValeurDeCase): string {
  if (valeur === null) {
    return VIDE;
  }

  return regles.saisie.mode === "podium" ? enRang(valeur) : String(valeur);
}

/**
 * Le mot du vide, un seul, pour que deux écrans le disent pareil.
 *
 * Exporté pour le tiroir du journal, qui montre les mêmes valeurs de case sans
 * connaître le mode : une case vide y est un état — la désignation d'Uno avant
 * son total — et non une absence d'information.
 */
export const VIDE = "vide";

/**
 * Ce qu'une case attendue affiche tant qu'elle n'a rien reçu.
 *
 * Exporté parce que le récapitulatif met cette marque-là en gris plutôt qu'en
 * chiffres : recopier le mot là-bas le ferait dériver le jour où l'un des deux
 * est corrigé seul, et l'écart ne se verrait qu'à l'écran.
 */
export const A_SAISIR = "à saisir";

/** Ce que la ligne montre quand la case porte quelque chose, ou rien du tout. */
function marqueDe(regles: Regles, une: CaseDeManche): string | null {
  return une.valeur === null ? null : valeurEnMots(regles, une.valeur);
}

/**
 * Les ordinaux qu'un podium sait nommer, et rien au-delà.
 *
 * Les deux barèmes du catalogue s'arrêtent à deux rangs ; un troisième se
 * nommerait « 3e », ce que le repli couvre sans prétendre en connaître le mot
 * long.
 */
const ORDINAUX: Record<number, { court: string; long: string }> = {
  1: { court: "1er", long: "Premier" },
  2: { court: "2e", long: "Deuxième" },
};

function enRang(rang: number): string {
  return ORDINAUX[rang]?.court ?? `${rang}e`;
}

/**
 * Le nom d'un rang à désigner, qui dépend de ce que le barème compte.
 *
 * Un podium à **un seul rang** n'a pas de premier : c'est Dnup à deux joueurs,
 * où poser sa dernière carte gagne la manche sur-le-champ, et où « premier
 * sorti » laisserait attendre un deuxième qui n'existe pas. Uno n'a pas de rang
 * non plus — il a un sorti.
 */
function libelleDuRang(regles: Regles, rang: number): string {
  const { saisie } = regles;

  if (saisie.mode !== "podium") {
    return "Sorti";
  }

  if (saisie.jetons.length === 1) {
    return "Gagnant de la manche";
  }

  return `${ORDINAUX[rang]?.long ?? `${rang}e`} sorti`;
}
