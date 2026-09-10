import type { ReactElement, ReactNode } from "react";

/**
 * La coquille d'un écran : une colonne centrée, bornée, respirant pareil
 * partout.
 *
 * Écrite une seule fois parce que c'est **la même chose** et non parce que les
 * pages se ressemblent : l'accueil et la page d'une partie montrent la même
 * soirée, et deux gouttières différentes feraient sauter la grille d'un écran à
 * l'autre au moindre aller-retour.
 *
 * `max-w-2xl` sur une app pensée pour le téléphone n'est pas une contradiction :
 * c'est ce qui l'empêche de s'étaler quand elle est ouverte sur un portable
 * posé au milieu de la table.
 */
export function Ecran({ children }: { children: ReactNode }): ReactElement {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-4 py-8">
      {children}
    </main>
  );
}
