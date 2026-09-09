"use client";

/** PROTOTYPE JETABLE — briques partagées par les trois variantes, issue #9. */

import { useState } from "react";
import { cn } from "@/lib/utils";

/** Encart gris qui dit ce que la variante tranche, et ce qu'elle coûte. */
export function NoteMaquette({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded-lg bg-muted/60 px-3 py-2 text-[11px] text-muted-foreground leading-relaxed">
      {children}
    </p>
  );
}

/** Pastille d'initiales, pour lire une tablée d'un coup d'œil. */
export function Pastille({ nom, actif = false }: { nom: string; actif?: boolean }) {
  return (
    <span
      className={cn(
        "flex size-8 shrink-0 items-center justify-center rounded-full font-medium text-xs",
        actif ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground",
      )}
    >
      {nom.slice(0, 2)}
    </span>
  );
}

/**
 * Le code de partie, avec ses deux gestes de partage.
 *
 * Le code est fait pour être **dicté** : il s'affiche en gros et en espacé,
 * séparé en deux groupes de trois, parce qu'on le lit à voix haute avant de
 * penser à l'envoyer. Copier et partager viennent après, pas avant.
 */
export function CodePartage({ code, compact = false }: { code: string; compact?: boolean }) {
  const [copie, setCopie] = useState(false);
  return (
    <div className={cn("rounded-xl border p-3", compact && "p-2.5")}>
      <p className="text-[11px] text-muted-foreground">Code de la partie</p>
      <p
        className={cn(
          "font-mono font-semibold tracking-[0.2em] tabular-nums",
          compact ? "text-xl" : "text-3xl",
        )}
      >
        {code.slice(0, 3)} {code.slice(3)}
      </p>
      <div className="mt-2 flex gap-2">
        <button
          type="button"
          onClick={() => setCopie(true)}
          className="flex-1 rounded-lg border px-3 py-1.5 text-xs"
        >
          {copie ? "Lien copié" : "Copier le lien"}
        </button>
        <button
          type="button"
          className="flex-1 rounded-lg bg-secondary px-3 py-1.5 text-secondary-foreground text-xs"
        >
          Partager…
        </button>
      </div>
    </div>
  );
}

/** Bandeau qui explique pourquoi l'écran est en lecture seule. Jamais de cases inertes sans raison. */
export function BandeauSpectateur({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-[11px] text-amber-700 leading-relaxed dark:text-amber-400">
      {children}
    </div>
  );
}

/** Champ « nouveau nom », toujours offert à côté d'une liste, même vide. */
export function NouveauNom({ dense = false }: { dense?: boolean }) {
  const [valeur, setValeur] = useState("");
  const existeDeja = ROSTER_MINUSCULE.includes(valeur.trim().toLowerCase());
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex gap-2">
        <input
          value={valeur}
          onChange={(e) => setValeur(e.target.value)}
          placeholder="Nouveau nom"
          className={cn(
            "min-w-0 flex-1 rounded-lg border bg-background px-3 text-sm",
            dense ? "h-9" : "h-11",
          )}
        />
        <button
          type="button"
          disabled={valeur.trim() === ""}
          className={cn(
            "rounded-lg bg-primary px-3 font-medium text-primary-foreground text-sm disabled:opacity-30",
            dense ? "h-9" : "h-11",
          )}
        >
          Ajouter
        </button>
      </div>
      {existeDeja && (
        <p className="rounded-lg bg-amber-500/10 px-2.5 py-1.5 text-[11px] text-amber-700 dark:text-amber-400">
          <strong>{valeur.trim()}</strong> existe déjà. C&apos;est elle, ou une autre ? Si
          c&apos;est une autre, donne-lui un nom distinctif.
        </p>
      )}
    </div>
  );
}

const ROSTER_MINUSCULE = ["bryan", "léa", "lea", "marc", "sofia", "théo", "theo", "nadia", "marie"];
