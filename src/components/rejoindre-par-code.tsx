import type { ReactElement } from "react";
import { Button } from "@/components/ui/button";
import { LONGUEUR_CODE } from "@/lib/partie/code";

/** Classes du champ : gros, espacé, en capitales — un code se dicte et se retape. */
const CHAMP_CODE =
  "h-12 w-full rounded-lg border border-border bg-background px-3 text-center font-mono text-xl uppercase tracking-[0.3em] outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

/**
 * « J'ai un code » — l'autre bout de la même chaîne que le lien partagé.
 *
 * En `GET` sur `/rejoindre`, qui normalise puis renvoie sur l'adresse de la
 * partie : les deux chemins d'arrivée se rejoignent donc **avant** toute
 * lecture, et il n'existe qu'une façon de trouver une partie.
 *
 * Aucun `pattern` HTML sur le champ : les minuscules, les `O`, les `I` et les
 * `L` sont **acceptés** puis normalisés, et un refus posé par le navigateur
 * ferait payer à celui qui retape une confusion que le format existe pour
 * absorber.
 */
export function RejoindreParCode(): ReactElement {
  return (
    <form action="/rejoindre" method="get" className="flex flex-col gap-3">
      <label htmlFor="code" className="font-medium text-sm">
        On t’a donné un code ?
      </label>
      <input
        id="code"
        name="code"
        type="text"
        inputMode="text"
        autoComplete="off"
        autoCapitalize="characters"
        autoCorrect="off"
        spellCheck={false}
        required
        maxLength={LONGUEUR_CODE + 2}
        placeholder="A1B2C3"
        className={CHAMP_CODE}
      />
      <Button type="submit" size="lg" variant="outline">
        Rejoindre la partie
      </Button>
    </form>
  );
}
