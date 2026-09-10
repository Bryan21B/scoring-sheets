import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import type { ReactElement } from "react";
import { z } from "zod";
import { ecrireLaCaseAction } from "@/app/p/[code]/actions";
import { SaisieDeCase } from "@/components/saisie-de-case";
import { db } from "@/db";
import { NOM_COOKIE_APPAREIL } from "@/lib/appareil/cookie";
import { lireLeJoueurDeLAppareil } from "@/lib/appareil/lecture";
import { adresseDuTiroir } from "@/lib/journal/tiroir";
import { lireLaManche } from "@/lib/manche/lecture";
import { numeroDeMancheSchema } from "@/lib/manche/ouverture";
import { caseDeDepart } from "@/lib/manche/passe-avant";
import { bornesDeSaisie } from "@/lib/manche/saisie";
import { premierParametre } from "@/lib/partie/identite-url";
import { lirePartieParCode } from "@/lib/partie/lecture";

/**
 * Le joueur que le récapitulatif désigne pour être retapé.
 *
 * Il vient de l'adresse, donc de l'extérieur, donc d'un schéma : `?joueur=abc`
 * coercé sans regarder donnerait un `NaN` qui se promènerait jusqu'au choix de
 * la case de départ. Une valeur illisible se lit « rien demandé », et l'écran
 * retombe sur l'appareil.
 */
const joueurDemandeSchema = z.coerce.number().int().positive();

/**
 * Jamais mise en cache : la manche bouge sous cinq téléphones. La page ne poll
 * pas pour autant — elle ne montre rien qui puisse changer sous les doigts.
 */
export const dynamic = "force-dynamic";

/**
 * La passe avant : **une case, un écran**.
 *
 * Elle démarre sur le joueur de l'appareil, et sur la première case manquante
 * quand l'appareil n'est rattaché à aucun participant. Le paramètre `joueur`
 * l'emporte : c'est par lui que le récapitulatif renvoie retaper une ligne
 * précise, et que l'on saisit pour un participant sans appareil.
 *
 * Ce n'est que du câblage : la décision du démarrage vit dans `caseDeDepart`,
 * pure et vérifiée à part, et le choix entre le pavé et l'écran de refus dans
 * `VueDeSaisie`.
 *
 * L'adresse du tiroir part d'ici plutôt que d'être fabriquée par l'écran de
 * refus : c'est la page qui connaît le code de la partie, et le refus n'a
 * besoin que d'un endroit où envoyer qui veut savoir qui a écrit.
 */
export default async function PageDeSaisie(
  props: PageProps<"/p/[code]/manche/[numero]">,
): Promise<ReactElement> {
  const parametres = await props.params;
  const numero = numeroDeMancheSchema.safeParse(parametres.numero);
  const partie = await lirePartieParCode(db, parametres.code);

  if (!numero.success || partie === null) {
    notFound();
  }

  // Les deux autres modes de saisie suivent leur propre ticket, sur les mêmes
  // rails : cet écran ne sait taper qu'un entier par joueur, et prétendre le
  // contraire écrirait une valeur qui ne veut rien dire.
  const bornes = bornesDeSaisie(partie.regles);

  if (bornes === null) {
    notFound();
  }

  const manche = await lireLaManche(db, partie.id, numero.data);

  if (manche === null) {
    notFound();
  }

  const adresse = `/p/${partie.code}/manche/${manche.numero}`;
  const recapitulatif = `${adresse}/recapitulatif`;
  const demande = joueurDemandeSchema.safeParse(
    premierParametre((await props.searchParams).joueur),
  );
  const cible = demande.success
    ? demande.data
    : await lireLeJoueurDeLAppareil(db, (await cookies()).get(NOM_COOKIE_APPAREIL)?.value);
  const caseASaisir = caseDeDepart(manche.cases, cible);

  // Plus rien à saisir et aucune case à soi : la passe avant s'arrête là, et
  // c'est le récapitulatif qui prend la main.
  if (caseASaisir === undefined) {
    redirect(recapitulatif);
  }

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col px-4 py-8">
      <SaisieDeCase
        action={ecrireLaCaseAction.bind(null, { code: partie.code, numero: manche.numero })}
        cadre={{
          mancheId: manche.id,
          mancheNumero: manche.numero,
          caseASaisir,
          max: bornes.max,
          unite: partie.jeu.unite,
          recapitulatif,
          journal: adresseDuTiroir(partie.code, "corrections"),
        }}
      />
    </main>
  );
}
