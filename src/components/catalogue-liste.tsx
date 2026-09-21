import type { CSSProperties, ReactElement } from "react";
import { LIGNE_TOUCHABLE, LISTE, TRAIT } from "@/components/champs";
import type { EntreeCatalogue } from "@/lib/jeux/catalogue";
import { libelleDeFin } from "@/lib/partie/tablee";

/**
 * Les quatre aplats du kit, dans l'ordre où ils marquent les entrées.
 *
 * Le repère est **positionnel et non sémantique** : la couleur ne dit pas quel
 * jeu c'est, elle dit que ce n'est pas celui d'au-dessus. C'est tout ce qu'on
 * lui demande — les deux *6 qui prend* portent des noms qui ne se distinguent
 * qu'au dernier mot, et deux barres de couleurs différentes les séparent avant
 * qu'on ait fini de lire.
 *
 * Elle recycle donc au-delà de quatre, sans que rien ne casse : une cinquième
 * entrée reprendrait la framboise, loin de la première.
 */
const APLATS = ["var(--framboise)", "var(--lagon)", "var(--mandarine)", "var(--raisin)"] as const;

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
      {entrees.map((entree, index) => (
        <li key={entree.id}>
          <a
            href={`/creer/${entree.id}`}
            className={`flex w-full items-center gap-3.5 px-4 py-4 ${LIGNE_TOUCHABLE}`}
          >
            <Barre index={index} />
            <span className="flex flex-col gap-0.5">
              <span className="font-semibold text-[17px]">{entree.nom}</span>
              <span className="text-muted-foreground text-sm">
                {`${libelleDeFin(entree.regles.fin, entree.unite)} · ${entree.regles.joueursMin} à ${entree.regles.joueursMax} joueurs`}
              </span>
            </span>
          </a>
        </li>
      ))}
    </ul>
  );
}

/**
 * La barre de couleur d'une entrée.
 *
 * `aria-hidden` : elle ne porte aucune information qui ne soit déjà dans le nom
 * juste à côté. Elle sert l'œil qui parcourt, pas l'oreille qui écoute.
 */
function Barre({ index }: { index: number }): ReactElement {
  const style: CSSProperties = {
    backgroundColor: APLATS[index % APLATS.length] ?? APLATS[0],
  };

  return <span aria-hidden="true" style={style} className={`h-8 w-3.5 rounded-sm ${TRAIT}`} />;
}
