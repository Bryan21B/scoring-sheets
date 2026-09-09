"use client";

/**
 * PROTOTYPE JETABLE — variante C, « le classement sec », issue #10.
 *
 * Modèle mental : pas de mise en scène dans la page. Une liste ordonnée, des
 * chiffres énormes, les écarts lisibles, rien d'autre. **Toute la cérémonie est
 * dans les confettis**, qui tombent chez tout le monde en même temps et
 * s'effacent en trois secondes.
 *
 * Le pari inverse de la variante A : la fête est un moment, pas une mise en
 * page. Une fois passée, il reste un tableau qu'on relit sans gêne trois jours
 * plus tard — c'est le même écran, sans les confettis.
 */

import { useState } from "react";
import { cn } from "@/lib/utils";
import { BandeauRevisite, BasculeVue, NoteMaquette, Sorties } from "./commun";
import { Confettis } from "./confettis";
import { classement, type EtatId, ecart, type Jeu, partieDe, unite, vainqueurs } from "./modele";

export const NOM_VARIANTE = "Le classement sec";

export function VarianteClassement({ jeu, etat }: { jeu: Jeu; etat: EtatId }) {
  const [gagnant, setGagnant] = useState(true);
  const partie = partieDe(jeu, etat === "exaequo");
  const lignes = classement(partie);
  const gagnants = vainqueurs(lignes);
  const meilleur = gagnants[0]?.total ?? 0;
  const revisite = etat === "revisite";

  return (
    <div className="flex flex-col gap-4">
      {/* Chez tout le monde, pas seulement chez le gagnant : c'est le choix de cette variante. */}
      <Confettis
        key={`${jeu.id}-${etat}-${gagnant}`}
        actif={!revisite}
        intensite={gagnant ? 1.4 : 1}
      />

      {revisite ? (
        <BandeauRevisite quand={partie.quand} />
      ) : (
        <BasculeVue gagnant={gagnant} onChange={setGagnant} />
      )}

      <div className="flex items-baseline justify-between">
        <h1 className="font-semibold text-lg tracking-tight">Classement final</h1>
        <span className="text-[11px] text-muted-foreground">
          {partie.jeu.direction === "bas" ? "le plus bas gagne" : "le plus haut gagne"}
        </span>
      </div>

      <p className="text-muted-foreground text-xs">{partie.jeu.raisonFin}</p>

      <ol className="flex flex-col gap-1.5">
        {lignes.map((ligne) => (
          <li
            key={ligne.joueur}
            className={cn(
              "flex items-center gap-3 rounded-xl px-3 py-3",
              ligne.rang === 1 ? "bg-primary text-primary-foreground" : "bg-muted/50",
            )}
          >
            <span className="w-6 font-mono text-lg tabular-nums opacity-60">{ligne.rang}</span>
            <span className="flex-1">
              <span className="block font-medium text-base leading-tight">{ligne.joueur}</span>
              {ligne.rang !== 1 && (
                <span className="block text-[11px] opacity-70">
                  à {ecart(partie.jeu, ligne, meilleur)} du{" "}
                  {gagnants.length > 1 ? "haut" : "premier"}
                </span>
              )}
            </span>
            <span className="font-mono font-semibold text-2xl tabular-nums">{ligne.total}</span>
          </li>
        ))}
      </ol>

      <p className="text-center text-[11px] text-muted-foreground">
        {partie.trajectoires[0]?.cumuls.length ?? 0} manches · {unite(partie.jeu, meilleur)}
        {gagnants.length > 1 && " · deux vainqueurs, non départagés"}
      </p>

      <Sorties principale="rejouer" />

      <NoteMaquette>
        <strong>Ce que cette variante tranche.</strong> Les confettis tombent{" "}
        <strong>chez tout le monde</strong>, en même temps — la partie s&apos;est finie pour toute
        la table, pas seulement pour celui qui a gagné. Ils sont un peu plus denses chez le
        vainqueur, et c&apos;est toute la différence. La page, elle, ne célèbre rien : le rang,
        l&apos;écart, le total, et le sens du classement écrit en toutes lettres. Le prix : sans les
        confettis, la fin de partie ne se distingue pas d&apos;un écran d&apos;historique.
      </NoteMaquette>
    </div>
  );
}
