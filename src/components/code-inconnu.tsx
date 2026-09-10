import type { ReactElement } from "react";
import { RejoindreParCode } from "@/components/rejoindre-par-code";

/** L'enveloppe commune aux deux impasses : un titre, une phrase, une sortie. */
function Impasse({ titre, phrase }: { titre: string; phrase: string }): ReactElement {
  return (
    <section className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h1 className="font-semibold text-2xl tracking-tight">{titre}</h1>
        <p className="text-muted-foreground text-sm">{phrase}</p>
      </div>
      <RejoindreParCode />
    </section>
  );
}

/**
 * L'état dédié d'un code que personne ne porte.
 *
 * **Un état à part entière**, et non la page d'erreur du framework : un code
 * mal retapé est le cas ordinaire — il se dicte à voix haute — et la seule
 * chose utile à faire est de le retaper. Ce qu'il ne fait jamais, c'est mener à
 * la partie de quelqu'un d'autre : c'est pour ça qu'un code n'est jamais
 * recyclé.
 *
 * Il ne dit pas non plus *pourquoi* : « ce code n'existe pas » est la même
 * réponse pour qui se trompe d'une lettre et pour qui invente.
 */
export function CodeInconnu(): ReactElement {
  return (
    <Impasse
      titre="Ce code ne mène à aucune partie"
      phrase="Une lettre de travers, peut-être. Redemande-le à la table et retape-le."
    />
  );
}

/**
 * L'état d'une recherche fermée par la limite de débit.
 *
 * Distinct du code inconnu, et c'est le seul endroit du parcours où la limite
 * se voit : confondre les deux ferait retaper indéfiniment quelqu'un dont
 * chaque essai est refusé d'avance.
 */
export function TropDeTentatives(): ReactElement {
  return (
    <Impasse
      titre="Trop d’essais"
      phrase="Beaucoup de codes ont été tentés depuis ici. Reprends dans une minute."
    />
  );
}
