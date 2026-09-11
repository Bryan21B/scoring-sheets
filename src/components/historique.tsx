import type { ReactElement } from "react";
import { LISTE } from "@/components/champs";
import { Ecran } from "@/components/ecran";
import { horodatage } from "@/lib/journal/tiroir";
import { adresseDePartie } from "@/lib/partie/adresse";
import type { LigneDHistorique, VueDHistorique } from "@/lib/partie/historique";

/**
 * L'historique : **les parties finies, la plus récente d'abord**.
 *
 * La liste qui mène aux fiches. Elle ne décide rien de ce qu'elle montre —
 * l'ordre, le filtre et le vainqueur sortent de `lireLHistorique`, et la page
 * n'est que du câblage entre les deux.
 */
export function Historique({ vue }: { vue: VueDHistorique }): ReactElement {
  return (
    <Ecran>
      <h1 className="font-semibold text-2xl tracking-tight">Historique</h1>

      <ul className={LISTE}>
        {vue.lignes.map((une) => (
          <Ligne key={une.code} ligne={une} />
        ))}
      </ul>
    </Ecran>
  );
}

/**
 * Une ligne : le jeu, ce qu'il en est sorti, et quand.
 *
 * Quatre choses et pas cinq — la tablée complète et les scores sont sur la
 * fiche, où toute la ligne mène. C'est le lien qui porte la mise en page, et
 * non un bouton posé dedans : la cible d'un pouce est la ligne entière.
 */
function Ligne({ ligne }: { ligne: LigneDHistorique }): ReactElement {
  return (
    <li>
      <a
        href={adresseDePartie(ligne.code)}
        className="flex w-full flex-col gap-0.5 px-4 py-4 hover:bg-muted active:bg-muted"
      >
        <span className="font-medium text-base">{ligne.jeu.nom}</span>
        <Denouement ligne={ligne} />
        {/* L'horodatage du journal, et non un second formateur : c'est la même
            horloge de serveur, lue dans le même fuseau fixe. Deux mises en forme
            de la même date divergeraient le jour où l'une est corrigée. */}
        <time dateTime={ligne.finLe.toISOString()} className="text-muted-foreground text-xs">
          {horodatage(ligne.finLe)}
        </time>
      </a>
    </li>
  );
}

/**
 * Ce qui est sorti de la partie, et combien étaient à table.
 *
 * `vainqueur` est `null` pour **deux raisons différentes**, et les confondre
 * mentirait dans les deux sens : une partie abandonnée n'a pas de vainqueur
 * parce qu'elle s'est arrêtée, une partie terminée à égalité parce que le
 * moteur sort son classement en groupes de rang et qu'un groupe de deux ne se
 * départage nulle part. « Sans vainqueur » pour les deux laisserait croire à un
 * abandon là où il y a eu une partie entière.
 *
 * L'abandon est **marqué**, pas raconté : la fiche écrit « Partie abandonnée le
 * … » parce qu'elle a la place d'une phrase, la ligne porte une pastille parce
 * qu'elle doit se repérer en défilant. Deux formes pour deux écrans, et non une
 * constante recopiée — corriger la phrase de la fiche n'a aucune raison de
 * changer l'étiquette d'ici.
 */
function Denouement({ ligne }: { ligne: LigneDHistorique }): ReactElement {
  if (ligne.cause === "abandonnee") {
    return (
      <span className="flex items-center gap-2 text-muted-foreground text-sm">
        <span className="rounded-full bg-muted px-2 py-0.5 font-medium text-foreground text-xs">
          Abandonnée
        </span>
        {effectif(ligne.nombreDeJoueurs)}
      </span>
    );
  }

  return (
    <span className="text-muted-foreground text-sm">
      {`${ligne.vainqueur === null ? "Égalité en tête" : `${ligne.vainqueur.nom} l’emporte`} · ${effectif(ligne.nombreDeJoueurs)}`}
    </span>
  );
}

/**
 * Combien étaient à table, au singulier près.
 *
 * Aucune entrée du catalogue ne se joue à un, mais un participant **retiré** ne
 * compte pas : une tablée de deux dont l'un est parti se lit « 1 joueur », et
 * « 1 joueurs » ferait douter du chiffre plus que de la grammaire.
 */
function effectif(combien: number): string {
  return combien > 1 ? `${combien} joueurs` : `${combien} joueur`;
}
