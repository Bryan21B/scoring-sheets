"use client";

/**
 * PROTOTYPE JETABLE — variante B, « la courbe », issue #10.
 *
 * Modèle mental : ce n'est pas un palmarès, c'est **le récit de la soirée**. Qui
 * menait à la manche 3, quand ça a basculé, qui s'est effondré sur la fin. Le
 * classement est en dessous, en petit : on le connaît déjà, on vient de le
 * vivre.
 *
 * Pari assumé : entre amis, l'intéressant n'est pas *qui* a gagné — tout le
 * monde était là — mais *comment*. La fête est donc l'animation du tracé, pas
 * une pluie de confettis.
 */

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { BandeauRevisite, NoteMaquette, Sorties } from "./commun";
import { classement, type EtatId, type Jeu, partieDe, unite, vainqueurs } from "./modele";

export const NOM_VARIANTE = "La courbe";

export function VarianteCourbe({ jeu, etat }: { jeu: Jeu; etat: EtatId }) {
  const partie = partieDe(jeu, etat === "exaequo");
  const lignes = classement(partie);
  const gagnants = vainqueurs(lignes);
  const meilleur = gagnants[0]?.total ?? 0;
  const revisite = etat === "revisite";

  return (
    <div className="flex flex-col gap-4">
      {revisite && <BandeauRevisite quand={partie.quand} />}

      <div>
        <p className="text-muted-foreground text-xs">{partie.jeu.raisonFin}</p>
        <h1 className="mt-1 font-semibold text-xl tracking-tight">
          {gagnants.length > 1
            ? `${gagnants.map((g) => g.joueur).join(" et ")}, à égalité`
            : `${gagnants[0]?.joueur} l'emporte`}
        </h1>
      </div>

      <Graphique lignes={lignes} jeu={partie.jeu} anime={!revisite} />

      <ul className="flex flex-col gap-1">
        {lignes.map((ligne) => (
          <li key={ligne.joueur} className="flex items-center gap-2 text-sm">
            <span className="w-5 font-mono text-muted-foreground text-xs tabular-nums">
              {ligne.rang}
            </span>
            <span
              className="size-2.5 shrink-0 rounded-full"
              style={{ background: couleurDe(ligne.joueur, lignes) }}
            />
            <span className={cn("flex-1", ligne.rang === 1 && "font-medium")}>{ligne.joueur}</span>
            <span className="text-[11px] text-muted-foreground">{recit(ligne, partie.jeu)}</span>
            <span className="w-10 text-right font-mono tabular-nums">{ligne.total}</span>
          </li>
        ))}
      </ul>

      <p className="text-center text-[11px] text-muted-foreground">
        {meilleur} {unite(partie.jeu, meilleur)} pour{" "}
        {gagnants.length > 1 ? "les vainqueurs" : "le vainqueur"} ·{" "}
        {partie.trajectoires[0]?.cumuls.length ?? 0} manches
      </p>

      <Sorties principale="feuille" />

      <NoteMaquette>
        <strong>Ce que cette variante tranche.</strong> Le vainqueur n&apos;est pas le sujet : la{" "}
        <strong>trajectoire</strong> l&apos;est. On voit qui menait, quand ça a basculé, qui a pris
        la manche qui coûte. La fête est <strong>l&apos;animation du tracé</strong>, la même sur
        tous les téléphones parce qu&apos;elle ne célèbre personne. Le prix : cinq courbes sur un
        téléphone, c&apos;est dense, et à deux manches (la variante cartes spéciales) il n&apos;y a
        pas de récit à raconter.
      </NoteMaquette>
    </div>
  );
}

const PALETTE = ["#3b82f6", "#ef4444", "#10b981", "#f59e0b", "#a855f7"];

function couleurDe(joueur: string, lignes: readonly { joueur: string }[]): string {
  const i = lignes.findIndex((l) => l.joueur === joueur);
  return PALETTE[i % PALETTE.length] ?? "#3b82f6";
}

function recit(ligne: { trajectoire: readonly number[] }, jeu: Jeu): string {
  const pas = ligne.trajectoire.map((v, i) => v - (ligne.trajectoire[i - 1] ?? 0));
  const pire = Math.max(...pas);
  const index = pas.indexOf(pire);
  if (jeu.direction === "bas") {
    return `pire manche : ${pire} en ${index + 1}`;
  }
  return `meilleure : +${pire} en ${index + 1}`;
}

function Graphique({
  lignes,
  jeu,
  anime,
}: {
  lignes: readonly { joueur: string; trajectoire: readonly number[]; rang: number }[];
  jeu: Jeu;
  anime: boolean;
}) {
  const [avancement, setAvancement] = useState(anime ? 0 : 1);

  useEffect(() => {
    if (!anime) {
      setAvancement(1);
      return;
    }
    setAvancement(0);
    let frame = 0;
    let id = 0;
    function boucle() {
      frame += 1;
      setAvancement(Math.min(1, frame / 55));
      if (frame < 55) {
        id = requestAnimationFrame(boucle);
      }
    }
    id = requestAnimationFrame(boucle);
    return () => cancelAnimationFrame(id);
  }, [anime]);

  const manches = Math.max(...lignes.map((l) => l.trajectoire.length));
  const max = Math.max(...lignes.flatMap((l) => [...l.trajectoire]));
  const largeur = 320;
  const hauteur = 170;
  const y = (v: number) => hauteur - 12 - (v / max) * (hauteur - 28);
  const x = (i: number) => 20 + (i / Math.max(1, manches - 1)) * (largeur - 32);
  const numerosDeManche = Array.from({ length: manches }, (_, i) => i + 1);

  return (
    <svg
      viewBox={`0 0 ${largeur} ${hauteur}`}
      className="w-full"
      role="img"
      aria-label={`Progression des scores sur ${manches} manches`}
    >
      <title>Progression des scores</title>
      {lignes.map((ligne) => {
        const points = ligne.trajectoire.map((v, i) => `${x(i)},${y(v)}`);
        const visibles = Math.max(2, Math.ceil(points.length * avancement));
        return (
          <polyline
            key={ligne.joueur}
            points={points.slice(0, visibles).join(" ")}
            fill="none"
            stroke={couleurDe(ligne.joueur, lignes)}
            strokeWidth={ligne.rang === 1 ? 3 : 1.5}
            strokeOpacity={ligne.rang === 1 ? 1 : 0.45}
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        );
      })}
      {numerosDeManche.map((numero) => (
        <text
          key={`manche-${numero}`}
          x={x(numero - 1)}
          y={hauteur - 1}
          textAnchor="middle"
          className="fill-muted-foreground"
          style={{ fontSize: 8 }}
        >
          {numero}
        </text>
      ))}
      <text x={2} y={12} className="fill-muted-foreground" style={{ fontSize: 8 }}>
        {jeu.direction === "bas" ? "haut = mauvais" : "haut = bon"}
      </text>
    </svg>
  );
}
