import type { ReactElement, ReactNode } from "react";
import { CatalogueListe } from "@/components/catalogue-liste";
import type { Action } from "@/components/champs";
import { Ecran } from "@/components/ecran";
import { GrilleDeScore } from "@/components/grille-score";
import { MancheSuivante } from "@/components/manche-suivante";
import { RejoindreParCode } from "@/components/rejoindre-par-code";
import type { EntreeCatalogue } from "@/lib/jeux/catalogue";
import type { VueDeGrille } from "@/lib/manche/lecture";
import type { VueDePartie } from "@/lib/partie/lecture";
import { libelleDeFin } from "@/lib/partie/tablee";

/** La soirée que l'accueil montre : la partie, sa feuille, et le geste suivant. */
export type EnCours = {
  partie: VueDePartie;
  grille: VueDeGrille;
  ouvrirLaMancheSuivante: Action;
};

/**
 * **L'accueil est la partie en cours.**
 *
 * Tant que rien ne tourne, la première question d'une soirée est « on joue à
 * quoi ? », et le catalogue prend tout l'écran pour y répondre. Dès qu'une
 * partie est ouverte, cette question est réglée : ce qu'on vient chercher
 * trente fois dans la soirée, c'est le score et le bouton pour saisir la manche
 * suivante. Commencer une partie passe donc au second rang.
 *
 * Deux coûts sont assumés, et ils ne sont pas des oublis :
 *
 * - **Le catalogue disparaît de la vue** tant qu'une partie tourne. Il reste à
 *   un appui, sous un `details` — le supprimer de la page laisserait la
 *   création sans porte, puisqu'il n'y a pas d'autre écran d'où ouvrir une
 *   partie.
 * - **Une deuxième partie en cours n'est pas ici.** Elle se retrouve par son
 *   code, et c'est pourquoi « on t'a donné un code ? » reste sous la partie
 *   plutôt que de disparaître avec le catalogue.
 *
 * La grille ne s'affiche **qu'une fois une manche ouverte** : avant, il n'y a
 * rien à montrer qu'un tableau de tirets, et c'est la salle d'attente de la
 * page de partie qui a quelque chose à dire.
 *
 * Le poll est passé **par la page** et non construit ici : c'est un composant
 * client, et le rendre depuis ce composant-ci empêcherait de vérifier tout le
 * reste sur le balisage produit.
 */
export function Accueil({
  entrees,
  enCours,
  poll,
}: {
  entrees: readonly EntreeCatalogue[];
  enCours: EnCours | null;
  /** `<PollDePartie>` quand une partie tourne, rien sinon. Voir plus haut. */
  poll?: ReactNode;
}): ReactElement {
  if (enCours === null) {
    return (
      <Ecran>
        <h1 className="font-semibold text-2xl tracking-tight">On joue à quoi ?</h1>
        <CatalogueListe entrees={entrees} />
        <RejoindreParCode />
      </Ecran>
    );
  }

  const { partie, grille } = enCours;

  return (
    <Ecran>
      <div className="flex flex-col gap-1">
        <h1 className="font-semibold text-2xl tracking-tight">{partie.jeu.nom}</h1>
        <p className="text-muted-foreground text-sm">
          {`On s’arrête à ${libelleDeFin(partie.regles.fin, partie.jeu.unite)} · code ${partie.code}`}
        </p>
      </div>

      <GrilleDeScore partie={partie} grille={grille} />

      <MancheSuivante action={enCours.ouvrirLaMancheSuivante} />

      <a href={`/p/${partie.code}`} className="text-muted-foreground text-sm underline">
        La partie, sa tablée et son code
      </a>

      <details className="flex flex-col gap-4">
        <summary className="cursor-pointer text-muted-foreground text-sm">
          Ouvrir une autre partie
        </summary>
        <div className="flex flex-col gap-6 pt-4">
          <CatalogueListe entrees={entrees} />
          <RejoindreParCode />
        </div>
      </details>

      {poll}
    </Ecran>
  );
}
