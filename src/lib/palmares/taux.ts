import type { JoueurId } from "@/lib/jeux/moteur";
import type { JoueurConnu } from "@/lib/roster/noms";

/**
 * La part **pure** du palmarès : la formule, le plancher, l'ordre.
 *
 * Rien ici ne touche la base. C'est ce qui laisse la formule se vérifier sur des
 * vecteurs de rangs écrits à la main — un classement à six, une tête à égalité —
 * là où une vérification passant par une partie réelle demanderait de fabriquer
 * six soirées pour tester une division. La lecture qui produit ces vecteurs est
 * dans `palmares/lecture.ts`, les nombres se mettent en mots dans
 * `palmares/mots.ts`, et l'écran n'importe que ces deux-là.
 */

/**
 * Le plancher de parties sous lequel un joueur reste **hors classement**.
 *
 * Cinq, et non trois. Le design doc nomme trois comme le nombre qui « ne veut
 * rien dire » : un plancher à trois ou quatre le frôlerait sans rien changer.
 * Cinq laisse une marge réelle au-dessus de ce nombre-là tout en restant
 * atteignable dans la saison — la recherche classement compte 7 à 9 parties par
 * joueur et par an, donc cinq se franchit en quelques mois de soirées, pas en
 * trois ans.
 *
 * Un plancher, pas une marche à dépasser : cinq parties **classent**.
 */
export const PLANCHER_DE_PARTIES = 5;

/**
 * Le taux de victoires normalisé d'un joueur sur **une** partie, ou `null`.
 *
 * `(battus + 0,5 × ex æquo) / (n − 1)` — la **proportion d'adversaires battus**,
 * l'égalité valant une demi-victoire. C'est ce qu'un simple compte de victoires
 * ne dit pas : troisième de six a battu trois personnes, dernier de deux n'en a
 * battu aucune, et seule une proportion range les deux sur la même échelle.
 *
 * Le classement arrive en **groupes de rang** tel que le moteur le sort : les
 * battus sont tout ce qui vient dans les groupes **strictement moins bons**, les
 * ex æquo sont le reste du groupe du joueur. Rien ne départage à l'intérieur
 * d'un groupe, ici pas plus qu'ailleurs.
 *
 * `null` **deux fois plutôt qu'une**, et les deux comptent :
 *
 * - Le joueur n'est **pas au classement**. Un participant retiré n'y figure
 *   pas — c'est l'effectif courant du moteur qui l'en sort — donc il n'entre pas
 *   dans le vecteur de rangs, et cette partie n'est pas la sienne.
 * - Il n'y a **qu'un joueur classé**, ou aucun. `n − 1` vaut zéro : il n'existe
 *   pas d'adversaire, donc pas de proportion d'adversaires battus. Rendre 1
 *   offrirait un sans-faute à qui est resté seul à table, rendre 0 le lui
 *   retirerait — les deux inventent un résultat que la partie n'a pas produit.
 *
 * Un `null` n'est jamais moyenné : c'est une partie de moins, pas un zéro.
 */
export function tauxDUnePartie(
  classement: readonly (readonly JoueurId[])[],
  joueurId: JoueurId,
): number | null {
  const rang = classement.findIndex((groupe) => groupe.includes(joueurId));
  const groupe = classement[rang];

  if (groupe === undefined) {
    return null;
  }

  const classes = classement.reduce((total, un) => total + un.length, 0);

  if (classes < 2) {
    return null;
  }

  const battus = classement.slice(rang + 1).reduce((total, un) => total + un.length, 0);

  return (battus + (groupe.length - 1) / 2) / (classes - 1);
}

/**
 * Ce qu'un joueur apporte au palmarès : **un taux par partie**, jamais une
 * moyenne déjà faite.
 *
 * La moyenne se fait ici, au moment d'ordonner, parce que c'est le même endroit
 * qui compte les parties — et un joueur dont le nombre de parties et le taux
 * viendraient de deux calculs pourrait afficher une moyenne sur un effectif
 * qu'elle n'a pas.
 */
export type TauxDUnJoueur = {
  joueur: JoueurConnu;
  /** Un taux par partie terminée où il figure au classement. Vide se lit zéro partie. */
  taux: readonly number[];
};

/** Un joueur classé : son rang, son taux moyen, et sur combien de parties. */
export type JoueurClasse = {
  joueur: JoueurConnu;
  /**
   * Le rang, à partir de 1. Deux joueurs au même taux le **partagent**, et le
   * rang suivant est sauté — un groupe de deux occupe une marche.
   */
  rang: number;
  taux: number;
  parties: number;
};

