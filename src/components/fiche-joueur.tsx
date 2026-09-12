import type { ReactElement } from "react";
import { LISTE } from "@/components/champs";
import { Ecran } from "@/components/ecran";
import { horodatage } from "@/lib/journal/tiroir";
import { ADRESSE_PALMARES } from "@/lib/palmares/adresse";
import type { Compteur, FicheDeJoueur, GroupeDeFamille, SousTotal } from "@/lib/palmares/fiche";
import { parties, victoires } from "@/lib/palmares/mots";

/**
 * La fiche d'un joueur : **ses compteurs, entrée par entrée**.
 *
 * L'autre moitié de la seconde paire — le palmarès liste les joueurs, la fiche
 * en montre un — exactement comme l'historique liste les parties et la fiche de
 * partie en montre une. Une seule idée de navigation à apprendre.
 *
 * Il n'y a **pas de taux ici**, et c'est voulu : le taux ordonne une liste, il
 * ne dit rien de plus sur une page où l'on est seul. Ce qu'on vient chercher,
 * c'est le fait — « combien de parties de 6 qui prend, combien gagnées ».
 */
export function FicheJoueur({ fiche }: { fiche: FicheDeJoueur }): ReactElement {
  return (
    <Ecran>
      <h1 className="font-semibold text-2xl tracking-tight">{fiche.joueur.nom}</h1>

      {fiche.familles.map((famille) => (
        <Famille key={famille.famille} famille={famille} />
      ))}

      <a href={ADRESSE_PALMARES} className="text-muted-foreground text-sm underline">
        Le palmarès
      </a>
    </Ecran>
  );
}

/**
 * Une famille : son titre, ses entrées, et son sous-total **s'il y en a un à
 * faire**.
 *
 * La famille **groupe, elle ne somme pas** : les deux *6 qui prend* gardent
 * chacune sa ligne, parce que fusionner cacherait que sur douze parties, neuf
 * étaient le jeu de base. Le sous-total s'ajoute en dessous, jamais à leur place.
 *
 * Une famille d'une seule entrée n'en reçoit pas : il répéterait la ligne mot
 * pour mot, et une page qui se répète se lit deux fois plus lentement pour la
 * même information.
 */
function Famille({ famille }: { famille: GroupeDeFamille }): ReactElement {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="font-semibold text-base tracking-tight">{famille.nom}</h2>
      <ul className={LISTE}>
        {famille.compteurs.map((compteur) => (
          <LigneDeCompteur key={compteur.jeu.id} compteur={compteur} />
        ))}
        {famille.compteurs.length > 1 ? <LigneDeSousTotal sousTotal={famille.sousTotal} /> : null}
      </ul>
    </section>
  );
}

/** Une entrée du catalogue et ce que le joueur y a fait. */
function LigneDeCompteur({ compteur }: { compteur: Compteur }): ReactElement {
  return (
    <li className="flex flex-col gap-0.5 px-4 py-4">
      <span className="font-medium text-base">{compteur.jeu.nom}</span>
      <Faits compteur={compteur} />
    </li>
  );
}

/**
 * Le sous-total de la famille, marqué comme tel.
 *
 * Il ne porte **pas de date** : « la dernière partie de la famille » n'est la
 * dernière d'aucune des deux entrées en particulier, et la donner ferait croire
 * à une cinquième colonne de fait là où il n'y a qu'une addition.
 */
function LigneDeSousTotal({ sousTotal }: { sousTotal: SousTotal }): ReactElement {
  return (
    <li className="flex items-baseline justify-between gap-3 bg-muted/50 px-4 py-3">
      <span className="text-muted-foreground text-sm">Total</span>
      <span className="font-medium text-sm tabular-nums">
        {`${parties(sousTotal.partiesJouees)} · ${victoires(sousTotal.victoires)}`}
      </span>
    </li>
  );
}

/**
 * Les faits d'un compteur, ou le fait qu'il n'y en a aucun.
 *
 * « Jamais jouée » plutôt que « 0 partie · 0 victoire » : trois zéros alignés se
 * lisent comme une donnée manquante, alors que c'en est une très précise. Et
 * c'est ce qui laisse une entrée du catalogue rester sur la fiche de qui n'y a
 * jamais touché, ce à quoi elle a droit — une liste qui change de forme d'un
 * joueur à l'autre ne se compare plus d'un coup d'œil.
 */
function Faits({ compteur }: { compteur: Compteur }): ReactElement {
  if (compteur.dernierePartie === null) {
    return <span className="text-muted-foreground text-sm">Jamais jouée</span>;
  }

  return (
    <span className="text-muted-foreground text-sm">
      {`${parties(compteur.partiesJouees)} · ${victoires(compteur.victoires)} · `}
      {/* L'horodatage du journal, et non un second formateur : c'est la même
          horloge de serveur, lue dans le même fuseau fixe. Deux mises en forme
          de la même date divergeraient le jour où l'une est corrigée. */}
      <time dateTime={compteur.dernierePartie.toISOString()}>
        {horodatage(compteur.dernierePartie)}
      </time>
    </span>
  );
}
