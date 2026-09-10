import type { ReactElement } from "react";
import type { EntreeCatalogue } from "@/lib/jeux/catalogue";
import type { JoueurId } from "@/lib/jeux/moteur";
import type { VueDeManche } from "@/lib/manche/lecture";

/**
 * Le récapitulatif : la suite de la passe avant.
 *
 * Il porte les **totaux du moteur** — jamais un décompte recalculé ici — les
 * cases encore vides **nommées par le joueur qu'elles concernent**, et la
 * correction. C'est de là qu'on saisit pour un participant sans appareil.
 *
 * **Corriger est le même geste que saisir** : chaque ligne est un lien vers
 * l'écran de saisie de cette case, remplie comprise. Pas de bouton « modifier »
 * à côté d'un bouton « saisir » — ce serait deux gestes là où le domaine n'en a
 * qu'un, et l'écran d'arrivée serait le même.
 *
 * Une case vide se lit « à saisir » et non « 0 » : un zéro est une manche
 * réussie à 6 qui prend, et les confondre ferait croire la manche complète.
 */
export function Recapitulatif({
  manche,
  totaux,
  unite,
  adresseDeLaManche,
}: {
  manche: VueDeManche;
  /** Les totaux tels que `evaluer` les rend, la manche en cours comprise. */
  totaux: ReadonlyMap<JoueurId, number>;
  unite: EntreeCatalogue["unite"];
  /** L'adresse de la passe avant, où toute ligne se retape. */
  adresseDeLaManche: string;
}): ReactElement {
  return (
    <section className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="font-semibold text-2xl tracking-tight">Manche {manche.numero}</h1>
        <p className="text-muted-foreground text-sm">
          Touche une ligne pour la retaper : corriger est le même geste que saisir.
        </p>
      </div>

      <ul className="-mx-4 flex w-auto flex-col divide-y divide-border border-border border-y">
        {manche.cases.map(({ joueur, valeur }) => (
          <li key={joueur.id}>
            <a
              href={`${adresseDeLaManche}?joueur=${joueur.id}`}
              className="flex items-baseline justify-between gap-3 px-4 py-3"
            >
              <span className="text-base">{joueur.nom}</span>
              <span className="flex items-baseline gap-3">
                <span
                  className={
                    valeur === null
                      ? "text-muted-foreground text-sm"
                      : "font-mono text-xl tabular-nums"
                  }
                >
                  {valeur === null ? "à saisir" : valeur}
                </span>
                <span className="text-muted-foreground text-sm tabular-nums">
                  {`total ${totaux.get(joueur.id) ?? 0}`}
                </span>
              </span>
            </a>
          </li>
        ))}
      </ul>

      <p className="text-muted-foreground text-sm">{`Totaux en ${unite.plusieurs}.`}</p>
    </section>
  );
}
