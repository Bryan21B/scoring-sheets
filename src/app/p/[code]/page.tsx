import { notFound } from "next/navigation";
import type { ReactElement } from "react";
import { ouvrirLaMancheSuivanteAction } from "@/app/p/[code]/actions";
import { PartieEntete } from "@/components/partie-entete";
import { Button } from "@/components/ui/button";
import { db } from "@/db";
import { lirePartieParCode } from "@/lib/partie/lecture";

/**
 * Jamais mise en cache : le code désigne une partie qui bouge, et une page
 * gardée montrerait la tablée d'il y a dix minutes.
 */
export const dynamic = "force-dynamic";

/**
 * La page d'une partie, atteinte par son code.
 *
 * Le code **est** l'adresse, et il donne la lecture : la page ne demande à
 * personne qui il est, et montre donc son code à tous ceux qui l'ouvrent — le
 * créateur n'a aucun statut particulier ici.
 */
export default async function PageDePartie(props: PageProps<"/p/[code]">): Promise<ReactElement> {
  const partie = await lirePartieParCode(db, (await props.params).code);

  if (partie === null) {
    notFound();
  }

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-4 py-8">
      <PartieEntete partie={partie} />

      {/* Appuyer deux fois, ou à deux téléphones, ne crée pas deux manches :
          l'unicité (partie, numéro) fait rejoindre la même. */}
      <form action={ouvrirLaMancheSuivanteAction.bind(null, partie.code)} method="post">
        <Button type="submit" size="lg" className="w-full">
          Saisir la manche suivante
        </Button>
      </form>
    </main>
  );
}
