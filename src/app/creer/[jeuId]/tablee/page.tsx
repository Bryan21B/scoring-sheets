import { notFound, redirect } from "next/navigation";
import type { ReactElement } from "react";
import { creerPartieAction } from "@/app/creer/actions";
import { TableeFormulaire } from "@/components/tablee-formulaire";
import { jeuIdSchema, trouverEntree } from "@/lib/jeux/catalogue";
import {
  lireIdentiteChoisie,
  messageDeRefusSchema,
  premierParametre,
} from "@/lib/partie/identite-url";

/**
 * Troisième et dernier écran de la création : la tablée.
 *
 * L'identité vient de l'adresse et n'est toujours pas écrite ; sans elle, on
 * retourne poser la question plutôt que d'ouvrir une partie sans personne
 * dedans. C'est le seul écran du parcours dont la validation écrit.
 */
export default async function Tablee(
  props: PageProps<"/creer/[jeuId]/tablee">,
): Promise<ReactElement> {
  const jeuId = jeuIdSchema.safeParse((await props.params).jeuId);

  if (!jeuId.success) {
    notFound();
  }

  const recherche = await props.searchParams;
  const identite = lireIdentiteChoisie(recherche);

  if (identite === null) {
    redirect(`/creer/${jeuId.data}`);
  }

  // Le message vient de l'adresse, donc de l'extérieur : il est rendu dans la
  // page, et rien ne dit qu'il sort de notre propre redirection.
  const erreur = messageDeRefusSchema.safeParse(premierParametre(recherche.erreur));

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-4 py-8">
      {erreur.success ? (
        <p role="alert" className="rounded-lg bg-destructive/10 p-3 text-destructive text-sm">
          {erreur.data}
        </p>
      ) : null}
      <TableeFormulaire
        action={creerPartieAction}
        entree={trouverEntree(jeuId.data)}
        identite={identite}
        reprise={{
          nombreDeJoueurs: premierParametre(recherche.nombreDeJoueurs),
          finValeur: premierParametre(recherche.finValeur),
        }}
      />
    </main>
  );
}
