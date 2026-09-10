import type { ReactElement } from "react";

/**
 * Le refus qu'une écriture a renvoyé par l'adresse, montré au-dessus du reste.
 *
 * Il vit dans son propre composant parce que **deux écrans le portent** : la
 * page d'une partie vivante et la fiche d'une partie scellée sont la même
 * adresse, `/p/<code>`, et un geste refusé y revient sans savoir laquelle des
 * deux l'accueillera. Un refus qui ne s'afficherait que sur l'une des deux
 * serait un bouton qui ne fait rien et ne dit pas pourquoi — précisément le cas
 * de Marie dont le téléphone était resté sur la tablée pendant que Paul closait
 * la manche qui a terminé la partie.
 *
 * `role="alert"` parce que la page se recharge sous le message : il doit se
 * faire lire par qui ne regarde pas l'écran au bon moment.
 *
 * Prend le message déjà validé — `messageDeRefusSchema` l'a plafonné à une
 * phrase — et non le paramètre brut : rien ne prouve qu'un `?erreur=` sorte de
 * notre propre redirection, et ce composant n'est pas le bon endroit pour s'en
 * assurer.
 */
export function BandeauDeRefus({ message }: { message: string | undefined }): ReactElement | null {
  if (message === undefined) {
    return null;
  }

  return (
    <p role="alert" className="rounded-lg bg-destructive/10 p-3 text-destructive text-sm">
      {message}
    </p>
  );
}
