/**
 * PROTOTYPE JETABLE — trois variantes de la fin de partie, sur
 * `/prototype/fin-de-partie?variant=A|B|C&etat=fin|exaequo|revisite&jeu=<id>`.
 *
 * Répond à l'issue #10, sous la carte #1. L'animation compte autant que la mise
 * en page ici, donc les confettis sont réels : ils se tirent au montage, et pas
 * du tout sur l'état « rouvert trois jours après ». Rien ici n'est destiné à
 * `main`.
 */

import { BarrePrototype } from "./barre";
import { etatParId, jeuParId, nomEtat } from "./modele";
import { VarianteClassement } from "./variante-classement";
import { VarianteCourbe } from "./variante-courbe";
import { VariantePodium } from "./variante-podium";

export const metadata = { title: "Prototype — fin de partie" };

export default async function PageFinDePartie({
  searchParams,
}: {
  searchParams: Promise<{ variant?: string; etat?: string; jeu?: string }>;
}) {
  const { variant, etat: idEtat, jeu: idJeu } = await searchParams;
  const etat = etatParId(idEtat);
  const jeu = jeuParId(idJeu);
  const variante = variant === "B" || variant === "C" ? variant : "A";

  return (
    <main className="relative mx-auto w-full max-w-md flex-1 p-4 pb-44">
      <p className="mb-3 rounded-lg border border-dashed px-3 py-1.5 text-[11px] text-muted-foreground">
        Maquette jetable — <strong>{nomEtat(etat)}</strong>, {jeu.nom}. Recharge la page pour
        rejouer l&apos;animation. Bascule en bas, ou flèches ← →.
      </p>

      {variante === "A" && <VariantePodium jeu={jeu} etat={etat} />}
      {variante === "B" && <VarianteCourbe jeu={jeu} etat={etat} />}
      {variante === "C" && <VarianteClassement jeu={jeu} etat={etat} />}

      <BarrePrototype variante={variante} etat={etat} jeu={jeu.id} />
    </main>
  );
}
