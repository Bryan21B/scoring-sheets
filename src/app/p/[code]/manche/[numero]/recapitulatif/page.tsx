import { notFound } from "next/navigation";
import type { ReactElement } from "react";
import { cloturerLaMancheAction } from "@/app/p/[code]/actions";
import { ClotureDeManche } from "@/components/cloture-de-manche";
import { Ecran } from "@/components/ecran";
import { Recapitulatif } from "@/components/recapitulatif";
import { db } from "@/db";
import { evaluerLaPartie, lireLaManche } from "@/lib/manche/lecture";
import { numeroDeMancheSchema } from "@/lib/manche/ouverture";
import { adresseDePartie } from "@/lib/partie/adresse";
import { lirePartieParCode } from "@/lib/partie/lecture";

/** Jamais mise en cache : c'est ici qu'on vient voir bouger les totaux. */
export const dynamic = "force-dynamic";

/**
 * Le récapitulatif d'une manche : la suite de la passe avant.
 *
 * Les totaux viennent du **moteur** et d'aucun calcul local, la manche en cours
 * comprise : on voit le seuil arriver avant que la manche ne soit close, ce qui
 * est exactement ce qui rend la correction possible tant qu'elle vaut encore.
 *
 * Elle ne calcule **jamais** `fini` et n'annonce donc aucune fin : l'alerte sort
 * de la clôture et de nulle part ailleurs, sans quoi elle s'allumerait puis
 * s'éteindrait au gré des corrections. C'est aussi d'ici que part la clôture,
 * parce que c'est ici qu'on vient vérifier la manche avant de la déclarer finie.
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

  const adresseDeLaPartie = adresseDePartie(partie.code);

  return (
    <Ecran>
      <Recapitulatif
        manche={manche}
        totaux={etat.totaux}
        regles={partie.regles}
        unite={partie.jeu.unite}
        adresseDeLaManche={`${adresseDeLaPartie}/manche/${manche.numero}`}
      />

      <ClotureDeManche
        action={cloturerLaMancheAction.bind(null, partie.code)}
        mancheId={manche.id}
        partie={adresseDeLaPartie}
      />

      <a href={adresseDeLaPartie} className="text-muted-foreground text-sm underline">
        Retour à la partie
      </a>
    </Ecran>
  );
}
