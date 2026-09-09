"use client";

/**
 * PROTOTYPE JETABLE — variante B, « un joueur à la fois », issue #8.
 *
 * Modèle mental : l'assistant plein écran, tenu d'une main, l'autre tenant les
 * cartes. Un seul joueur à l'écran, le pavé toujours ouvert et assez gros pour
 * le pouce. Les totaux sont volontairement cachés derrière un tiroir : ils
 * distraient pendant la saisie et ne servent qu'à la clôture.
 */

import { useState } from "react";
import { cn } from "@/lib/utils";
import { AlerteSeuil, NoteMaquette, PaveNumerique } from "./commun";
import {
  franchissements,
  HISTORIQUE,
  type Jeu,
  JOUEURS,
  pointsProvisoires,
  type SaisieEnCours,
  saisieVide,
  totaux,
  unite,
} from "./modele";

export const NOM_VARIANTE = "Un joueur à la fois";

export function VarianteSequence({ jeu }: { jeu: Jeu }) {
  const manches = HISTORIQUE[jeu.id] ?? [];
  const totauxClos = totaux(manches);
  const [saisie, setSaisie] = useState<SaisieEnCours>(() => saisieVide(jeu.mode));
  const [etape, setEtape] = useState(0);
  const [brouillon, setBrouillon] = useState("");
  const [tiroirOuvert, setTiroirOuvert] = useState(false);
  const [close, setClose] = useState(false);

  const provisoires = pointsProvisoires(saisie);
  const franchis = franchissements(jeu, totauxClos, provisoires);

  // Les étapes dépendent du mode : Uno commence par désigner un gagnant, Dnup n'a que deux appuis.
  const etapes = listeEtapes(jeu, saisie);
  const etapeCourante = etapes[etape];

  if (close) {
    return (
      <Recapitulatif
        jeu={jeu}
        manche={manches.length + 1}
        provisoires={provisoires}
        totauxClos={totauxClos}
        franchis={franchis}
        onRecommencer={() => {
          setSaisie(saisieVide(jeu.mode));
          setEtape(0);
          setBrouillon("");
          setClose(false);
        }}
      />
    );
  }

  function avancer(nouvelle: SaisieEnCours) {
    setSaisie(nouvelle);
    setBrouillon("");
    if (etape + 1 >= listeEtapes(jeu, nouvelle).length) {
      setClose(true);
      return;
    }
    setEtape(etape + 1);
  }

  return (
    <div className="flex min-h-[70vh] flex-col gap-4 pb-24">
      <div className="flex items-center gap-2">
        <button
          type="button"
          disabled={etape === 0}
          onClick={() => setEtape(etape - 1)}
          className="rounded-lg border px-2 py-1 text-xs disabled:opacity-30"
        >
          ←
        </button>
        <div className="flex flex-1 gap-1.5">
          {etapes.map((e, i) => (
            <button
              key={e.cle}
              type="button"
              onClick={() => setEtape(i)}
              className={cn(
                "h-1.5 flex-1 rounded-full",
                i < etape ? "bg-primary" : i === etape ? "bg-primary/50" : "bg-muted",
              )}
            />
          ))}
        </div>
        <button
          type="button"
          onClick={() => setTiroirOuvert((o) => !o)}
          className="rounded-lg border px-2 py-1 text-xs"
        >
          Totaux
        </button>
      </div>

      {tiroirOuvert && (
        <div className="rounded-xl border bg-muted/40 p-3">
          <ul className="flex flex-col gap-1">
            {JOUEURS.map((joueur) => (
              <li key={joueur.id} className="flex justify-between text-sm">
                <span>{joueur.nom}</span>
                <span className="font-mono tabular-nums">
                  {totauxClos[joueur.id]} {unite(jeu, totauxClos[joueur.id] ?? 0)}
                </span>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-[11px] text-muted-foreground">
            Tiroir refermé par défaut pendant la saisie.
          </p>
        </div>
      )}

      {etapeCourante === undefined ? null : (
        <div className="flex flex-1 flex-col justify-center gap-6">
          <div className="text-center">
            <p className="text-muted-foreground text-xs">{etapeCourante.consigne}</p>
            <p className="mt-1 font-semibold text-3xl tracking-tight">{etapeCourante.titre}</p>
          </div>

          {etapeCourante.genre === "nombre" ? (
            <>
              <p className="text-center font-mono text-5xl tabular-nums">
                {brouillon === "" ? "0" : brouillon}
              </p>
              <PaveNumerique
                taille="plein"
                valeur={brouillon}
                onChiffre={(c) => setBrouillon((v) => (v + c).slice(0, 3))}
                onEffacer={() => setBrouillon("")}
                onValider={() => avancer(etapeCourante.appliquer(Number(brouillon || "0")))}
                libelleValider={etape + 1 === etapes.length ? "Terminer" : "Suivant"}
              />
            </>
          ) : (
            <div className="flex flex-col gap-2">
              {JOUEURS.filter((j) => etapeCourante.candidats.includes(j.id)).map((joueur) => (
                <button
                  key={joueur.id}
                  type="button"
                  onClick={() => avancer(etapeCourante.choisir(joueur.id))}
                  className="h-14 rounded-xl border font-medium text-base active:bg-muted"
                >
                  {joueur.nom}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      <NoteMaquette>
        <strong>Ce que cette variante tranche.</strong> Le pavé est <strong>toujours ouvert</strong>
        , il n'y a rien à viser : la cible fait la moitié de l'écran. Corriger n'est{" "}
        <strong>pas le même geste</strong> que saisir — il faut revenir sur une étape par le point
        de progression ou la flèche. Les totaux sont <strong>cachés</strong> derrière un tiroir. Et
        le seuil n'est annoncé <strong>qu'à la clôture</strong>, sur le récapitulatif : pendant la
        saisie, il n'y a rien à en faire.
      </NoteMaquette>
    </div>
  );
}

type Etape =
  | {
      cle: string;
      genre: "nombre";
      titre: string;
      consigne: string;
      appliquer: (valeur: number) => SaisieEnCours;
    }
  | {
      cle: string;
      genre: "choix";
      titre: string;
      consigne: string;
      candidats: readonly string[];
      choisir: (id: string) => SaisieEnCours;
    };

function listeEtapes(jeu: Jeu, saisie: SaisieEnCours): readonly Etape[] {
  if (saisie.mode === "entierParJoueur") {
    return JOUEURS.map((joueur) => ({
      cle: joueur.id,
      genre: "nombre" as const,
      titre: joueur.nom,
      consigne: `Combien de ${jeu.unite.plusieurs} ?`,
      appliquer: (valeur: number): SaisieEnCours => ({
        mode: "entierParJoueur",
        valeurs: { ...saisie.valeurs, [joueur.id]: { valeur, parQui: "bryan" } },
      }),
    }));
  }
  if (saisie.mode === "sommeAuGagnant") {
    const choix: Etape = {
      cle: "gagnant",
      genre: "choix",
      titre: "Qui est sorti ?",
      consigne: "Il encaisse la main des autres",
      candidats: JOUEURS.map((j) => j.id),
      choisir: (id: string): SaisieEnCours => ({
        mode: "sommeAuGagnant",
        gagnant: id,
        restants: saisie.restants,
      }),
    };
    if (saisie.gagnant === null) {
      return [choix];
    }
    const gagnant = saisie.gagnant;
    return [
      choix,
      ...JOUEURS.filter((j) => j.id !== gagnant).map((joueur) => ({
        cle: joueur.id,
        genre: "nombre" as const,
        titre: joueur.nom,
        consigne: "Valeur des cartes restant en main",
        appliquer: (valeur: number): SaisieEnCours => ({
          mode: "sommeAuGagnant",
          gagnant,
          restants: { ...saisie.restants, [joueur.id]: { valeur, parQui: "bryan" } },
        }),
      })),
    ];
  }
  return [
    {
      cle: "premier",
      genre: "choix",
      titre: "Qui est sorti en premier ?",
      consigne: "2 jetons",
      candidats: JOUEURS.map((j) => j.id),
      choisir: (id: string): SaisieEnCours => ({ ...saisie, premier: id }),
    },
    {
      cle: "deuxieme",
      genre: "choix",
      titre: "Et en deuxième ?",
      consigne: "1 jeton — la manche s'arrête là",
      candidats: JOUEURS.filter((j) => j.id !== saisie.premier).map((j) => j.id),
      choisir: (id: string): SaisieEnCours => ({ ...saisie, deuxieme: id }),
    },
  ];
}

function Recapitulatif({
  jeu,
  manche,
  provisoires,
  totauxClos,
  franchis,
  onRecommencer,
}: {
  jeu: Jeu;
  manche: number;
  provisoires: Record<string, number>;
  totauxClos: Record<string, number>;
  franchis: readonly string[];
  onRecommencer: () => void;
}) {
  return (
    <div className="flex flex-col gap-4 pb-24">
      <h2 className="font-semibold text-lg">Manche {manche} — récapitulatif</h2>
      <ul className="flex flex-col gap-1.5">
        {JOUEURS.map((joueur) => (
          <li
            key={joueur.id}
            className="flex items-center justify-between rounded-xl border px-3 py-2.5"
          >
            <span className="font-medium text-sm">{joueur.nom}</span>
            <span className="flex items-baseline gap-2">
              <span className="font-mono text-muted-foreground text-xs tabular-nums">
                {totauxClos[joueur.id]}
              </span>
              <span className="font-mono text-sm tabular-nums">+{provisoires[joueur.id] ?? 0}</span>
              <span className="w-12 text-right font-mono font-semibold text-lg tabular-nums">
                {(totauxClos[joueur.id] ?? 0) + (provisoires[joueur.id] ?? 0)}
              </span>
            </span>
          </li>
        ))}
      </ul>
      {franchis.length > 0 && (
        <AlerteSeuil>
          <strong>{franchis.map((id) => JOUEURS.find((j) => j.id === id)?.nom).join(", ")}</strong>{" "}
          passe {jeu.seuil}. C'était la dernière manche.
        </AlerteSeuil>
      )}
      <button
        type="button"
        onClick={onRecommencer}
        className="h-12 rounded-xl bg-primary font-medium text-primary-foreground text-sm"
      >
        Valider et enchaîner
      </button>
      <NoteMaquette>
        C'est <strong>ici seulement</strong> que le seuil se découvre. Pendant la saisie, l'écran ne
        montrait aucun total.
      </NoteMaquette>
    </div>
  );
}
