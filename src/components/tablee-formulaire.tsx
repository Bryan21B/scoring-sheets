"use client";

import type { ComponentProps, ReactElement } from "react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import type { EntreeCatalogue } from "@/lib/jeux/catalogue";
import type { IdentiteChoisie } from "@/lib/partie/identite";
import { finImprimee, libelleDeFin } from "@/lib/partie/tablee";

/** Classes des deux champs numériques de la tablée : gros, centrés, dictables. */
const CHAMP_NOMBRE =
  "h-12 w-full rounded-lg border border-border bg-background px-3 text-center font-mono text-xl outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

/**
 * L'écran de la tablée : combien vous êtes, et jusqu'où vous allez.
 *
 * Le **nombre de joueurs** est la question de l'écran, et il en est une parce
 * que l'instantané de règles se fige à l'ouverture : sans lui, on ne saurait ni
 * borner la création ni savoir quelle fin imprimer — à Dnup, deux joueurs se
 * passent de jetons et jouent en manches gagnées.
 *
 * Le **seuil**, lui, n'est pas promu en étape : il est montré, pré-rempli à la
 * valeur imprimée, et se surcharge d'un entier ≥ 1. Il suit l'effectif tant que
 * personne n'y a touché, et se tait dès qu'on l'a tapé — sinon changer le
 * nombre de joueurs effacerait le « ce soir on s'arrête à 30 » qu'on venait
 * d'écrire.
 *
 * Composant client pour cette seule raison : le seuil imprimé dépend d'un champ
 * de la page. Tout le reste est un formulaire ordinaire, et rien n'est écrit
 * avant l'envoi.
 */
export function TableeFormulaire({
  action,
  entree,
  identite,
  reprise,
}: {
  action: ComponentProps<"form">["action"];
  entree: EntreeCatalogue;
  identite: IdentiteChoisie;
  /** Ce qui avait été tapé, quand un refus a renvoyé sur cet écran. */
  reprise?: { nombreDeJoueurs?: string | undefined; finValeur?: string | undefined } | undefined;
}): ReactElement {
  const { joueursMin, joueursMax } = entree.regles;
  const [nombreDeJoueurs, setNombreDeJoueurs] = useState(
    reprise?.nombreDeJoueurs ?? String(joueursMin),
  );
  const [seuilSurcharge, setSeuilSurcharge] = useState<string | null>(reprise?.finValeur ?? null);

  // Hors bornes, la règle imprimée n'existe pas ; le champ retombe alors sur
  // celle du plus petit effectif plutôt que de se vider. Un champ `required`
  // vidé ferait porter le refus par le navigateur, sans un mot sur la raison —
  // et il faudrait retaper le seuil après avoir corrigé l'effectif.
  const fin = finImprimee(entree, Number(nombreDeJoueurs));
  const finDeRepli = fin ?? finImprimee(entree, joueursMin);
  const seuil = seuilSurcharge ?? (finDeRepli === null ? "" : String(finDeRepli.valeur));

  return (
    <form action={action} method="post" className="flex flex-col gap-8">
      <input type="hidden" name="jeuId" value={entree.id} />
      <input type="hidden" name="mode" value={identite.mode} />
      {identite.mode === "roster" ? (
        <input type="hidden" name="joueurId" value={identite.joueurId} />
      ) : (
        <input type="hidden" name="nom" value={identite.nom} />
      )}

      <div className="flex flex-col gap-3">
        <label htmlFor="nombreDeJoueurs" className="font-semibold text-2xl tracking-tight">
          Vous êtes combien ?
        </label>
        <input
          id="nombreDeJoueurs"
          name="nombreDeJoueurs"
          type="number"
          inputMode="numeric"
          required
          min={joueursMin}
          max={joueursMax}
          value={nombreDeJoueurs}
          onChange={(evenement) => setNombreDeJoueurs(evenement.target.value)}
          className={CHAMP_NOMBRE}
        />
        <p className="text-muted-foreground text-sm">
          {`${entree.nom} se joue de ${joueursMin} à ${joueursMax} joueurs.`}
        </p>
      </div>

      <div className="flex flex-col gap-3">
        <label htmlFor="finValeur" className="font-medium text-sm">
          On s’arrête à
        </label>
        <input
          id="finValeur"
          name="finValeur"
          type="number"
          inputMode="numeric"
          required
          min={1}
          value={seuil}
          onChange={(evenement) => setSeuilSurcharge(evenement.target.value)}
          className={CHAMP_NOMBRE}
        />
        <p className="text-muted-foreground text-sm">
          {fin === null
            ? `${entree.nom} se joue de ${joueursMin} à ${joueursMax} joueurs : la partie sera refusée.`
            : `Règle imprimée : ${libelleDeFin(fin, entree.unite)}.`}
        </p>
      </div>

      <Button type="submit" size="lg">
        Ouvrir la partie
      </Button>
    </form>
  );
}
