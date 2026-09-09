"use client";

/**
 * PROTOTYPE JETABLE — variante A, « le podium », issue #10.
 *
 * Modèle mental : la remise des prix. Les trois premiers montent sur des
 * marches, le reste suit en liste. La fête est franche et courte, et le
 * vainqueur est la seule chose qu'on lit de loin.
 *
 * Le piège que cette forme doit éviter : un podium suppose trois places
 * distinctes, or les ex æquo ne se départagent pas. Deux vainqueurs doivent
 * donc tenir sur **la même marche**, pas l'un devant l'autre.
 */

import { useState } from "react";
import { cn } from "@/lib/utils";
import { BandeauRevisite, BasculeVue, NoteMaquette, Sorties } from "./commun";
import { Confettis } from "./confettis";
import { classement, type EtatId, ecart, type Jeu, partieDe, unite, vainqueurs } from "./modele";

export const NOM_VARIANTE = "Le podium";

export function VariantePodium({ jeu, etat }: { jeu: Jeu; etat: EtatId }) {
  const [gagnant, setGagnant] = useState(true);
  const partie = partieDe(jeu, etat === "exaequo");
  const lignes = classement(partie);
  const gagnants = vainqueurs(lignes);
  const meilleur = gagnants[0]?.total ?? 0;
  const revisite = etat === "revisite";

  return (
    <div className="flex flex-col gap-4">
      <Confettis key={`${jeu.id}-${etat}-${gagnant}`} actif={!revisite && gagnant} />

      {revisite ? (
        <BandeauRevisite quand={partie.quand} />
      ) : (
        <BasculeVue gagnant={gagnant} onChange={setGagnant} />
      )}

      <div className="text-center">
        <p className="text-muted-foreground text-xs">{partie.jeu.raisonFin}</p>
        <h1 className="mt-1 font-semibold text-2xl tracking-tight">
          {gagnants.length > 1
            ? `${gagnants.map((g) => g.joueur).join(" et ")} l'emportent`
            : `${gagnants[0]?.joueur} l'emporte`}
        </h1>
        <p className="text-muted-foreground text-xs">
          {meilleur} {unite(partie.jeu, meilleur)} · {partie.jeu.court}
        </p>
      </div>

      <Marches lignes={lignes} jeu={partie.jeu} />

      <ul className="flex flex-col gap-1">
        {lignes.map((ligne) => (
          <li
            key={ligne.joueur}
            className={cn(
              "flex items-center gap-3 rounded-xl border px-3 py-2.5",
              ligne.rang === 1 && "border-primary bg-primary/5",
            )}
          >
            <span className="w-6 font-mono text-muted-foreground text-sm tabular-nums">
              {ligne.rang}
            </span>
            <span className="flex-1 font-medium text-sm">{ligne.joueur}</span>
            {ligne.rang !== 1 && (
              <span className="text-[11px] text-muted-foreground">
                +{ecart(partie.jeu, ligne, meilleur)}
              </span>
            )}
            <span className="w-12 text-right font-mono text-base tabular-nums">{ligne.total}</span>
          </li>
        ))}
      </ul>

      <Sorties principale="rejouer" />

      <NoteMaquette>
        <strong>Ce que cette variante tranche.</strong> Le vainqueur se lit <strong>de loin</strong>
        , quand le téléphone passe de main en main autour de la table. Les confettis ne tombent que{" "}
        <strong>chez le gagnant</strong> — bascule le point de vue ci-dessus pour voir la
        différence. Les ex æquo tiennent <strong>sur la même marche</strong>, jamais l&apos;un
        devant l&apos;autre. Le prix : un podium à deux joueurs est ridicule, et à cinq il n&apos;en
        montre que trois.
      </NoteMaquette>
    </div>
  );
}

function Marches({
  lignes,
  jeu,
}: {
  lignes: readonly { joueur: string; total: number; rang: number }[];
  jeu: Jeu;
}) {
  const parRang = [1, 2, 3].map((r) => lignes.filter((l) => l.rang === r));
  const hauteurs = ["h-24", "h-16", "h-12"];
  const ordre = [1, 0, 2];
  return (
    <div className="flex items-end justify-center gap-1.5">
      {ordre.map((i) => {
        const groupe = parRang[i] ?? [];
        if (groupe.length === 0) {
          return <div key={i} className="w-24" />;
        }
        return (
          <div key={i} className="flex w-24 flex-col items-center gap-1">
            {groupe.map((l) => (
              <span key={l.joueur} className="text-center font-medium text-xs leading-tight">
                {l.joueur}
              </span>
            ))}
            <div
              className={cn(
                "flex w-full items-start justify-center rounded-t-lg pt-1.5",
                hauteurs[i],
                i === 0 ? "bg-primary text-primary-foreground" : "bg-muted",
              )}
            >
              <span className="font-mono text-sm tabular-nums">{groupe[0]?.total}</span>
            </div>
          </div>
        );
      })}
      <span className="sr-only">
        Classement en {jeu.direction === "bas" ? "ordre croissant" : "ordre décroissant"}
      </span>
    </div>
  );
}
