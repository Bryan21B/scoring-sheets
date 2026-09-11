"use client";

import type { ReactElement } from "react";
import { useActionState } from "react";
import type { Action, ActionServeur } from "@/components/champs";
import { Designation } from "@/components/designation";
import { EcranDeRefus } from "@/components/ecran-de-refus";
import { PasseAvant } from "@/components/passe-avant";
import type { EntreeCatalogue } from "@/lib/jeux/catalogue";
import type { Regles } from "@/lib/jeux/regles";
import type { DepartDePasseAvant } from "@/lib/manche/passe-avant";
import type { RefusDEcriture } from "@/lib/manche/refus";

/**
 * Ce que les écrans d'une saisie partagent : le geste attendu, et où il mène.
 *
 * Un seul objet plutôt que huit props recopiées trois fois : le pavé, la
 * désignation et le refus parlent de **la même manche**, et trois listes
 * divergeraient le jour où l'une gagne une adresse que les autres n'ont pas.
 *
 * `depart` porte l'écran **et sa charge utile** — la case et la borne du pavé,
 * ou la question et les candidats d'une désignation. C'est le seul champ qui
 * dépend du mode, et il arrive déjà décidé : la page ne choisit pas d'écran,
 * elle relaie celui que la passe avant a dérivé.
 */
export type CadreDeSaisie = {
  mancheId: number;
  mancheNumero: number;
  depart: DepartDePasseAvant;
  /**
   * Les règles figées de la partie.
   *
   * Pour les **mots**, et rien d'autre : un refus arrive après l'envoi, et
   * l'écran doit alors dire ce que la case porte — un total, un rang — sans
   * pouvoir redemander au serveur de quel mode il s'agissait.
   */
  regles: Regles;
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
 * Un écran et un seul : **le refus remplace ce qui l'a produit**.
 *
 * Pur, et séparé du composant qui tient l'état pour cette raison-là : « un
 * écran arrête le geste » est une décision qui se vérifie sur le balisage
 * produit — le pavé n'est plus là, la liste de noms non plus — au lieu de se
 * lire dans une prose qui jurerait que ce n'est pas un bandeau.
 *
 * Le choix entre le pavé et la désignation ne se fait pas ici : il est
 * **dérivé du mode** par la passe avant, et arrive dans `depart`. Un composant
 * qui rebrancherait sur le mode serait un second endroit où « ce jeu demande un
 * nom » se déciderait.
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
        refus={refus}
        regles={cadre.regles}
        enCours={enCours}
        unite={cadre.unite}
        journal={cadre.journal}
        recapitulatif={cadre.recapitulatif}
      />
    );
  }

  if (cadre.depart.ecran === "designation") {
    return (
      <Designation
        action={action}
        mancheId={cadre.mancheId}
        mancheNumero={cadre.mancheNumero}
        designation={cadre.depart}
        recapitulatif={cadre.recapitulatif}
        enCours={enCours}
      />
    );
  }

  return (
    <PasseAvant
      action={action}
      mancheId={cadre.mancheId}
      mancheNumero={cadre.mancheNumero}
      caseASaisir={cadre.depart.caseASaisir}
      max={cadre.depart.max}
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
 * tapée revient du serveur avec la valeur arrivée, et le joueur que la case
 * concerne avec elles. C'est ce qui laisse les trois écrans être purs.
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
