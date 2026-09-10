import type { ReactElement } from "react";
import type { EntreeCatalogue } from "@/lib/jeux/catalogue";
import type { JoueurId } from "@/lib/jeux/moteur";
import type { LigneDeGrille } from "@/lib/manche/lecture";
import type { JoueurConnu } from "@/lib/roster/noms";

/** Ce qu'une case vide montre : un trou, jamais un zéro — voir {@link GrilleDeScore}. */
const TROU = "—";

/**
 * La feuille de score elle-même : **les manches en lignes, les joueurs en
 * colonnes, les totaux au pied**.
 *
 * C'est la forme qu'on a écartée pour *saisir* — trop de défilement latéral
 * pour taper un nombre — et retenue pour *lire* : elle montre d'un coup d'œil
 * où en est la soirée, ce qu'un joueur à la fois ne fera jamais. La fiche de
 * partie réutilisera la même.
 *
 * **Elle défile latéralement à cinq joueurs**, prix connu de cette forme, et
 * dans son propre cadre : c'est le `div` qui déborde, jamais le corps du
 * document, sans quoi toute la page glisserait sous le pouce.
 *
 * Les **totaux viennent du moteur** et d'aucune addition faite ici. Un second
 * décompte se désaccorderait du premier, et c'est l'écran qui aurait tort sans
 * que rien ne proteste.
 *
 * Une case vide se lit {@link TROU} et non `0` : à 6 qui prend, zéro est une
 * manche réussie, et les confondre ferait croire la manche complète.
 *
 * Les cases se retrouvent **par joueur**, jamais par position : le composant ne
 * suppose pas que sa lecture les lui donne dans l'ordre de ses colonnes, et un
 * décalage attribuerait le score de Paul à Léa en silence.
 */
export function GrilleDeScore({
  joueurs,
  manches,
  totaux,
  unite,
}: {
  /** Les colonnes, dans l'ordre de la tablée. */
  joueurs: readonly JoueurConnu[];
  manches: readonly LigneDeGrille[];
  /** Les totaux tels que `evaluer` les rend, la manche en cours comprise. */
  totaux: ReadonlyMap<JoueurId, number>;
  unite: EntreeCatalogue["unite"];
}): ReactElement {
  return (
    <section className="flex flex-col gap-2">
      <div className="-mx-4 overflow-x-auto px-4">
        <table className="w-full min-w-max border-collapse text-right tabular-nums">
          <thead>
            <tr className="border-border border-b">
              <th
                scope="col"
                className="py-2 pr-3 text-left font-medium text-muted-foreground text-sm"
              >
                Manche
              </th>
              {joueurs.map((joueur) => (
                <th
                  key={joueur.id}
                  scope="col"
                  className="min-w-16 py-2 pl-3 font-medium text-base"
                >
                  {joueur.nom}
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {manches.map((manche) => (
              <tr key={manche.numero} className="border-border/60 border-b">
                <th
                  scope="row"
                  className="py-2 pr-3 text-left font-mono font-normal text-muted-foreground text-sm"
                >
                  {manche.numero}
                </th>
                {joueurs.map((joueur) => (
                  <td key={joueur.id} className="py-2 pl-3 font-mono text-lg">
                    {valeurDe(manche, joueur.id)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>

          <tfoot>
            <tr className="border-border border-t-2">
              <th scope="row" className="py-2 pr-3 text-left font-medium text-sm">
                Total
              </th>
              {joueurs.map((joueur) => (
                <td key={joueur.id} className="py-2 pl-3 font-mono font-semibold text-xl">
                  {totaux.get(joueur.id) ?? 0}
                </td>
              ))}
            </tr>
          </tfoot>
        </table>
      </div>

      <p className="text-muted-foreground text-sm">{`Totaux en ${unite.plusieurs}.`}</p>
    </section>
  );
}

/** Ce que ce joueur a marqué dans cette manche, ou le trou de la case vide. */
function valeurDe(manche: LigneDeGrille, joueurId: JoueurId): string {
  const trouvee = manche.cases.find((une) => une.joueur.id === joueurId);

  return trouvee === undefined || trouvee.valeur === null ? TROU : String(trouvee.valeur);
}
