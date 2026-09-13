import type { ReactElement } from "react";
import type { JoueurId } from "@/lib/jeux/moteur";
import type { LigneDeGrille, VueDeGrille } from "@/lib/manche/lecture";
import type { VueDePartie } from "@/lib/partie/lecture";
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
 *
 * **Une partie sans manche ne montre rien** — pas un tableau de tirets. La règle
 * est ici plutôt qu'à chaque appel : elle vaut pour la grille elle-même, et deux
 * écrans devant s'en souvenir sont un écran qui l'oubliera.
 *
 * Prend la partie et sa grille, et non les quatre listes qu'il en tire : elles
 * voyagent toujours ensemble, et les séparer laisserait un appelant marier les
 * joueurs d'une partie aux totaux d'une autre.
 */
export function GrilleDeScore({
  partie,
  grille,
}: {
  partie: VueDePartie;
  grille: VueDeGrille;
}): ReactElement | null {
  if (grille.manches.length === 0) {
    return null;
  }

  const partis = lesPartis(grille);
  const joueurs = [...partie.participants, ...partis];
  const { manches } = grille;
  const totaux = grille.etat.totaux;
  const unite = partie.jeu.unite;

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

      {partis.length === 0 ? null : (
        <p className="text-muted-foreground text-sm">{phraseDesPartis(partis)}</p>
      )}
    </section>
  );
}

/**
 * Ceux qui sont **rentrés chez eux** en laissant des points derrière eux.
 *
 * Ils viennent de la grille et non de la tablée, et c'est la seule source
 * possible : `partie.participants` ne porte que ceux qui jouent encore, si bien
 * qu'une colonne de plus demandée à la page serait une deuxième liste de
 * joueurs à garder d'accord avec celle-ci.
 *
 * Ils sont rangés **après** la tablée, dans l'ordre où la feuille les
 * rencontre, comme le moteur range ses totaux : la place qu'ils occupaient
 * autour de la table n'existe plus nulle part, et la rendre par une colonne au
 * milieu ferait deviner une information que rien ne porte.
 */
function lesPartis(grille: VueDeGrille): JoueurConnu[] {
  const partis = new Map<JoueurId, JoueurConnu>();

  for (const manche of grille.manches) {
    for (const une of manche.cases) {
      if (une.retire && !partis.has(une.joueur.id)) {
        partis.set(une.joueur.id, une.joueur);
      }
    }
  }

  return [...partis.values()];
}

/**
 * Ce que la colonne d'un parti veut dire, dit sous la grille.
 *
 * Sans elle, une colonne qui ne bouge plus se lit comme un joueur qui ne
 * marque rien — ce qui est, à 6 qui prend, la meilleure position de la table.
 *
 * Tournée sans possessif ni pronom : « les points déjà marqués » vaut pour un
 * parti comme pour trois, et évite d'accorder en genre un nom que le roster ne
 * qualifie pas.
 */
function phraseDesPartis(partis: readonly JoueurConnu[]): string {
  const noms = partis.map(({ nom }) => nom);
  const sujet = noms.length === 1 ? noms[0] : `${noms.slice(0, -1).join(", ")} et ${noms.at(-1)}`;
  const verbe = noms.length === 1 ? "n’est plus" : "ne sont plus";

  return `${sujet} ${verbe} de la partie : les points déjà marqués restent comptés, sans figurer au classement.`;
}

/** Ce que ce joueur a marqué dans cette manche, ou le trou de la case vide. */
function valeurDe(manche: LigneDeGrille, joueurId: JoueurId): string {
  const trouvee = manche.cases.find((une) => une.joueur.id === joueurId);

  return trouvee === undefined || trouvee.valeur === null ? TROU : String(trouvee.valeur);
}
