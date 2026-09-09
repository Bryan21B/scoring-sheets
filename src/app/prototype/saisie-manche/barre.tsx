"use client";

/**
 * PROTOTYPE JETABLE — barre de bascule entre variantes, issue #8.
 *
 * Volontairement laide et flottante : elle ne fait pas partie du design évalué.
 * Masquée en production, pour qu'une fusion distraite ne l'expédie pas aux
 * utilisateurs.
 */

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { JEUX } from "./modele";

type Variante = { cle: string; nom: string };

/** La variante servie quand l'URL n'en désigne aucune de valide. */
const VARIANTE_PAR_DEFAUT: Variante = { cle: "A", nom: "La liste" };

/** Les variantes, dans l'ordre de bascule. */
export const VARIANTES: readonly Variante[] = [
  VARIANTE_PAR_DEFAUT,
  { cle: "B", nom: "Un joueur à la fois" },
  { cle: "C", nom: "La grille" },
];

/** La variante à `index` positions de la première, en bouclant dans les deux sens. */
function varianteA(index: number): Variante {
  const borne = ((index % VARIANTES.length) + VARIANTES.length) % VARIANTES.length;
  return VARIANTES[borne] ?? VARIANTE_PAR_DEFAUT;
}

export function BarrePrototype({ variante, jeu }: { variante: string; jeu: string }) {
  const router = useRouter();
  const index = Math.max(
    0,
    VARIANTES.findIndex((v) => v.cle === variante),
  );

  useEffect(() => {
    function aller(pas: number) {
      const suivante = varianteA(index + pas);
      router.replace(`/prototype/saisie-manche?variant=${suivante.cle}&jeu=${jeu}`);
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
  }, [index, jeu, router]);

  if (process.env.NODE_ENV === "production") {
    return null;
  }

  const courante = varianteA(index);
  const lien = (cle: string, idJeu: string) =>
    `/prototype/saisie-manche?variant=${cle}&jeu=${idJeu}`;

  return (
    <div className="fixed inset-x-0 bottom-0 z-50 flex justify-center p-2">
      <div className="flex flex-col items-center gap-1.5 rounded-2xl bg-neutral-900 px-2 py-2 text-white shadow-xl ring-1 ring-white/10">
        <div className="flex items-center gap-1">
          <a
            href={lien(varianteA(index - 1).cle, jeu)}
            className="rounded-lg px-2.5 py-1 text-sm hover:bg-white/10"
          >
            ←
          </a>
          <span className="min-w-[11rem] text-center font-medium text-xs">
            {courante.cle} · {courante.nom}
          </span>
          <a
            href={lien(varianteA(index + 1).cle, jeu)}
            className="rounded-lg px-2.5 py-1 text-sm hover:bg-white/10"
          >
            →
          </a>
        </div>
        <div className="flex gap-1">
          {JEUX.map((entree) => (
            <a
              key={entree.id}
              href={lien(courante.cle, entree.id)}
              className={
                entree.id === jeu
                  ? "rounded-full bg-white px-2.5 py-0.5 text-[11px] text-neutral-900"
                  : "rounded-full px-2.5 py-0.5 text-[11px] text-white/60 hover:bg-white/10"
              }
            >
              {entree.court}
            </a>
          ))}
        </div>
      </div>
    </div>
  );
}
