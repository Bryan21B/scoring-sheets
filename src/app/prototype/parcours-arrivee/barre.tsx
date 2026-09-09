"use client";

/**
 * PROTOTYPE JETABLE — barre de bascule, issue #9.
 *
 * Volontairement laide : elle ne fait pas partie du design évalué. Masquée en
 * production, pour qu'une fusion distraite ne l'expédie pas aux utilisateurs.
 */

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { ECRANS, type EcranId } from "./modele";

type Variante = { cle: string; nom: string };

const VARIANTE_PAR_DEFAUT: Variante = { cle: "A", nom: "Le fil" };

/** Les variantes, dans l'ordre de bascule. */
export const VARIANTES: readonly Variante[] = [
  VARIANTE_PAR_DEFAUT,
  { cle: "B", nom: "Les tuiles" },
  { cle: "C", nom: "La reprise" },
];

/** La variante à `index` positions de la première, en bouclant dans les deux sens. */
export function varianteA(index: number): Variante {
  const borne = ((index % VARIANTES.length) + VARIANTES.length) % VARIANTES.length;
  return VARIANTES[borne] ?? VARIANTE_PAR_DEFAUT;
}

export function BarrePrototype({ variante, ecran }: { variante: string; ecran: EcranId }) {
  const router = useRouter();
  const index = Math.max(
    0,
    VARIANTES.findIndex((v) => v.cle === variante),
  );

  useEffect(() => {
    function aller(pas: number) {
      router.replace(
        `/prototype/parcours-arrivee?variant=${varianteA(index + pas).cle}&ecran=${ecran}`,
      );
    }
    function onTouche(evenement: KeyboardEvent) {
      const cible = evenement.target;
      if (cible instanceof HTMLElement) {
        const nom = cible.tagName;
        if (nom === "INPUT" || nom === "TEXTAREA" || cible.isContentEditable) {
          return;
        }
      }
      if (evenement.key === "ArrowLeft") {
        aller(-1);
      }
      if (evenement.key === "ArrowRight") {
        aller(1);
      }
    }
    window.addEventListener("keydown", onTouche);
    return () => window.removeEventListener("keydown", onTouche);
  }, [index, ecran, router]);

  if (process.env.NODE_ENV === "production") {
    return null;
  }

  const courante = varianteA(index);
  const lien = (cle: string, id: string) =>
    `/prototype/parcours-arrivee?variant=${cle}&ecran=${id}`;

  return (
    <div className="fixed inset-x-0 bottom-0 z-50 flex justify-center p-2">
      <div className="flex max-w-[22rem] flex-col items-center gap-1.5 rounded-2xl bg-neutral-900 px-2 py-2 text-white shadow-xl ring-1 ring-white/10">
        <div className="flex items-center gap-1">
          <a
            href={lien(varianteA(index - 1).cle, ecran)}
            className="rounded-lg px-2.5 py-1 text-sm hover:bg-white/10"
          >
            ←
          </a>
          <span className="min-w-[9rem] text-center font-medium text-xs">
            {courante.cle} · {courante.nom}
          </span>
          <a
            href={lien(varianteA(index + 1).cle, ecran)}
            className="rounded-lg px-2.5 py-1 text-sm hover:bg-white/10"
          >
            →
          </a>
        </div>
        <div className="flex flex-wrap justify-center gap-1">
          {ECRANS.map((e) => (
            <a
              key={e.id}
              href={lien(courante.cle, e.id)}
              className={
                e.id === ecran
                  ? "rounded-full bg-white px-2 py-0.5 text-[10px] text-neutral-900"
                  : "rounded-full px-2 py-0.5 text-[10px] text-white/60 hover:bg-white/10"
              }
            >
              {e.nom}
            </a>
          ))}
        </div>
      </div>
    </div>
  );
}
