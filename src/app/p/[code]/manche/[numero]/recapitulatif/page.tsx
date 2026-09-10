import { notFound } from "next/navigation";
import type { ReactElement } from "react";
import { Recapitulatif } from "@/components/recapitulatif";
import { db } from "@/db";
import { evaluerLaPartie, lireLaManche } from "@/lib/manche/lecture";
import { numeroDeMancheSchema } from "@/lib/manche/ouverture";
import { lirePartieParCode } from "@/lib/partie/lecture";

/** Jamais mise en cache : c'est ici qu'on vient voir bouger les totaux. */
export const dynamic = "force-dynamic";

/**
 * Le récapitulatif d'une manche : la suite de la passe avant.
 *
 * Les totaux viennent du **moteur** et d'aucun calcul local, la manche en cours
 * comprise : on voit le seuil arriver avant que la manche ne soit close, ce qui
 * est exactement ce qui rend la correction possible tant qu'elle vaut encore.
 */
export default async function PageDeRecapitulatif(
  props: PageProps<"/p/[code]/manche/[numero]/recapitulatif">,
): Promise<ReactElement> {
  const parametres = await props.params;
  const numero = numeroDeMancheSchema.safeParse(parametres.numero);
  const partie = await lirePartieParCode(db, parametres.code);

  if (!numero.success || partie === null) {
    notFound();
  }

  const manche = await lireLaManche(db, partie.id, numero.data);

  if (manche === null) {
    notFound();
  }

  const etat = await evaluerLaPartie(db, partie.id, partie.regles);

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-4 py-8">
      <Recapitulatif
        manche={manche}
        totaux={etat.totaux}
        unite={partie.jeu.unite}
        adresseDeLaManche={`/p/${partie.code}/manche/${manche.numero}`}
      />
      <a href={`/p/${partie.code}`} className="text-muted-foreground text-sm underline">
        Retour à la partie
      </a>
    </main>
  );
}
