import type { ReactElement } from "react";
import { CatalogueListe } from "@/components/catalogue-liste";
import { LISTE } from "@/components/champs";
import { Ecran } from "@/components/ecran";
import { type EntreeCatalogue, type JeuId, trouverEntree } from "@/lib/jeux/catalogue";
import { horodatage } from "@/lib/journal/tiroir";
import { adresseDePartie } from "@/lib/partie/adresse";
import type { FiltreDHistorique, LigneDHistorique, VueDHistorique } from "@/lib/partie/historique";
import { adresseDeLaPageSuivante, adresseDeLHistorique } from "@/lib/partie/historique-url";

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
  const vide = vue.lignes.length === 0;
  const suite = vue.encore ? adresseDeLaPageSuivante(filtre) : null;
  // Rien à filtrer et aucun filtre posé : les onglets n'ouvriraient que
  // d'autres listes vides. Ils restent dès qu'un jeu est choisi — sans eux, on
  // serait coincé sur le seul jeu auquel on n'a pas encore fini de partie.
  const aFiltrer = !vide || filtre.jeuId !== null;

  return (
    <Ecran>
      <h1 className="font-semibold text-2xl tracking-tight">Historique</h1>

      {aFiltrer ? <FiltreParJeu entrees={entrees} choisi={filtre.jeuId} /> : null}

      {vide ? (
        <RenvoiAuCatalogue entrees={entrees} choisi={filtre.jeuId} />
      ) : (
        <ul className={LISTE}>
          {vue.lignes.map((une) => (
            <Ligne key={une.code} ligne={une} />
          ))}
        </ul>
      )}

      {suite === null ? null : <VoirPlus adresse={suite} />}
    </Ecran>
  );
}

/**
 * Le « voir plus » : **une page de plus, jamais une page numérotée**.
 *
 * À dix joueurs, l'historique entier tient sous le pouce, et une numérotation
 * demanderait de savoir où l'on va avant d'y aller. Le lien rallonge la liste et
 * reconduit le jeu choisi — dérouler n'est pas changer de filtre.
 *
 * Il n'apparaît que si `lireLHistorique` a vu une ligne de plus que demandé :
 * rien n'est compté pour l'afficher, et il ne promet donc jamais une suite vide.
 * L'adresse lui arrive toute faite, `adresseDeLaPageSuivante` ayant déjà dit
 * s'il en existe une — le plafond se lit là où il est déclaré, pas ici.
 */
function VoirPlus({ adresse }: { adresse: string }): ReactElement {
  return (
    <a href={adresse} className="text-muted-foreground text-sm underline">
      Voir plus
    </a>
  );
}

/**
 * L'état vide : **un renvoi au catalogue**, et pas un écran inventé pour lui.
 *
 * C'est déjà ce que l'accueil fait quand aucune partie ne tourne — rien n'a
 * encore été fini, et commencer une partie est à un appui. La même liste, pas
 * une seconde qui lui ressemble : deux catalogues divergeraient le jour où l'un
 * est corrigé seul.
 *
 * La phrase nomme le jeu quand c'est le filtre qui ne rend rien. « Aucune partie
 * n'est encore finie » sur un historique bien rempli où l'on vient de choisir
 * Uno serait faux, et ferait douter de la liste plutôt que du filtre.
 */
function RenvoiAuCatalogue({
  entrees,
  choisi,
}: {
  entrees: readonly EntreeFiltrable[];
  choisi: JeuId | null;
}): ReactElement {
  const sujet = choisi === null ? "Aucune" : `${trouverEntree(choisi).nom} : aucune`;

  return (
    <>
      <p className="text-muted-foreground text-sm">
        {`${sujet} partie n’est encore finie. On en commence une ?`}
      </p>
      <CatalogueListe entrees={entrees} />
    </>
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
 * Un `switch` sans repli, comme le `Record` exhaustif de la fiche : une
 * troisième cause ajoutée au schéma ne compilerait pas ici, là où un `if` sur
 * l'abandon l'aurait rendue en victoire sans rien dire.
 *
 * L'abandon est **marqué**, pas raconté : la fiche écrit « Partie abandonnée le
 * … » parce qu'elle a la place d'une phrase, la ligne porte une pastille parce
 * qu'elle doit se repérer en défilant. Deux formes pour deux écrans, et non une
 * constante recopiée — corriger la phrase de la fiche n'a aucune raison de
 * changer l'étiquette d'ici.
 */
function Denouement({ ligne }: { ligne: LigneDHistorique }): ReactElement {
  switch (ligne.cause) {
    case "abandonnee":
      return (
        <span className="flex items-center gap-2 text-muted-foreground text-sm">
          <span className="rounded-full bg-muted px-2 py-0.5 font-medium text-foreground text-xs">
            Abandonnée
          </span>
          {effectif(ligne.nombreDeJoueurs)}
        </span>
      );
    case "terminee":
      return (
        <span className="text-muted-foreground text-sm">
          {`${ligne.vainqueur === null ? "Égalité en tête" : `${ligne.vainqueur.nom} l’emporte`} · ${effectif(ligne.nombreDeJoueurs)}`}
        </span>
      );
  }
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
