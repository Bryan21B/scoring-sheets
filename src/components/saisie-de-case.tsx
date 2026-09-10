"use client";

import type { ReactElement } from "react";
import { useActionState } from "react";
import type { Action, ActionServeur } from "@/components/champs";
import { EcranDeRefus } from "@/components/ecran-de-refus";
import { PasseAvant } from "@/components/passe-avant";
import type { EntreeCatalogue } from "@/lib/jeux/catalogue";
import type { CaseDeManche } from "@/lib/manche/lecture";
import type { RefusDEcriture } from "@/lib/manche/refus";

/**
 * Ce que les deux écrans d'une saisie partagent : la case, et où elle mène.
 *
 * Un seul objet plutôt que huit props recopiées deux fois : le pavé et le refus
 * parlent de **la même case**, et deux listes divergeraient le jour où l'une
 * gagne une adresse que l'autre n'a pas.
 */
export type CadreDeSaisie = {
  mancheId: number;
  mancheNumero: number;
  caseASaisir: CaseDeManche;
  max: number;
  unite: EntreeCatalogue["unite"];
  recapitulatif: string;
  /**
   * L'adresse du tiroir, où l'on va voir qui, si on tient à le savoir.
   *
   * Le seul champ que le pavé ne connaît pas : les autres sont les siens, et
   * {@link PasseAvant} les documente là où ils servent.
   */
  journal: string;
};

/**
 * L'un ou l'autre écran, jamais les deux : **le refus remplace la saisie**.
 *
 * Pur, et séparé du composant qui tient l'état pour cette raison-là : « un
 * écran arrête le geste » est une décision qui se vérifie sur le balisage
 * produit — le pavé n'est plus là — au lieu de se lire dans une prose qui
 * jurerait que ce n'est pas un bandeau.
 */
export function VueDeSaisie({
  cadre,
  refus,
  action,
  enCours,
}: {
  cadre: CadreDeSaisie;
  /** Le refus à montrer, ou `null` tant que rien n'a été arrêté. */
  refus: RefusDEcriture | null;
  action: Action;
  /** Vrai pendant qu'une écriture est en vol : l'affichage est optimiste. */
  enCours: boolean;
}): ReactElement {
  if (refus !== null) {
    return (
      <EcranDeRefus
        action={action}
        mancheId={cadre.mancheId}
        joueur={cadre.caseASaisir.joueur}
        refus={refus}
        enCours={enCours}
        unite={cadre.unite}
        journal={cadre.journal}
        recapitulatif={cadre.recapitulatif}
      />
    );
  }

  return (
    <PasseAvant
      action={action}
      mancheId={cadre.mancheId}
      mancheNumero={cadre.mancheNumero}
      caseASaisir={cadre.caseASaisir}
      max={cadre.max}
      unite={cadre.unite}
      recapitulatif={cadre.recapitulatif}
      enCours={enCours}
    />
  );
}

/**
 * La saisie d'une case, refus compris : le seul état de l'écran.
 *
 * `useActionState` plutôt qu'une redirection avec la valeur arrivée dans
 * l'adresse : le refus arrive **sans navigation**, donc l'affichage optimiste a
 * bien eu lieu, et le recul se voit à l'endroit où l'on tapait. Le refus n'a
 * pas non plus à traverser une URL, où il se bricolerait.
 *
 * Rien n'a besoin de survivre au remplacement du pavé par le refus : la valeur
 * tapée revient du serveur avec la valeur arrivée. C'est ce qui laisse les deux
 * écrans être purs.
 */
export function SaisieDeCase({
  cadre,
  action,
}: {
  cadre: CadreDeSaisie;
  action: ActionServeur<RefusDEcriture | null>;
}): ReactElement {
  const [refus, agir, enCours] = useActionState(action, null);

  return <VueDeSaisie cadre={cadre} refus={refus} action={agir} enCours={enCours} />;
}
