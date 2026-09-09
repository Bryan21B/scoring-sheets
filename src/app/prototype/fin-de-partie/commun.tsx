"use client";

/** PROTOTYPE JETABLE — briques partagées par les trois variantes, issue #10. */

import { cn } from "@/lib/utils";

/** Encart gris qui dit ce que la variante tranche, et ce qu'elle coûte. */
export function NoteMaquette({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded-lg bg-muted/60 px-3 py-2 text-[11px] text-muted-foreground leading-relaxed">
      {children}
    </p>
  );
}

/**
 * Bascule « tu as gagné / tu as perdu ».
 *
 * C'est la question du ticket sur les autres téléphones, rendue jouable : la
 * même partie vue de deux appareils. Elle ne vit pas dans l'URL parce qu'elle
 * n'est pas un écran, c'est un point de vue.
 */
export function BasculeVue({
  gagnant,
  onChange,
}: {
  gagnant: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex gap-1 rounded-full bg-muted p-1 text-[11px]">
      <button
        type="button"
        onClick={() => onChange(true)}
        className={cn(
          "flex-1 rounded-full px-2 py-1",
          gagnant ? "bg-background font-medium shadow-sm" : "text-muted-foreground",
        )}
      >
        Vu par le gagnant
      </button>
      <button
        type="button"
        onClick={() => onChange(false)}
        className={cn(
          "flex-1 rounded-full px-2 py-1",
          gagnant ? "text-muted-foreground" : "bg-background font-medium shadow-sm",
        )}
      >
        Vu par les autres
      </button>
    </div>
  );
}

/** Les sorties proposées à la fin. Identiques d'une variante à l'autre, c'est leur ordre qui varie. */
export function Sorties({ principale }: { principale: "rejouer" | "feuille" }) {
  const rejouer = (
    <button
      key="rejouer"
      type="button"
      className="h-12 w-full rounded-xl bg-primary font-medium text-primary-foreground text-sm"
    >
      Rejouer la même tablée
    </button>
  );
  const feuille = (
    <button key="feuille" type="button" className="h-12 w-full rounded-xl border text-sm">
      Revoir la feuille
    </button>
  );
  return (
    <div className="flex flex-col gap-2">
      {principale === "rejouer" ? [rejouer, feuille] : [feuille, rejouer]}
      <button type="button" className="text-center text-[11px] text-muted-foreground underline">
        Retour à l&apos;accueil
      </button>
    </div>
  );
}

/** Bandeau discret d'une partie rouverte plus tard. Pas une alerte, un contexte. */
export function BandeauRevisite({ quand }: { quand: string }) {
  return (
    <p className="rounded-lg bg-muted px-3 py-2 text-[11px] text-muted-foreground">
      Partie terminée {quand}. Elle reste lisible, elle ne bouge plus.
    </p>
  );
}
