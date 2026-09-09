import type { ReactElement } from "react";
import { Button } from "@/components/ui/button";
import type { JeuId } from "@/lib/jeux/catalogue";
import type { JoueurConnu } from "@/lib/roster/noms";

/** Classes du champ texte, partagées par les deux formulaires de l'écran. */
const CHAMP_NOM =
  "h-10 w-full rounded-lg border border-border bg-background px-3 text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

/**
 * « Qui es-tu ? » — le roster global, et le champ nouveau nom.
 *
 * Le champ est **toujours affiché**, roster vide compris : une liste vide est
 * une liste vide, et un premier lancement n'a pas à être un cas particulier.
 *
 * Deux formulaires plutôt qu'un : « j'ai choisi Marie dans la liste » et « j'ai
 * tapé Marie » ne veulent pas dire la même chose, et c'est cette différence que
 * la désambiguïsation exploite. Les deux repartent en `GET` sur la même adresse,
 * si bien que **rien n'est écrit** tant que la tablée n'est pas validée.
 */
export function Identification({
  jeuId,
  roster,
  nomPropose,
  homonymes,
}: {
  jeuId: JeuId;
  roster: readonly JoueurConnu[];
  nomPropose?: string | undefined;
  homonymes?: readonly JoueurConnu[] | undefined;
}): ReactElement {
  const aTrancher = homonymes !== undefined && homonymes.length > 0 && nomPropose !== undefined;
  const destination = `/creer/${jeuId}`;

  return (
    <div className="flex flex-col gap-8">
      <h1 className="font-semibold text-2xl tracking-tight">Qui es-tu ?</h1>

      {aTrancher ? (
        <Desambiguisation destination={destination} nomPropose={nomPropose} homonymes={homonymes} />
      ) : null}

      {roster.length > 0 && !aTrancher ? (
        <form action={destination} method="get" className="flex flex-col gap-3">
          <ul className="-mx-4 flex w-auto flex-col divide-y divide-border border-border border-y">
            {roster.map((joueur) => (
              <li key={joueur.id}>
                <label className="flex w-full cursor-pointer items-center gap-3 px-4 py-3 text-base">
                  <input type="radio" name="joueurId" value={joueur.id} required />
                  {joueur.nom}
                </label>
              </li>
            ))}
          </ul>
          <Button type="submit" size="lg">
            C’est moi
          </Button>
        </form>
      ) : null}

      <form action={destination} method="get" className="flex flex-col gap-3">
        <label htmlFor="nom" className="font-medium text-sm">
          {aTrancher ? "Un nom distinctif" : "Un nouveau nom"}
        </label>
        <input
          id="nom"
          name="nom"
          type="text"
          autoComplete="off"
          required
          defaultValue={nomPropose ?? ""}
          placeholder={aTrancher ? "Marie B." : "Marie"}
          className={CHAMP_NOM}
        />
        <Button type="submit" size="lg" variant={aTrancher ? "default" : "outline"}>
          Continuer
        </Button>
      </form>
    </div>
  );
}

/**
 * La question qu'un homonyme pose, et qu'on ne tranche pas à la place de
 * l'humain.
 *
 * Aucun suffixe automatique : « Marie (2) » choisit pour lui, et c'est lui qui
 * relira la liste. Le roster n'a d'ailleurs **aucune contrainte d'unicité** —
 * deux personnes peuvent vraiment s'appeler Marie — c'est ici, et seulement
 * ici, que le doublon se paie d'un geste.
 */
function Desambiguisation({
  destination,
  nomPropose,
  homonymes,
}: {
  destination: string;
  nomPropose: string;
  homonymes: readonly JoueurConnu[];
}): ReactElement {
  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border bg-muted/40 p-4">
      <p className="font-medium text-base">{`${nomPropose} existe déjà.`}</p>
      <p className="text-muted-foreground text-sm">
        {`C’est elle, ou une autre ${nomPropose} ? Si c’est une autre, donne-lui un nom distinctif.`}
      </p>
      <ul className="flex flex-col gap-2">
        {homonymes.map((joueur) => (
          <li key={joueur.id}>
            <form action={destination} method="get">
              <input type="hidden" name="joueurId" value={joueur.id} />
              <Button type="submit" size="lg" variant="outline" className="w-full">
                {`C’est elle — ${joueur.nom}`}
              </Button>
            </form>
          </li>
        ))}
      </ul>
    </div>
  );
}
