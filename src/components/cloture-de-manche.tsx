"use client";

import type { ReactElement } from "react";
import { useActionState } from "react";
import type { Action, ActionServeur } from "@/components/champs";
import { Button } from "@/components/ui/button";
import type { EtatDeCloture } from "@/lib/manche/annonce";
import type { FinDePartie } from "@/lib/partie/fin";

/**
 * Ce qu'on annonce quand la partie vient de finir, selon la cause.
 *
 * Les phrases vivent ici et non près de l'estampille : le module qui la lit
 * touche la base, et l'importer d'un composant client emporterait Drizzle et le
 * schéma dans le paquet servi au téléphone.
 *
 * Le `Record` est exhaustif par le type : une troisième cause ne compilerait
 * pas sans qu'on ait dit ce qu'elle annonce.
 */
const FIN_DE_PARTIE: Record<FinDePartie["cause"], string> = {
  terminee: "La partie est terminée : elle est scellée, les scores ne bougent plus.",
  abandonnee: "La partie est abandonnée : il faudra la reprendre pour y écrire encore.",
};

/**
 * L'écran de clôture, tel que l'état du serveur le laisse.
 *
 * Pur, et séparé du composant qui tient l'état pour cette raison-là : « l'alerte
 * n'apparaît qu'à la clôture » se vérifie alors sur le balisage produit, dans
 * les deux sens, au lieu de se lire dans une prose qui jurerait que la page ne
 * recalcule rien.
 *
 * Il ne reçoit **aucune identité de lecteur** : n'importe quel participant
 * clôt, il n'y a donc rien à conditionner ici et rien qui puisse l'être un jour
 * par erreur. C'est le serveur qui vérifie qu'on est bien de la tablée, parce
 * que c'est lui qui grave l'auteur de la clôture.
 */
export function VueDeCloture({
  action,
  mancheId,
  etat,
  partie,
}: {
  action: Action;
  mancheId: number;
  /** Ce que la dernière clôture a annoncé, ou `null` tant qu'il n'y en a pas eu. */
  etat: EtatDeCloture;
  /** L'adresse de la partie, où la fin renvoie. */
  partie: string;
}): ReactElement {
  if (etat?.statut === "finie") {
    return (
      <section role="alert" className="flex flex-col gap-3 rounded-lg bg-muted p-4">
        <p className="font-semibold text-lg">{FIN_DE_PARTIE[etat.cause]}</p>
        <a href={partie} className="text-muted-foreground text-sm underline">
          Voir la partie
        </a>
      </section>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {etat === null ? null : (
        <p role="alert" className="rounded-lg bg-destructive/10 p-3 text-destructive text-sm">
          {etat.message}
        </p>
      )}
      <form action={action} method="post">
        <input type="hidden" name="mancheId" value={mancheId} />
        <Button type="submit" size="lg" className="w-full">
          Clore la manche
        </Button>
      </form>
      <p className="text-muted-foreground text-sm">
        Clore, c’est déclarer la manche finie : c’est de là que la partie se termine si le compte y
        est.
      </p>
    </div>
  );
}

/**
 * La clôture d'une manche : le geste, et ce qu'il annonce.
 *
 * `useActionState` plutôt qu'une redirection portant la fin dans l'adresse :
 * l'alerte de seuil sort de la clôture **et de nulle part ailleurs**, et une
 * adresse la rendrait rejouable au rechargement comme fabricable à la main. Le
 * rechargement du récapitulatif la fait disparaître, ce qui est juste — elle
 * annonce un geste, pas un état.
 *
 * Une clôture qui ne termine rien ne rend aucun état : l'action redirige, et la
 * table passe à la manche suivante.
 */
export function ClotureDeManche({
  action,
  mancheId,
  partie,
}: {
  action: ActionServeur<EtatDeCloture>;
  mancheId: number;
  partie: string;
}): ReactElement {
  const [etat, agir] = useActionState(action, null);

  return <VueDeCloture action={agir} mancheId={mancheId} etat={etat} partie={partie} />;
}
