import type { Etat, JoueurId } from "@/lib/jeux/moteur";
import type { JoueurConnu } from "@/lib/roster/noms";

/**
 * Le classement d'une partie finie, mis en **marches** : ce que l'écran de fin
 * montre, et rien de ce qui l'anime.
 *
 * Pur, et sans base : il ne reçoit que l'état du moteur et la tablée. C'est ce
 * qui laisse la règle « les ex æquo partagent la marche, et le rang suivant
 * saute » se vérifier sur des nombres plutôt que sur du balisage.
 */

/**
 * Une marche : le rang, ceux qui l'occupent, et le total qu'ils ont fait.
 *
 * `joueurs` au pluriel, toujours, et jamais un joueur avec une liste
 * d'ex æquo à côté : l'égalité n'est pas l'exception d'un cas normal, c'est la
 * forme de la donnée. Le moteur rend son classement en groupes de rang
 * précisément pour qu'un écran ne *puisse pas* afficher l'un des deux devant
 * l'autre.
 *
 * `total` est celui du groupe entier, ce qui n'est pas une approximation : les
 * groupes du moteur sont construits **par total**, donc ceux qui partagent une
 * marche partagent le nombre qui les y a mis.
 */
export type Marche = {
  rang: number;
  joueurs: readonly JoueurConnu[];
  total: number;
};

/** Le rang de la marche de tête — celle des vainqueurs, qu'ils soient un ou trois. */
const TETE = 1;

/**
 * Le nombre de places d'un podium, et le nombre de rangs qu'il montre.
 *
 * Trois, parce qu'un podium est un objet à trois marches et non une liste
 * tronquée : ce qui vient après se lit au classement complet, juste en dessous.
 */
export const PLACES_DU_PODIUM = 3;

/**
 * En deçà de cet effectif, les marches ne se dressent pas.
 *
 * Un podium suppose une **tablée moyenne**. À deux joueurs il resterait au
 * mieux une marche occupée et deux vides, ce qui ne se lit pas comme un podium
 * mais comme un podium cassé — et le critère du ticket est que l'écran reste
 * lisible, pas qu'il garde sa forme à tout prix. Le classement, lui, ne change
 * pas : il dit déjà qui l'emporte.
 */
export const TABLEE_MINIMALE_DU_PODIUM = 3;

/**
 * Range le classement du moteur en marches nommées.
 *
 * Le **rang saute** : il vaut un de plus que le nombre de joueurs déjà placés,
 * si bien que deux ex æquo au rang 1 laissent le rang 2 inoccupé et poussent le
 * suivant au rang 3. Ce n'est pas une règle ajoutée ici — c'est la seule lecture
 * possible des groupes de rang du moteur, et c'est pour ça qu'ils sont des
 * groupes.
 *
 * **Un joueur que la tablée ne porte pas ne figure nulle part.** Le moteur sort
 * déjà un participant retiré de son classement — son effectif est l'intersection
 * des manches — et la tablée affichée ne le porte pas non plus. Les deux
 * lectures disent la même chose, et les croiser ici est ce qui garantit qu'aucun
 * nom n'apparaisse sans place : le rang se compte sur les joueurs **nommés**,
 * jamais sur la taille brute des groupes.
 *
 * Une partie sans manche rend une liste vide, ce qui est une sortie et non un
 * cas limite : il n'y a pas de podium avant qu'on ait joué.
 */
export function marchesDuClassement(etat: Etat, tablee: readonly JoueurConnu[]): Marche[] {
  const marches: Marche[] = [];
  let places = 0;

  for (const groupe of etat.classement) {
    const joueurs = groupe.flatMap((joueurId) => {
      const connu = tablee.find((joueur) => joueur.id === joueurId);

      return connu === undefined ? [] : [connu];
    });

    const [premier] = joueurs;

    // Un groupe dont aucun joueur n'est de la tablée n'occupe pas de rang : il
    // ne laisse donc pas de trou derrière lui, et ne pousse personne plus bas.
    if (premier === undefined) {
      continue;
    }

    marches.push({
      rang: places + TETE,
      joueurs,
      total: etat.totaux.get(premier.id) ?? 0,
    });
    places += joueurs.length;
  }

  return marches;
}

/**
 * Ceux qui l'emportent : la marche de tête, entière.
 *
 * Plusieurs quand la tête est partagée, et c'est voulu — rien ne départage une
 * égalité, ici pas plus qu'ailleurs. C'est ce qui distingue cet écran de la
 * ligne d'historique, qui n'affiche de vainqueur que s'il est seul : là-bas une
 * ligne n'a de place que pour un nom, ici la marche les porte tous les deux.
 */
export function vainqueurs(marches: readonly Marche[]): readonly JoueurConnu[] {
  return marches[0]?.joueurs ?? [];
}

/**
 * Ce joueur-là est-il sur la marche de tête ?
 *
 * Accepte `null` parce que c'est ce que rend un appareil qui ne se déclare
 * personne, et que le distinguer d'un joueur inconnu ferait deux branches pour
 * une seule réponse. C'est la question que la fête pose pour décider de la
 * densité — voir `src/lib/partie/fete.ts`.
 */
export function estVainqueur(marches: readonly Marche[], joueurId: JoueurId | null): boolean {
  return joueurId !== null && vainqueurs(marches).some((joueur) => joueur.id === joueurId);
}

/**
 * Le podium se dresse-t-il ?
 *
 * Compte les joueurs **classés**, et non la tablée déclarée : c'est la même
 * chose une fois les participants retirés écartés, et partir du classement
 * évite d'avoir deux effectifs à garder d'accord.
 */
export function podiumSeDresse(marches: readonly Marche[]): boolean {
  return nombreDeClasses(marches) >= TABLEE_MINIMALE_DU_PODIUM;
}

/**
 * Les trois places du podium, dans l'ordre des rangs — vides ou occupées.
 *
 * Une place par **rang**, jamais par marche : la deuxième place accueille le
 * rang 2, et si une égalité l'a fait sauter, elle reste vide. C'est la règle
 * « les ex æquo partagent la marche et le rang suivant saute » rendue
 * *visible* — un podium qui tasserait les marches vers le haut montrerait deux
 * vainqueurs suivis d'un deuxième, ce qui est exactement le podium faux que les
 * groupes de rang existent pour interdire.
 *
 * Rend toujours {@link PLACES_DU_PODIUM} entrées : un composant qui itère
 * dessus dessine le même objet quelle que soit la partie, et n'a aucune place
 * à inventer.
 */
export function marchesDuPodium(marches: readonly Marche[]): (Marche | undefined)[] {
  return Array.from({ length: PLACES_DU_PODIUM }, (_, index) =>
    marches.find((marche) => marche.rang === index + TETE),
  );
}

/** Combien de joueurs le classement range vraiment, toutes marches confondues. */
function nombreDeClasses(marches: readonly Marche[]): number {
  return marches.reduce((total, marche) => total + marche.joueurs.length, 0);
}
