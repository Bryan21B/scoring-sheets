/**
 * PROTOTYPE JETABLE — trois variantes de la saisie d'une manche, sur
 * `/prototype/saisie-manche?variant=A|B|C&jeu=6-qui-prend|uno|dnup`.
 *
 * Répond à l'issue #8, sous la carte #1. Rien ici n'est destiné à `main` :
 * la variante retenue sera réécrite proprement, le reste part sur une branche
 * jetable. Aucune persistance, aucun test, aucune Server Action.
 */

import { BarrePrototype } from "./barre";
import { jeuParId } from "./modele";
import { VarianteGrille } from "./variante-grille";
import { VarianteListe } from "./variante-liste";
import { VarianteSequence } from "./variante-sequence";

export const metadata = { title: "Prototype — saisie d'une manche" };

export default async function PageSaisieManche({
  searchParams,
}: {
  searchParams: Promise<{ variant?: string; jeu?: string }>;
}) {
  const { variant, jeu: idJeu } = await searchParams;
  const jeu = jeuParId(idJeu);
  const variante = variant === "B" || variant === "C" ? variant : "A";

  return (
    <main className="mx-auto w-full max-w-md flex-1 p-4">
      <p className="mb-3 rounded-lg border border-dashed px-3 py-1.5 text-[11px] text-muted-foreground">
        Maquette jetable — <strong>{jeu.nom}</strong>, saisie{" "}
        <code className="font-mono">{jeu.mode}</code>. Bascule en bas de l'écran, ou flèches ← →.
      </p>

      {variante === "A" && <VarianteListe jeu={jeu} />}
      {variante === "B" && <VarianteSequence jeu={jeu} />}
      {variante === "C" && <VarianteGrille jeu={jeu} />}

      <BarrePrototype variante={variante} jeu={jeu.id} />
    </main>
  );
}
