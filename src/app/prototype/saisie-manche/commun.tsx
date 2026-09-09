"use client";

/** PROTOTYPE JETABLE — briques partagées par les trois variantes, issue #8. */

import { cn } from "@/lib/utils";

/**
 * Pavé numérique maison.
 *
 * Le clavier natif est écarté d'emblée : sur iOS il pousse la page, masque les
 * totaux et impose de viser un champ. La question « le clavier s'ouvre-t-il tout
 * seul » n'a de sens que si le pavé fait partie de l'écran.
 */
export function PaveNumerique({
  valeur,
  onChiffre,
  onEffacer,
  onValider,
  libelleValider = "Valider",
  validerActif = true,
  taille = "compact",
}: {
  valeur: string;
  onChiffre: (chiffre: string) => void;
  onEffacer: () => void;
  onValider: () => void;
  libelleValider?: string;
  validerActif?: boolean;
  taille?: "compact" | "plein";
}) {
  const hauteur = taille === "plein" ? "h-16" : "h-12";
  return (
    <div className="grid grid-cols-3 gap-2">
      {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((chiffre) => (
        <button
          key={chiffre}
          type="button"
          onClick={() => onChiffre(chiffre)}
          className={cn(
            hauteur,
            "rounded-xl bg-secondary font-mono font-semibold text-secondary-foreground text-xl active:bg-secondary/60",
          )}
        >
          {chiffre}
        </button>
      ))}
      <button
        type="button"
        onClick={onEffacer}
        className={cn(
          hauteur,
          "rounded-xl bg-muted text-muted-foreground text-sm active:bg-muted/60",
        )}
      >
        {valeur === "" ? "—" : "Effacer"}
      </button>
      <button
        type="button"
        onClick={() => onChiffre("0")}
        className={cn(
          hauteur,
          "rounded-xl bg-secondary font-mono font-semibold text-secondary-foreground text-xl active:bg-secondary/60",
        )}
      >
        0
      </button>
      <button
        type="button"
        onClick={onValider}
        disabled={!validerActif}
        className={cn(
          hauteur,
          "rounded-xl bg-primary font-medium text-primary-foreground text-sm active:bg-primary/80 disabled:opacity-30",
        )}
      >
        {libelleValider}
      </button>
    </div>
  );
}

/** Pastille d'initiale, pour distinguer les joueurs sans photo ni couleur de marque. */
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

/** Bandeau d'alerte de franchissement de seuil. Le ton varie : c'est une bonne ou une mauvaise nouvelle selon le jeu. */
export function AlerteSeuil({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-destructive text-xs">
      {children}
    </div>
  );
}

/** Encart gris qui explique ce que la variante répond à une des questions du ticket. */
export function NoteMaquette({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded-lg bg-muted/60 px-3 py-2 text-[11px] text-muted-foreground leading-relaxed">
      {children}
    </p>
  );
}
