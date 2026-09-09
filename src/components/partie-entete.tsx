import type { ReactElement } from "react";
import type { VueDePartie } from "@/lib/partie/lecture";
import { libelleDeFin } from "@/lib/partie/tablee";

/**
 * L'en-tête d'une partie : son code, son jeu, et qui est autour de la table.
 *
 * Le code est **visible de tout participant**, pas du seul créateur — ce n'est
 * pas toujours lui qui a son téléphone en main quand quelqu'un arrive. Le
 * composant ne reçoit donc aucune identité de lecteur : il n'y a rien à
 * conditionner, et rien qui puisse se conditionner par erreur plus tard.
 *
 * Il est écrit en `font-mono` et espacé parce qu'il se **dicte** : six symboles
 * détachés se lisent à voix haute, un bloc de six ne se lit pas.
 */
export function PartieEntete({ partie }: { partie: VueDePartie }): ReactElement {
  return (
    <section className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <p className="text-muted-foreground text-sm">Le code de la partie</p>
        <p className="font-mono text-4xl tracking-[0.3em]">{partie.code}</p>
        <p className="text-muted-foreground text-sm">
          Dicte-le, ou envoie le lien : c’est la même chaîne.
        </p>
      </div>

      <dl className="flex flex-col gap-1 text-sm">
        <div className="flex gap-2">
          <dt className="text-muted-foreground">Jeu</dt>
          <dd>{partie.jeu.nom}</dd>
        </div>
        <div className="flex gap-2">
          <dt className="text-muted-foreground">On s’arrête à</dt>
          <dd>{libelleDeFin(partie.regles.fin, partie.jeu.unite)}</dd>
        </div>
      </dl>

      <div className="flex flex-col gap-2">
        <h2 className="font-medium text-sm">
          {partie.participants.length === 1 ? "1 joueur" : `${partie.participants.length} joueurs`}
        </h2>
        <ul className="-mx-4 flex w-auto flex-col divide-y divide-border border-border border-y">
          {partie.participants.map((joueur) => (
            <li key={joueur.id} className="px-4 py-3 text-base">
              {joueur.nom}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
