import type { ReactElement, ReactNode } from "react";
import type { Action } from "@/components/champs";
import { Ecran } from "@/components/ecran";
import { GrilleDeScore } from "@/components/grille-score";
import { MancheSuivante } from "@/components/manche-suivante";
import { PartieEntete } from "@/components/partie-entete";
import { SalleDAttente } from "@/components/salle-attente";
import { TiroirDuJournal } from "@/components/tiroir-journal";
import type { VueDuTiroir } from "@/lib/journal/tiroir";
import type { VueDeGrille } from "@/lib/manche/lecture";
import type { VueDePartie } from "@/lib/partie/lecture";
import { type EtatDeSalle, estDeLaPartie } from "@/lib/partie/salle-attente";
import type { JoueurConnu } from "@/lib/roster/noms";

/**
 * Les quatre gestes de la page, câblés par elle.
 *
 * Ensemble et non un par un : ils visent tous la même partie, et les séparer
 * laisserait un appelant marier le « rejoindre » d'une partie au « retirer »
 * d'une autre.
 */
export type GestesDePartie = {
  ouvrirLaMancheSuivante: Action;
  rejoindre: Action;
  ajouter: Action;
  retirer: Action;
};

/**
 * La page d'une partie, atteinte par son code — sa forme, sans sa plomberie.
 *
 * **Le code donne la lecture, l'écriture demande d'être participant.** C'est la
 * seule chose que cet écran décide, et il la décide une fois : qui n'est pas de
 * la partie voit tout — le code, la grille, les totaux, le journal — et ne se
 * voit offrir aucun formulaire qui ferait bouger la soirée. Le bandeau de
 * `SalleDAttente` dit pourquoi ; sans lui il resterait des gens convaincus que
 * l'app est cassée.
 *
 * Ce que ça arrête concrètement : « Saisir la manche suivante » sous le doigt
 * d'un spectateur ouvrirait une manche dans une partie où il n'a pas de
 * colonne, et **gèlerait la liste**, s'enfermant lui-même dehors. Ce n'est pas
 * une fraude qu'on borne ici — le lien appareil → joueur reste une déclaration
 * — c'est un geste offert à qui n'avait rien à en faire.
 *
 * La salle d'attente reste montrée à tout le monde : c'est elle qui porte la
 * seule écriture que le code seul autorise — **réclamer sa place**, permis
 * même partie gelée puisqu'il n'ajoute personne.
 *
 * Séparé de la page comme `Accueil` l'est de la sienne, et pour la même raison
 * : le sondage est un composant client, passé en `ReactNode`, et tout le reste
 * se vérifie alors sur le balisage produit.
 */
export function EcranDePartie({
  partie,
  grille,
  salle,
  roster,
  tiroir,
  gestes,
  erreur,
  sondage,
}: {
  partie: VueDePartie;
  grille: VueDeGrille;
  salle: EtatDeSalle;
  roster: readonly JoueurConnu[];
  tiroir: VueDuTiroir;
  gestes: GestesDePartie;
  /**
   * Le refus rapporté par l'adresse, montré au-dessus du reste.
   *
   * Exigé et non optionnel : la page le calcule toujours, et un appelant qui
   * l'oublierait afficherait une partie muette après un geste refusé.
   */
  erreur: string | undefined;
  /** `<SondageDePartie>`, passé par la page. Voir plus haut. */
  sondage?: ReactNode;
}): ReactElement {
  return (
    <Ecran>
      {erreur === undefined ? null : (
        <p role="alert" className="rounded-lg bg-destructive/10 p-3 text-destructive text-sm">
          {erreur}
        </p>
      )}

      <PartieEntete partie={partie} />

      <GrilleDeScore partie={partie} grille={grille} />

      {estDeLaPartie(salle) ? <MancheSuivante action={gestes.ouvrirLaMancheSuivante} /> : null}

      <SalleDAttente
        partie={partie}
        salle={salle}
        roster={roster}
        rejoindre={gestes.rejoindre}
        ajouter={gestes.ajouter}
        retirer={gestes.retirer}
      />

      <TiroirDuJournal code={partie.code} tiroir={tiroir} />

      {sondage}
    </Ecran>
  );
}
