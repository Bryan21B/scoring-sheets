import type { CSSProperties, ReactElement } from "react";
import { TRAIT } from "@/components/champs";
import type { JoueurId } from "@/lib/jeux/moteur";
import type { JoueurConnu } from "@/lib/roster/noms";

/**
 * Les six couleurs de joueur du kit, dans l'ordre où elles se distribuent.
 *
 * Des variables CSS et non des valeurs en dur : chacune a son équivalent en
 * mode sombre, et une couleur écrite ici serait la même sur les deux fonds —
 * donc illisible sur l'un des deux.
 *
 * Six, parce que le kit en fixe six et dit « puis on recycle ». Une septième
 * teinte inventée pour une tablée de sept serait une couleur que le design
 * system ne porte pas, et qui ne tiendrait ni le contraste ni la famille.
 */
export const COULEURS_DE_JOUEUR = [
  "var(--joueur-1)",
  "var(--joueur-2)",
  "var(--joueur-3)",
  "var(--joueur-4)",
  "var(--joueur-5)",
  "var(--joueur-6)",
] as const;

/** Ce qu'une pastille montre quand le nom ne donne pas d'initiale. */
const SANS_INITIALE = "—";

/**
 * La couleur de ce joueur **à cette place** — colonne de la grille, ligne de la
 * tablée, marche du podium.
 *
 * Elle suit l'**index** et non l'identité du joueur. Une couleur stable d'une
 * partie à l'autre demanderait de la stocker, donc une colonne et une
 * migration, pour une propriété que personne ne peut observer : deux parties ne
 * se lisent jamais côte à côte. Ce qui compte est que dans une partie donnée,
 * la colonne de Paul et la marche de Paul soient de la même couleur — et cela,
 * l'index le donne, la tablée étant lue dans le même ordre partout.
 *
 * Le modulo est pris sur l'entier absolu : un index aberrant — négatif, issu
 * d'un calcul de position — rend une couleur du kit plutôt qu'`undefined`, qui
 * produirait une pastille transparente qu'aucun type ne signale.
 */
export function couleurDeJoueur(index: number): string {
  const place = Math.abs(Math.trunc(index)) % COULEURS_DE_JOUEUR.length;

  return COULEURS_DE_JOUEUR[place] ?? COULEURS_DE_JOUEUR[0];
}

/**
 * Où chacun est assis, pour que sa couleur le suive.
 *
 * La feuille de score range par tablée, le classement par rang, le
 * récapitulatif par ce qui manque. Trois ordres, et une seule couleur par
 * joueur : c'est cette table qui les réconcilie, en fixant la place **une
 * fois**, dans l'ordre de la tablée, pour que tous les écrans la relisent.
 *
 * Sans elle, la colonne de Paul serait lagon dans la grille et raisin dans le
 * classement — sur la fiche d'une partie, qui montre les deux, à dix
 * centimètres l'une de l'autre.
 *
 * La **première** place gagne si un joueur apparaît deux fois : la tablée fait
 * autorité, et un doublon venu d'ailleurs — un parti recollé à la liste — ne
 * doit pas lui reprendre sa couleur.
 */
export function placesDeLaTablee(joueurs: readonly JoueurConnu[]): ReadonlyMap<JoueurId, number> {
  const places = new Map<JoueurId, number>();

  for (const [place, joueur] of joueurs.entries()) {
    if (!places.has(joueur.id)) {
      places.set(joueur.id, place);
    }
  }

  return places;
}

/**
 * La pastille d'un joueur : **son aplat, et son initiale dedans**.
 *
 * L'initiale n'est pas décorative. La couleur seule exclut ceux qui ne
 * distinguent pas les teintes — et une feuille de score dont les colonnes ne se
 * distinguent que par leur couleur ne se lit alors plus du tout. C'est aussi
 * pourquoi le composant prend un **nom** et non une couleur : on ne peut pas
 * l'appeler sans avoir de quoi écrire l'initiale.
 *
 * Elle est `aria-hidden` parce qu'elle ne s'écrit jamais seule : partout où
 * elle apparaît, le nom complet est à côté, et un lecteur d'écran annoncerait
 * sinon « M Marie ».
 */
export function Pastille({
  nom,
  index,
  className = "",
}: {
  nom: string;
  /** La place du joueur dans la tablée, d'où sort sa couleur. */
  index: number;
  className?: string;
}): ReactElement {
  const initiale = nom.trim().slice(0, 1).toUpperCase() || SANS_INITIALE;
  const style: CSSProperties = { backgroundColor: couleurDeJoueur(index) };

  return (
    <span
      aria-hidden="true"
      style={style}
      className={`inline-flex size-7 shrink-0 items-center justify-center rounded-full ${TRAIT} font-mono font-bold text-[0.8rem] text-foreground ${className}`}
    >
      {initiale}
    </span>
  );
}
