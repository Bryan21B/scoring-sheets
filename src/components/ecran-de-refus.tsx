import type { ReactElement } from "react";
import type { Action } from "@/components/champs";
import { Button } from "@/components/ui/button";
import type { EntreeCatalogue } from "@/lib/jeux/catalogue";
import { type RefusDEcriture, reappliquer } from "@/lib/manche/refus";
import type { JoueurConnu } from "@/lib/roster/noms";

/**
 * Ce que la case porte maintenant, dit d'une phrase.
 *
 * Le vide se **nomme** plutôt que de se montrer : un grand tiret au milieu d'un
 * écran de refus se lit « il n'y a rien à dire », alors qu'une case redevenue
 * vide est précisément ce qui vient de se passer.
 */
function phraseDeLaCase(nom: string, valeurArrivee: number | null): string {
  return valeurArrivee === null
    ? `La case de ${nom} est redevenue vide.`
    : `La case de ${nom} porte maintenant ${valeurArrivee}.`;
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
  joueur,
  refus,
  unite,
  journal,
  recapitulatif,
}: {
  action: Action;
  mancheId: number;
  /** Le joueur que la case concerne — jamais celui qui a écrit avant. */
  joueur: JoueurConnu;
  refus: RefusDEcriture;
  unite: EntreeCatalogue["unite"];
  /** L'adresse du tiroir : « qui » est à un appui, il n'est pas dans le flux. */
  journal: string;
  /** L'adresse où l'on va quand on renonce à réappliquer. */
  recapitulatif: string;
}): ReactElement {
  const repose = reappliquer(refus);

  return (
    <section className="flex flex-1 flex-col gap-8">
      <div className="flex flex-col gap-1">
        <p className="text-muted-foreground text-sm">Quelqu’un a été plus rapide</p>
        <h1 className="font-semibold text-3xl tracking-tight">
          {phraseDeLaCase(joueur.nom, refus.valeurArrivee)}
        </h1>
      </div>

      <div className="flex flex-col items-center gap-1">
        <p className="font-mono text-6xl tabular-nums">{refus.valeurArrivee ?? "—"}</p>
        <p className="text-muted-foreground text-sm">
          {refus.valeurArrivee === null ? "case vide" : unite.plusieurs}
        </p>
      </div>

      <p className="text-muted-foreground text-sm">
        {`Ton ${refus.valeurTapee} n’a pas été écrit : la case avait changé depuis qu’elle t’a été montrée.`}
      </p>

      <div className="mt-auto flex flex-col gap-3">
        <form action={action} method="post">
          <input type="hidden" name="mancheId" value={mancheId} />
          <input type="hidden" name="joueurConcerneId" value={joueur.id} />
          <input type="hidden" name="valeurMontree" value={repose.valeurMontree} />
          <input type="hidden" name="valeur" value={repose.valeur} />
          <Button type="submit" size="lg" className="w-full">
            {`Réappliquer ${refus.valeurTapee}`}
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
