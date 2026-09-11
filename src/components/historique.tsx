import type { ReactElement } from "react";
import { LISTE } from "@/components/champs";
import { Ecran } from "@/components/ecran";
import type { EntreeCatalogue, JeuId } from "@/lib/jeux/catalogue";
import { horodatage } from "@/lib/journal/tiroir";
import { adresseDePartie } from "@/lib/partie/adresse";
import type { FiltreDHistorique, LigneDHistorique, VueDHistorique } from "@/lib/partie/historique";
import { adresseDeLHistorique } from "@/lib/partie/historique-url";

/**
 * Une entrée du catalogue **désignable par une adresse**.
 *
 * `EntreeCatalogue` déclare son `id` comme une chaîne quelconque — le schéma Zod
 * ne peut pas se référer au catalogue qu'il décrit — alors que le filtre en fait
 * un paramètre d'URL, et `adresseDeLHistorique` n'accepte qu'un id réellement
 * déclaré. L'intersection dit exactement cela, sans cast et sans revalider une
 * constante que le compilateur garde déjà.
 */
type EntreeFiltrable = EntreeCatalogue & { id: JeuId };

/**
 * L'historique : **les parties finies, la plus récente d'abord**.
 *
 * La liste qui mène aux fiches. Elle ne décide rien de ce qu'elle montre —
 * l'ordre, le filtre et le vainqueur sortent de `lireLHistorique`, et la page
 * n'est que du câblage entre les deux.
 */
export function Historique({
  vue,
  filtre,
  entrees,
}: {
  vue: VueDHistorique;
  /** Ce que l'adresse demandait : le filtre est montré tel qu'il a été lu. */
  filtre: FiltreDHistorique;
  entrees: readonly EntreeFiltrable[];
}): ReactElement {
  return (
    <Ecran>
      <h1 className="font-semibold text-2xl tracking-tight">Historique</h1>

      <FiltreParJeu entrees={entrees} choisi={filtre.jeuId} />

      <ul className={LISTE}>
        {vue.lignes.map((une) => (
          <Ligne key={une.code} ligne={une} />
        ))}
      </ul>
    </Ecran>
  );
}

/**
 * Le filtre : **par jeu, et rien d'autre**.
 *
 * Filtrer par joueur, c'est la fiche de joueur — deux entrées vers la même
 * liste demanderaient de choisir laquelle est la bonne avant d'avoir rien lu.
 *
 * Des liens et non un formulaire : l'état du filtre vit dans l'adresse, ce qui
 * la rend partageable et survit au retour arrière. C'est aussi ce qui laisse
 * l'écran entier être du rendu serveur, sans un état local à resynchroniser.
 *
 * Chaque lien repart de la **première page** : garder le `voir=60` déroulé pour
 * 6 qui prend ferait ouvrir soixante lignes d'Uno à qui change d'onglet.
 */
function FiltreParJeu({
  entrees,
  choisi,
}: {
  entrees: readonly EntreeFiltrable[];
  choisi: JeuId | null;
}): ReactElement {
  return (
    <nav aria-label="Filtrer par jeu" className="-mx-4 flex gap-2 overflow-x-auto px-4">
      <Onglet
        adresse={adresseDeLHistorique(null)}
        libelle="Tous les jeux"
        courant={choisi === null}
      />
      {entrees.map((entree) => (
        <Onglet
          key={entree.id}
          adresse={adresseDeLHistorique(entree.id)}
          libelle={entree.nom}
          courant={choisi === entree.id}
        />
      ))}
    </nav>
  );
}

/**
 * Un onglet du filtre.
 *
 * `aria-current` plutôt qu'une seule couleur : celui qu'on lit doit se savoir
 * autrement qu'à l'œil, et c'est la même information que le fond appuyé donne.
 */
function Onglet({
  adresse,
  libelle,
  courant,
}: {
  adresse: string;
  libelle: string;
  courant: boolean;
}): ReactElement {
  return (
    <a
      href={adresse}
      aria-current={courant ? "page" : undefined}
      className={`shrink-0 rounded-full px-3 py-1.5 text-sm ${courant ? "bg-foreground font-medium text-background" : "bg-muted text-muted-foreground"}`}
    >
      {libelle}
    </a>
  );
}

/**
 * Une ligne : le jeu, ce qu'il en est sorti, et quand.
 *
 * Quatre choses et pas cinq — la tablée complète et les scores sont sur la
 * fiche, où toute la ligne mène. C'est le lien qui porte la mise en page, et
 * non un bouton posé dedans : la cible d'un pouce est la ligne entière.
 */
function Ligne({ ligne }: { ligne: LigneDHistorique }): ReactElement {
  return (
    <li>
      <a
        href={adresseDePartie(ligne.code)}
        className="flex w-full flex-col gap-0.5 px-4 py-4 hover:bg-muted active:bg-muted"
      >
        <span className="font-medium text-base">{ligne.jeu.nom}</span>
        <Denouement ligne={ligne} />
        {/* L'horodatage du journal, et non un second formateur : c'est la même
            horloge de serveur, lue dans le même fuseau fixe. Deux mises en forme
            de la même date divergeraient le jour où l'une est corrigée. */}
        <time dateTime={ligne.finLe.toISOString()} className="text-muted-foreground text-xs">
          {horodatage(ligne.finLe)}
        </time>
      </a>
    </li>
  );
}

/**
 * Ce qui est sorti de la partie, et combien étaient à table.
 *
 * `vainqueur` est `null` pour **deux raisons différentes**, et les confondre
 * mentirait dans les deux sens : une partie abandonnée n'a pas de vainqueur
 * parce qu'elle s'est arrêtée, une partie terminée à égalité parce que le
 * moteur sort son classement en groupes de rang et qu'un groupe de deux ne se
 * départage nulle part. « Sans vainqueur » pour les deux laisserait croire à un
 * abandon là où il y a eu une partie entière.
 *
 * L'abandon est **marqué**, pas raconté : la fiche écrit « Partie abandonnée le
 * … » parce qu'elle a la place d'une phrase, la ligne porte une pastille parce
 * qu'elle doit se repérer en défilant. Deux formes pour deux écrans, et non une
 * constante recopiée — corriger la phrase de la fiche n'a aucune raison de
 * changer l'étiquette d'ici.
 */
function Denouement({ ligne }: { ligne: LigneDHistorique }): ReactElement {
  if (ligne.cause === "abandonnee") {
    return (
      <span className="flex items-center gap-2 text-muted-foreground text-sm">
        <span className="rounded-full bg-muted px-2 py-0.5 font-medium text-foreground text-xs">
          Abandonnée
        </span>
        {effectif(ligne.nombreDeJoueurs)}
      </span>
    );
  }

  return (
    <span className="text-muted-foreground text-sm">
      {`${ligne.vainqueur === null ? "Égalité en tête" : `${ligne.vainqueur.nom} l’emporte`} · ${effectif(ligne.nombreDeJoueurs)}`}
    </span>
  );
}

/**
 * Combien étaient à table, au singulier près.
 *
 * Aucune entrée du catalogue ne se joue à un, mais un participant **retiré** ne
 * compte pas : une tablée de deux dont l'un est parti se lit « 1 joueur », et
 * « 1 joueurs » ferait douter du chiffre plus que de la grammaire.
 */
function effectif(combien: number): string {
  return combien > 1 ? `${combien} joueurs` : `${combien} joueur`;
}
