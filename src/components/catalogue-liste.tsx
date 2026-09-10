import type { ReactElement } from "react";
import { LISTE } from "@/components/champs";
import type { EntreeCatalogue } from "@/lib/jeux/catalogue";
import { libelleDeFin } from "@/lib/partie/tablee";

/**
 * Le catalogue en **liste pleine largeur**, une ligne par entrée.
 *
 * En tuiles, les deux *6 qui prend* sont indiscernables : le nom de la variante
 * est trop long pour une tuile et se tronque, et il ne reste plus que deux
 * carrés identiques. Une ligne laisse la place d'écrire ce qui les sépare —
 * ici la condition de fin, qui est précisément là où elles divergent.
 */
export function CatalogueListe({ entrees }: { entrees: readonly EntreeCatalogue[] }): ReactElement {
  return (
    <ul className={LISTE}>
      {entrees.map((entree) => (
        <li key={entree.id}>
          <a
            href={`/creer/${entree.id}`}
            className="flex w-full flex-col gap-0.5 px-4 py-4 hover:bg-muted active:bg-muted"
          >
            <span className="font-medium text-base">{entree.nom}</span>
            <span className="text-muted-foreground text-sm">
              {`${libelleDeFin(entree.regles.fin, entree.unite)} · ${entree.regles.joueursMin} à ${entree.regles.joueursMax} joueurs`}
            </span>
          </a>
        </li>
      ))}
    </ul>
  );
}
