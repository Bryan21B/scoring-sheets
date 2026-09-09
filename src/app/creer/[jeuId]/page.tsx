import { notFound, redirect } from "next/navigation";
import type { ReactElement } from "react";
import { Identification } from "@/components/identification";
import { db } from "@/db";
import { type JeuId, jeuIdSchema } from "@/lib/jeux/catalogue";
import { ecrireIdentiteChoisie, lireIdentiteChoisie } from "@/lib/partie/identite-url";
import { listerLeRoster } from "@/lib/roster/lecture";
import { evaluerNom } from "@/lib/roster/noms";

/** L'écran suivant, une fois l'identité sans ambiguïté. */
function versLaTablee(jeuId: JeuId, recherche: URLSearchParams): never {
  redirect(`/creer/${jeuId}/tablee?${recherche.toString()}`);
}

/**
 * Deuxième écran de la création : « qui es-tu ? ».
 *
 * Une seule adresse pour toute la question, désambiguïsation comprise : l'écran
 * se relit avec le nom tapé en paramètre, et ne part vers la tablée qu'une fois
 * l'identité tranchée. **Rien n'est écrit ici** — ni joueur, ni partie — donc
 * un retour arrière n'a rien à défaire, et un homonyme se rejoue autant de fois
 * qu'il le faut.
 */
export default async function QuiEsTu(props: PageProps<"/creer/[jeuId]">): Promise<ReactElement> {
  const jeuId = jeuIdSchema.safeParse((await props.params).jeuId);

  if (!jeuId.success) {
    notFound();
  }

  const identite = lireIdentiteChoisie(await props.searchParams);
  const roster = await listerLeRoster(db);

  // Un joueur pris dans la liste ne pose aucune question : c'est déjà une ligne
  // du roster, et deux Marie n'y sont pas la même.
  if (identite?.mode === "roster") {
    versLaTablee(jeuId.data, ecrireIdentiteChoisie(identite));
  }

  const decision = identite === null ? null : evaluerNom(identite.nom, roster);

  if (decision?.statut === "creer") {
    versLaTablee(jeuId.data, ecrireIdentiteChoisie({ mode: "nouveau", nom: decision.nom }));
  }

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-4 py-8">
      <Identification
        jeuId={jeuId.data}
        roster={roster}
        nomPropose={decision?.nom}
        homonymes={decision?.statut === "desambiguiser" ? decision.homonymes : undefined}
      />
    </main>
  );
}
