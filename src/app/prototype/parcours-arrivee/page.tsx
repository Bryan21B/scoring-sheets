/**
 * PROTOTYPE JETABLE — trois variantes du parcours d'arrivée, sur
 * `/prototype/parcours-arrivee?variant=A|B|C&ecran=<id>`.
 *
 * Répond à l'issue #9, sous la carte #1. La logique du parcours est déjà
 * tranchée par `docs/specs/2026-08-31-identite-et-arrivee.md` — réclamer contre
 * rejoindre, le gel à la première manche, le spectateur mécanique. Ce prototype
 * ne la rediscute pas : il cherche la forme. Rien ici n'est destiné à `main`.
 */

import { BarrePrototype } from "./barre";
import { ecranParId, nomEcran } from "./modele";
import { VarianteFil } from "./variante-fil";
import { VarianteReprise } from "./variante-reprise";
import { VarianteTuiles } from "./variante-tuiles";

export const metadata = { title: "Prototype — parcours d'arrivée" };

export default async function PageParcours({
  searchParams,
}: {
  searchParams: Promise<{ variant?: string; ecran?: string }>;
}) {
  const { variant, ecran: idEcran } = await searchParams;
  const ecran = ecranParId(idEcran);
  const variante = variant === "B" || variant === "C" ? variant : "A";

  return (
    <main className="mx-auto w-full max-w-md flex-1 p-4 pb-40">
      <p className="mb-3 rounded-lg border border-dashed px-3 py-1.5 text-[11px] text-muted-foreground">
        Maquette jetable — écran <strong>{nomEcran(ecran)}</strong>. Bascule en bas, ou flèches ← →.
      </p>

      {variante === "A" && <VarianteFil ecran={ecran} />}
      {variante === "B" && <VarianteTuiles ecran={ecran} />}
      {variante === "C" && <VarianteReprise ecran={ecran} />}

      <BarrePrototype variante={variante} ecran={ecran} />
    </main>
  );
}
