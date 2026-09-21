import type { ReactElement } from "react";
import { CHAMP_CODE } from "@/components/champs";
import { Button } from "@/components/ui/button";
import { LONGUEUR_CODE } from "@/lib/partie/code";

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
      <label htmlFor="code" className="font-semibold text-sm">
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
      <Button type="submit" size="lg" variant="outline" className="w-full">
        Rejoindre la partie
      </Button>
    </form>
  );
}