/**
 * Un joueur hors classement : **ni rang, ni taux**, seulement ce qui manque.
 *
 * Le type est la garantie, et pas une consigne de mise en page : un taux sur
 * deux parties ne veut rien dire, et une ligne qui n'en porte pas est une ligne
 * qu'aucun écran ne peut en faire afficher un par mégarde.
 */
export type JoueurHorsClassement = {
  joueur: JoueurConnu;
  parties: number;
};

/**
 * Le palmarès tel qu'un écran le reçoit : les classés, les autres, et le
 * plancher qui sépare les deux.
 *
 * `plancher` voyage avec la vue pour que l'écran dise la raison — « moins de
 * cinq parties » — sans recopier le nombre. Deux copies divergeraient le jour où
 * l'une est corrigée seule, et la phrase affichée serait alors fausse sans que
 * rien ne proteste.
 */
export type VueDePalmares = {
  classes: readonly JoueurClasse[];
  horsClassement: readonly JoueurHorsClassement[];
  plancher: number;
};

/**
 * L'écart en deçà duquel deux taux sont **le même taux**.
 *
 * Une moyenne de rationnels en binaire ne retombe pas sur le même flottant selon
 * l'ordre des parties : `0,1 + 0,2` ne fait pas `0,3`. Sans ce seuil, deux
 * joueurs qui ont exactement les mêmes résultats se départageraient sur le
 * dernier bit d'un double, ce qui est précisément le genre de podium faux que le
 * classement en groupes de rang existe pour interdire.
 */
const MEME_TAUX = 1e-9;

/**
 * Range les joueurs : les classés par taux décroissant, les autres en dessous.
 *
 * **Tout le roster passe par ici**, y compris qui n'a fini aucune partie. Un
 * palmarès dont tout le monde est sous le plancher n'est pas un état vide, c'est
 * un palmarès honnête, et faire disparaître un joueur de la liste où l'on vient
 * chercher son nom serait la seule sortie franchement mauvaise.
 *
 * Les hors classement sont ordonnés par **nombre de parties décroissant** : ils
 * n'ont pas de rang, mais « il lui manque une partie » et « elle n'a pas encore
 * joué » ne sont pas la même situation, et c'est la seule chose que leur groupe
 * a à dire. À nombre de parties égal, le nom — un ordre arbitraire mais stable,
 * pour qu'un rechargement ne rebatte pas la liste.
 */
export function ordonnerLePalmares(joueurs: readonly TauxDUnJoueur[]): VueDePalmares {
  const classes: JoueurMoyenne[] = [];
  const horsClassement: JoueurHorsClassement[] = [];

  for (const { joueur, taux } of joueurs) {
    if (taux.length < PLANCHER_DE_PARTIES) {
      horsClassement.push({ joueur, parties: taux.length });
      continue;
    }

    classes.push({
      joueur,
      taux: taux.reduce((total, un) => total + un, 0) / taux.length,
      parties: taux.length,
    });
  }

  classes.sort(
    (un, autre) =>
      autre.taux - un.taux ||
      autre.parties - un.parties ||
      un.joueur.nom.localeCompare(autre.joueur.nom, "fr"),
  );
  horsClassement.sort(
    (un, autre) =>
      autre.parties - un.parties || un.joueur.nom.localeCompare(autre.joueur.nom, "fr"),
  );

  return { classes: numeroter(classes), horsClassement, plancher: PLANCHER_DE_PARTIES };
}

/**
 * Un joueur au-dessus du plancher, sa moyenne faite mais **pas encore rangé**.
 *
 * Le rang manque parce qu'il n'existe pas avant l'ordre : il se lit dans la
 * liste triée, jamais dans une ligne isolée. Le type dit donc l'étape, et c'est
 * ce qui évite un rang provisoire posé à zéro que rien n'obligerait à remplacer.
 */
type JoueurMoyenne = Omit<JoueurClasse, "rang">;

/**
 * Pose les rangs sur une liste **déjà ordonnée**, l'égalité partagée.
 *
 * Le rang d'une ligne est sa position, pas son numéro d'ordre : après deux
 * premiers ex æquo vient un troisième, jamais un second. C'est la même règle que
 * le classement d'une partie, où un groupe de deux occupe une marche.
 */
function numeroter(ordonnes: readonly JoueurMoyenne[]): JoueurClasse[] {
  let rang = 0;
  let precedent: number | undefined;

  return ordonnes.map((ligne, position) => {
    if (precedent === undefined || Math.abs(precedent - ligne.taux) > MEME_TAUX) {
      rang = position + 1;
      precedent = ligne.taux;
    }

    return { ...ligne, rang };
  });
}
