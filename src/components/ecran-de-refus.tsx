import type { ReactElement } from "react";
import type { Action } from "@/components/champs";
import { Button } from "@/components/ui/button";
import type { EntreeCatalogue } from "@/lib/jeux/catalogue";
import type { Regles } from "@/lib/jeux/regles";
import { valeurEnMots } from "@/lib/manche/gestes";
import { type RefusDEcriture, reappliquer } from "@/lib/manche/refus";
import type { ValeurDeCase } from "@/lib/manche/saisie";

/**
 * Ce que la case porte maintenant, dit d'une phrase.
 *
 * Le vide se **nomme** plutôt que de se montrer : un grand tiret au milieu d'un
 * écran de refus se lit « il n'y a rien à dire », alors qu'une case redevenue
 * vide est précisément ce qui vient de se passer.
 *
 * La valeur passe par les mots du **mode** : au podium, la colonne porte un
 * rang, et « la case de Paul porte maintenant 1 » se lirait comme un jeton.
 */
function phraseDeLaCase(regles: Regles, nom: string, valeurArrivee: ValeurDeCase): string {
  return valeurArrivee === null
    ? `La case de ${nom} est redevenue vide.`
    : `La case de ${nom} porte maintenant ${valeurEnMots(regles, valeurArrivee)}.`;
}

/**
 * Ce qui vient d'être refusé, dit comme le geste que c'était.
 *
 * Une **désignation** ne tape aucun nombre : « ton — n'a pas été écrit » ne se
 * lit pas, et prétendre qu'une valeur a été tapée serait faux. Les deux espèces
 * de gestes se disent donc chacune dans ses mots.
 */
function phraseDuGeste(regles: Regles, valeurTapee: ValeurDeCase): string {
  const quoi =
    valeurTapee === null
      ? "Ta désignation n’a pas été écrite"
      : `Ton ${valeurEnMots(regles, valeurTapee)} n’a pas été écrit`;

  return `${quoi} : la case avait changé depuis qu’elle t’a été montrée.`;
}

/** Le seul bouton de l'écran, nommé par le geste qu'il repose. */
function libelleDeReapplication(regles: Regles, valeurTapee: ValeurDeCase): string {
  return valeurTapee === null
    ? "Réappliquer la désignation"
    : `Réappliquer ${valeurEnMots(regles, valeurTapee)}`;
}

/**
 * L'écran qui **arrête le geste** quand quelqu'un est passé avant.
 *
 * Un écran et jamais un bandeau : à la trentième manche d'une soirée, un
 * bandeau se rate, et le recul de l'affichage optimiste doit être **compris**.
 * Un retour silencieux du 12 au 8 est exactement le scénario que la politique
 * d'écriture concurrente existe pour éviter — voir
 * `docs/specs/2026-09-09-ecriture-concurrente.md`.
 *
 * **L'auteur n'est pas nommé.** « La case porte maintenant 8 » suffit à
 * comprendre et à décider ; le nommer demanderait au chemin d'écriture d'aller
 * lire le journal pour composer sa phrase, alors que le journal est une trace
 * qu'on consulte, jamais une pièce du flux. Le lien discret vers le tiroir le
 * met à un appui de là, pour qui veut savoir qui.
 *
 * Le seul bouton **repose la valeur tapée par dessus la valeur arrivée** : le
 * second appui est donc un écrasement informé — on voit la valeur, on écrit par
 * dessus — et non une seconde tentative périmée qui serait refusée à son tour.
 */
export function EcranDeRefus({
  action,
  mancheId,
  refus,
  regles,
  unite,
  journal,
  recapitulatif,
  enCours = false,
}: {
  action: Action;
  mancheId: number;
  /** Le refus, qui porte le joueur que la case concerne — jamais l'auteur. */
  refus: RefusDEcriture;
  /** Les règles figées, pour dire une valeur dans les mots de son mode. */
  regles: Regles;
  unite: EntreeCatalogue["unite"];
  /** L'adresse du tiroir : « qui » est à un appui, il n'est pas dans le flux. */
  journal: string;
  /** L'adresse où l'on va quand on renonce à réappliquer. */
  recapitulatif: string;
  /**
   * Vrai pendant que la réapplication est en vol.
   *
   * Le bouton se ferme alors, pour la raison qui ferme le pavé : réappuyer
   * reposerait la même valeur sur une condition qui n'est déjà plus celle
   * qu'on vient de lire, et le second envoi serait refusé pour de bon.
   */
  enCours?: boolean;
}): ReactElement {
  const repose = reappliquer(refus);

  return (
    <section className="flex flex-1 flex-col gap-8">
      <div className="flex flex-col gap-1">
        <p className="text-muted-foreground text-sm">Quelqu’un a été plus rapide</p>
        <h1 className="font-semibold text-3xl tracking-tight">
          {phraseDeLaCase(regles, refus.joueur.nom, refus.valeurArrivee)}
        </h1>
      </div>

      <div className="flex flex-col items-center gap-1">
        <p className="font-mono text-6xl tabular-nums">
          {refus.valeurArrivee === null ? "—" : valeurEnMots(regles, refus.valeurArrivee)}
        </p>
        <p className="text-muted-foreground text-sm">
          {refus.valeurArrivee === null ? "case vide" : unite.plusieurs}
        </p>
      </div>

      <p className="text-muted-foreground text-sm">{phraseDuGeste(regles, refus.valeurTapee)}</p>

      <div className="mt-auto flex flex-col gap-3">
        <form action={action} method="post">
          <input type="hidden" name="mancheId" value={mancheId} />
          <input type="hidden" name="joueurConcerneId" value={refus.joueur.id} />
          <input type="hidden" name="valeurMontree" value={repose.valeurMontree} />
          <input type="hidden" name="valeur" value={repose.valeur} />
          <Button type="submit" size="lg" className="w-full" disabled={enCours}>
            {libelleDeReapplication(regles, refus.valeurTapee)}
          </Button>
        </form>

        <a href={recapitulatif} className="text-center text-muted-foreground text-sm underline">
          En rester là
        </a>
        <a href={journal} className="text-center text-muted-foreground text-sm underline">
          Qui a écrit&nbsp;?
        </a>
      </div>
    </section>
  );
}
