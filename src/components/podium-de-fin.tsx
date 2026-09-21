import type { ReactElement } from "react";
import { type Action, TRAIT } from "@/components/champs";
import { Pastille } from "@/components/pastille";
import { Button } from "@/components/ui/button";
import type { EntreeCatalogue } from "@/lib/jeux/catalogue";
import type { JoueurId } from "@/lib/jeux/moteur";
import { type Marche, marchesDuPodium, podiumSeDresse } from "@/lib/partie/podium";

/**
 * Ce qu'une marche inoccupée montre : un trou, comme la case vide de la grille.
 *
 * Exportée pour que le test cherche **ce caractère-là** et non une copie qui
 * dériverait le jour où l'un des deux est corrigé seul.
 *
 * Elle est **dessinée et non escamotée** — c'est ce qui rend visible le rang
 * qu'une égalité a fait sauter. Un podium qui tasserait ses marches vers le
 * haut montrerait deux vainqueurs suivis d'un deuxième, exactement le podium
 * faux que les groupes de rang existent pour interdire.
 */
export const PLACE_VACANTE = "—";

/**
 * L'ordre **visuel** des trois places : le premier au milieu, sur la marche
 * haute, comme un podium se regarde.
 *
 * Posé en classes d'ordre plutôt qu'en réordonnant la liste : le balisage reste
 * dans l'ordre des rangs, si bien qu'un lecteur d'écran lit « premier, deuxième,
 * troisième » là où l'œil voit deuxième, premier, troisième. Les deux lectures
 * sont justes, et c'est la seule façon de les avoir toutes les deux.
 *
 * Écrites en toutes lettres, jamais assemblées : Tailwind lit le source, et une
 * classe construite à l'exécution n'existerait pas dans la feuille produite.
 */
const ORDRE_VISUEL = ["order-2", "order-1", "order-3"] as const;

/** La hauteur de chaque marche, dans l'ordre des rangs : la tête est la plus haute. */
const HAUTEUR_DE_MARCHE = ["h-33", "h-22", "h-15"] as const;

/**
 * La couleur d'une marche, dans l'ordre des rangs.
 *
 * **Par le rang, et non par le joueur** — contrairement à la colonne de la
 * grille et à la ligne du classement. C'est le seul endroit où la règle
 * s'inverse, et pour une raison de domaine : une marche peut porter deux noms.
 * Un rang partagé n'a pas de couleur de joueur à prendre, et en choisir une des
 * deux rangerait silencieusement Marie devant Paul.
 *
 * La troisième marche reste neutre : elle est souvent vide, et une marche vide
 * de la couleur d'un aplat se lirait comme occupée.
 */
const COULEUR_DE_MARCHE = ["bg-primary", "bg-lagon", "bg-muted"] as const;

/**
 * Un rang **dit à la française** : premier, puis les ordinaux courts.
 *
 * Écrit à la main et non par `Intl.PluralRules` : la sortie de celui-ci varie
 * d'une version d'ICU à l'autre, et un écran dont le texte dépend du runtime
 * n'est pas vérifiable — même raison qu'au pourcentage du palmarès.
 */
function rangEnMots(rang: number): string {
  return rang === 1 ? "1er" : `${rang}e`;
}

/**
 * Les noms d'une marche, en une phrase.
 *
 * « Marie et Paul » sur une seule ligne, parce que l'égalité n'est pas deux
 * résultats voisins mais **un seul rang partagé** : les séparer les rangerait
 * l'un devant l'autre, ce que rien ne départage.
 */
function nomsDeLaMarche(marche: Marche): string {
  const noms = marche.joueurs.map(({ nom }) => nom);

  return noms.length === 1 ? (noms[0] ?? "") : `${noms.slice(0, -1).join(", ")} et ${noms.at(-1)}`;
}

/**
 * L'écran de fin d'une partie **régulièrement terminée** : le podium, puis le
 * classement complet, puis la sortie.
 *
 * **Il compose avec la fiche, il ne la remplace pas.** Rouvrir le lien trois
 * jours plus tard donne le même écran moins les confettis : le podium est ce à
 * quoi une partie finie *ressemble*, pas un interstitiel qu'on traverse une
 * fois. La feuille de score reste juste en dessous, et c'est elle qui porte le
 * détail manche par manche.
 *
 * **Il ne décide rien du classement.** Les marches arrivent faites, de
 * `marchesDuClassement` : les ex æquo y partagent déjà leur rang et le suivant
 * y saute déjà. Ce composant les dessine, et une seconde lecture des groupes de
 * rang écrite ici divergerait de celle-là le jour où l'une est corrigée seule.
 *
 * **Le podium ne se dresse pas à deux joueurs**, et le classement ne bouge pas
 * pour autant : c'est `podiumSeDresse` qui tranche, sur le nombre de classés, et
 * l'écran reste lisible sans ses trois marches — il dit déjà qui l'emporte.
 *
 * Une partie **abandonnée** ne passe jamais par ici : elle n'a pas de vainqueur,
 * c'est la même décision de domaine que l'historique qui n'en nomme aucun, et sa
 * fiche reste celle qu'elle a toujours eue.
 */
