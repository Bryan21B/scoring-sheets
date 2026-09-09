"use client";

/** PROTOTYPE JETABLE — barre de bascule, issue #10. Masquée en production. */

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { ETATS, type EtatId, JEUX } from "./modele";

type Variante = { cle: string; nom: string };

const VARIANTE_PAR_DEFAUT: Variante = { cle: "A", nom: "Le podium" };

/** Les variantes, dans l'ordre de bascule. */
export const VARIANTES: readonly Variante[] = [
  VARIANTE_PAR_DEFAUT,
  { cle: "B", nom: "La courbe" },
  { cle: "C", nom: "Le classement sec" },
];

/** La variante à `index` positions de la première, en bouclant dans les deux sens. */
export function varianteA(index: number): Variante {
  const borne = ((index % VARIANTES.length) + VARIANTES.length) % VARIANTES.length;
  return VARIANTES[borne] ?? VARIANTE_PAR_DEFAUT;
}

export function BarrePrototype({
  variante,
  etat,
  jeu,
}: {
  variante: string;
  etat: EtatId;
  jeu: string;
}) {
  const router = useRouter();
  const index = Math.max(
    0,
    VARIANTES.findIndex((v) => v.cle === variante),
  );

  useEffect(() => {
    function aller(pas: number) {
      router.replace(
        `/prototype/fin-de-partie?variant=${varianteA(index + pas).cle}&etat=${etat}&jeu=${jeu}`,
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
  }, [index, etat, jeu, router]);

  if (process.env.NODE_ENV === "production") {
    return null;
  }

  const courante = varianteA(index);
  const lien = (cle: string, e: string, j: string) =>
    `/prototype/fin-de-partie?variant=${cle}&etat=${e}&jeu=${j}`;

  return (
    <div className="fixed inset-x-0 bottom-0 z-50 flex justify-center p-2">
      <div className="flex max-w-[22rem] flex-col items-center gap-1.5 rounded-2xl bg-neutral-900 px-2 py-2 text-white shadow-xl ring-1 ring-white/10">
        <div className="flex items-center gap-1">
          <a
            href={lien(varianteA(index - 1).cle, etat, jeu)}
            className="rounded-lg px-2.5 py-1 text-sm hover:bg-white/10"
          >
            ←
          </a>
          <span className="min-w-[10rem] text-center font-medium text-xs">
            {courante.cle} · {courante.nom}
          </span>
          <a
            href={lien(varianteA(index + 1).cle, etat, jeu)}
            className="rounded-lg px-2.5 py-1 text-sm hover:bg-white/10"
          >
            →
          </a>
        </div>
        <div className="flex flex-wrap justify-center gap-1">
          {ETATS.map((e) => (
            <a
              key={e.id}
              href={lien(courante.cle, e.id, jeu)}
              className={
                e.id === etat
                  ? "rounded-full bg-white px-2 py-0.5 text-[10px] text-neutral-900"
                  : "rounded-full px-2 py-0.5 text-[10px] text-white/60 hover:bg-white/10"
              }
            >
              {e.nom}
            </a>
          ))}
        </div>
        <div className="flex flex-wrap justify-center gap-1">
          {JEUX.map((j) => (
            <a
              key={j.id}
              href={lien(courante.cle, etat, j.id)}
              className={
                j.id === jeu
                  ? "rounded-full bg-white/90 px-2 py-0.5 text-[10px] text-neutral-900"
                  : "rounded-full px-2 py-0.5 text-[10px] text-white/50 hover:bg-white/10"
              }
            >
              {j.court}
            </a>
          ))}
        </div>
      </div>
    </div>
  );
}
