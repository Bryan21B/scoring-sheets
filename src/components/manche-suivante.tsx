import type { ReactElement } from "react";
import type { Action } from "@/components/champs";
import { Button } from "@/components/ui/button";

/**
 * Le geste principal de la soirée : **un appui, et on tape**.
 *
 * Il n'y a pas de bouton « démarrer » — « saisir la manche suivante » en tient
 * lieu sur une partie qui n'a pas commencé, sans jamais l'annoncer, et c'est la
 * première manche saisie qui gèle la tablée.
 *
 * Rendu par l'accueil comme par la page d'une partie, à l'identique : c'est le
 * même geste, et deux libellés feraient croire à deux gestes différents.
 *
 * Appuyer deux fois, ou à deux téléphones, ne crée pas deux manches : l'unicité
 * `(partie, numéro)` fait rejoindre la même.
 */
export function MancheSuivante({ action }: { action: Action }): ReactElement {
  return (
    <form action={action} method="post">
      <Button type="submit" size="lg" className="w-full">
        Saisir la manche suivante
      </Button>
    </form>
  );
}