export function PodiumDeFin({
  marches,
  places,
  unite,
  rejouer,
}: {
  marches: readonly Marche[];
  /**
   * Où chacun est assis, d'où sort sa couleur — voir `placesDeLaTablee`.
   *
   * Passée et non dérivée du classement : la fiche d'une partie montre le
   * classement **et** la feuille de score, et les deux doivent colorer Paul
   * pareil. Le classement range par rang, la feuille par tablée ; seule la
   * tablée fait autorité.
   */
  places: ReadonlyMap<JoueurId, number>;
  /** L'unité du jeu, pour dire ce que les totaux comptent — têtes de bœuf, points. */
  unite: EntreeCatalogue["unite"];
  /**
   * « Rejouer la même tablée », ou rien.
   *
   * `undefined` pour qui regarde sans avoir joué : `rejouerLaTablee` refuse le
   * passant côté serveur, et un bouton mort ne ferait que faire douter de
   * l'application plutôt que du geste.
   */
  rejouer: Action | undefined;
}): ReactElement {
  return (
    <section className="flex flex-col gap-6">
      {podiumSeDresse(marches) ? <Marches marches={marches} /> : null}

      <Classement marches={marches} places={places} unite={unite} />

      {rejouer === undefined ? null : (
        <form action={rejouer} method="post">
          <Button type="submit" size="lg" className="w-full">
            Rejouer la même tablée
          </Button>
        </form>
      )}
    </section>
  );
}

/**
 * Les trois marches, vides ou occupées.
 *
 * Toujours trois : {@link marchesDuPodium} rend une place par rang, si bien que
 * ce composant n'a aucune place à inventer ni à compter.
 */
function Marches({ marches }: { marches: readonly Marche[] }): ReactElement {
  return (
    <ol aria-label="Podium" className="flex items-end justify-center gap-2">
      {placesDuPodium(marches).map(({ rang, marche, ordre, hauteur, couleur }) => (
        <li key={rang} className={`flex w-28 flex-col items-center gap-2 ${ordre}`}>
          <span
            className={`text-center text-sm ${
              marche === undefined ? "text-muted-foreground" : "font-semibold"
            }`}
          >
            {marche === undefined ? PLACE_VACANTE : nomsDeLaMarche(marche)}
          </span>
          {/* Cerclée sur trois côtés : une marche est posée sur le sol du
              podium, pas flottante au-dessus de lui. */}
          <span
            className={`flex w-full items-center justify-center rounded-t-lg border-b-0 font-bold font-mono text-xl ${TRAIT} ${couleur} ${hauteur}`}
          >
            {rangEnMots(rang)}
          </span>
        </li>
      ))}
    </ol>
  );
}

/**
 * Les trois places, chacune avec son **rang** plutôt qu'avec son indice.
 *
 * Le rang est l'identité d'une place — c'est lui qui la nomme et lui qui la
 * clé —, et une marche vide en a un tout autant qu'une marche occupée : c'est
 * même tout ce qu'elle a. Le tour de liste séparé existe pour que le rang soit
 * une donnée avant d'être une position, et non l'indice d'un rendu.
 */
function placesDuPodium(marches: readonly Marche[]): {
  rang: number;
  marche: Marche | undefined;
  ordre: string;
  hauteur: string;
  couleur: string;
}[] {
  return marchesDuPodium(marches).map((marche, index) => ({
    rang: index + 1,
    marche,
    ordre: ORDRE_VISUEL[index] ?? "",
    hauteur: HAUTEUR_DE_MARCHE[index] ?? "",
    couleur: COULEUR_DE_MARCHE[index] ?? "",
  }));
}

/**
 * Le classement complet, sous les marches.
 *
 * Il porte **tout le monde**, là où le podium s'arrête à trois places : c'est
 * lui qui répond à « et moi, j'ai fini où ? », et c'est aussi le seul écran de
 * fin qui reste quand le podium ne se dresse pas.
 */
function Classement({
  marches,
  places,
  unite,
}: {
  marches: readonly Marche[];
  places: ReadonlyMap<JoueurId, number>;
  unite: EntreeCatalogue["unite"];
}): ReactElement {
  return (
    <div className="flex flex-col gap-2">
      {/* Des lignes détachées et non une liste continue : chaque rang est un
          résultat, et le kit les pose comme des cartons posés côte à côte. */}
      <ol aria-label="Classement" className="flex flex-col gap-2">
        {marches.map((marche) => (
          <li
            key={marche.rang}
            className={`flex items-center gap-3 rounded-md bg-card px-3.5 py-2.5 ${TRAIT}`}
          >
            <span className="w-9 shrink-0 font-bold font-mono text-[13px]">
              {rangEnMots(marche.rang)}
            </span>
            <span className="flex shrink-0 gap-1">
              {marche.joueurs.map((joueur) => (
                <Pastille
                  key={joueur.id}
                  nom={joueur.nom}
                  index={places.get(joueur.id) ?? marche.rang - 1}
                />
              ))}
            </span>
            <span className="grow font-semibold text-base">{nomsDeLaMarche(marche)}</span>
            <span className="font-bold font-mono text-[22px] tabular-nums">{marche.total}</span>
          </li>
        ))}
      </ol>

      <p className="text-muted-foreground text-sm">{`Totaux en ${unite.plusieurs}.`}</p>
    </div>
  );
}
