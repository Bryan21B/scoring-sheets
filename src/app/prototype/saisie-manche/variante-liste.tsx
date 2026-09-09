"use client";

/**
 * PROTOTYPE JETABLE — variante A, « la liste », issue #8.
 *
 * Modèle mental : le carnet de score posé au milieu de la table. Tout le monde
 * est visible d'un coup, les totaux vivent dans chaque ligne, et on tape là où
 * on regarde. Le pavé monte par-dessus sans jamais masquer la ligne active.
 */

import { useState } from "react";
import { cn } from "@/lib/utils";
import { AlerteSeuil, NoteMaquette, Pastille, PaveNumerique } from "./commun";
import {
  avancement,
  estComplete,
  franchissements,
  HISTORIQUE,
  type Jeu,
  JOUEURS,
  type Joueur,
  pointsProvisoires,
  type SaisieEnCours,
  saisieVide,
  totaux,
  unite,
  type ValeurSaisie,
} from "./modele";

export const NOM_VARIANTE = "La liste";

export function VarianteListe({ jeu }: { jeu: Jeu }) {
  const manches = HISTORIQUE[jeu.id] ?? [];
  const totauxClos = totaux(manches);
  const [saisie, setSaisie] = useState<SaisieEnCours>(() => saisieVide(jeu.mode));
  const [actif, setActif] = useState<string | null>(null);
  const [brouillon, setBrouillon] = useState("");

  const provisoires = pointsProvisoires(saisie);
  const franchis = franchissements(jeu, totauxClos, provisoires);
  const { faits, total } = avancement(saisie);

  function ouvrir(id: string, valeurExistante: number | undefined) {
    setActif(id);
    setBrouillon(valeurExistante === undefined ? "" : String(valeurExistante));
  }

  function validerEntier() {
    if (actif === null || saisie.mode !== "entierParJoueur") {
      return;
    }
    const valeur = Number(brouillon === "" ? "0" : brouillon);
    const valeurs = { ...saisie.valeurs, [actif]: { valeur, parQui: "bryan" } };
    setSaisie({ mode: "entierParJoueur", valeurs });
    // Enchaîner tout seul : le geste qui économise le plus de visées sur cinq joueurs.
    const suivant = JOUEURS.find((j) => valeurs[j.id] === undefined);
    setActif(suivant?.id ?? null);
    setBrouillon("");
  }

  function validerReste() {
    if (actif === null || saisie.mode !== "sommeAuGagnant") {
      return;
    }
    const valeur = Number(brouillon === "" ? "0" : brouillon);
    const restants = { ...saisie.restants, [actif]: { valeur, parQui: "bryan" } };
    setSaisie({ ...saisie, restants });
    const suivant = JOUEURS.find((j) => j.id !== saisie.gagnant && restants[j.id] === undefined);
    setActif(suivant?.id ?? null);
    setBrouillon("");
  }

  return (
    <div className="flex flex-col gap-3 pb-72">
      <EnTete jeu={jeu} manche={manches.length + 1} faits={faits} total={total} />

      {jeu.mode === "podium" ? (
        <PodiumListe jeu={jeu} saisie={saisie} setSaisie={setSaisie} totauxClos={totauxClos} />
      ) : (
        <>
          {jeu.mode === "sommeAuGagnant" && (
            <ChoixGagnant saisie={saisie} setSaisie={setSaisie} onChoisi={(id) => setActif(id)} />
          )}
          <ul className="flex flex-col gap-1.5">
            {JOUEURS.map((joueur) => (
              <LigneJoueur
                key={joueur.id}
                jeu={jeu}
                joueur={joueur}
                saisie={saisie}
                actif={actif === joueur.id}
                totalClos={totauxClos[joueur.id] ?? 0}
                franchit={franchis.includes(joueur.id)}
                onTaper={ouvrir}
              />
            ))}
          </ul>
        </>
      )}

      {franchis.length > 0 && (
        <AlerteSeuil>
          <strong>{franchis.map(nomDe).join(", ")}</strong> passe le seuil de {jeu.seuil}. La partie
          s'arrête à la clôture de cette manche.
        </AlerteSeuil>
      )}

      <NoteMaquette>
        <strong>Ce que cette variante tranche.</strong> Le pavé s'ouvre au premier appui sur une
        ligne, puis <strong>enchaîne tout seul</strong> vers le joueur suivant non saisi : une seule
        visée pour cinq joueurs. Une valeur déjà validée se corrige <strong>du même geste</strong>,
        en retapant sa ligne. Les totaux vivent dans chaque ligne, donc jamais masqués. Le
        franchissement de seuil s'affiche <strong>immédiatement</strong>, dès la valeur tapée.
      </NoteMaquette>

      {actif !== null && jeu.mode !== "podium" && (
        <div className="fixed inset-x-0 bottom-0 border-t bg-background p-3 pb-24 shadow-lg">
          <div className="mx-auto flex max-w-md flex-col gap-2">
            <div className="flex items-baseline justify-between">
              <span className="font-medium text-sm">{nomDe(actif)}</span>
              <span className="font-mono text-2xl tabular-nums">
                {brouillon === "" ? "0" : brouillon}
              </span>
            </div>
            <PaveNumerique
              valeur={brouillon}
              onChiffre={(c) => setBrouillon((v) => (v + c).slice(0, 3))}
              onEffacer={() => setBrouillon("")}
              onValider={jeu.mode === "entierParJoueur" ? validerEntier : validerReste}
              libelleValider="Suivant"
            />
          </div>
        </div>
      )}

      {estComplete(saisie) && (
        <div className="fixed inset-x-0 bottom-0 border-t bg-background p-3 pb-24">
          <div className="mx-auto max-w-md">
            <button
              type="button"
              onClick={() => {
                setSaisie(saisieVide(jeu.mode));
                setActif(null);
              }}
              className="h-12 w-full rounded-xl bg-primary font-medium text-primary-foreground text-sm"
            >
              Clore la manche {manches.length + 1}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function LigneJoueur({
  jeu,
  joueur,
  saisie,
  actif,
  totalClos,
  franchit,
  onTaper,
}: {
  jeu: Jeu;
  joueur: Joueur;
  saisie: SaisieEnCours;
  actif: boolean;
  totalClos: number;
  franchit: boolean;
  onTaper: (id: string, valeur: number | undefined) => void;
}) {
  const estGagnant = saisie.mode === "sommeAuGagnant" && saisie.gagnant === joueur.id;
  const bloque = saisie.mode === "sommeAuGagnant" && saisie.gagnant === null;
  const saisieJoueur = saisieDe(saisie, joueur.id);
  const sommeUno =
    saisie.mode === "sommeAuGagnant"
      ? Object.values(saisie.restants).reduce((s, r) => s + r.valeur, 0)
      : 0;
  return (
    <li>
      <button
        type="button"
        disabled={bloque || estGagnant}
        onClick={() => onTaper(joueur.id, saisieJoueur?.valeur)}
        className={cn(
          "flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition",
          actif ? "border-primary bg-primary/5" : "border-border",
          bloque && "opacity-40",
        )}
      >
        <Pastille nom={joueur.nom} actif={actif} />
        <span className="flex-1">
          <span className="flex items-center gap-1.5 font-medium text-sm">
            {joueur.nom}
            {joueur.moi && (
              <span className="rounded bg-muted px-1 text-[10px] text-muted-foreground">vous</span>
            )}
            {estGagnant && (
              <span className="rounded bg-primary/15 px-1 text-[10px] text-primary">gagnant</span>
            )}
          </span>
          <span className="block text-[11px] text-muted-foreground">
            {totalClos} {unite(jeu, totalClos)} au total
            {saisieJoueur !== undefined && ` · saisi par ${nomDe(saisieJoueur.parQui)}`}
          </span>
        </span>
        <span
          className={cn(
            "font-mono text-lg tabular-nums",
            saisieJoueur === undefined && "text-muted-foreground/40",
          )}
        >
          {estGagnant ? `+${sommeUno}` : (saisieJoueur?.valeur ?? "—")}
        </span>
        {franchit && (
          <span className="rounded bg-destructive/15 px-1.5 py-0.5 text-[10px] text-destructive">
            seuil
          </span>
        )}
      </button>
    </li>
  );
}

/** La valeur déjà saisie pour ce joueur dans la manche en cours, et par qui. */
function saisieDe(saisie: SaisieEnCours, joueur: string): ValeurSaisie | undefined {
  if (saisie.mode === "entierParJoueur") {
    return saisie.valeurs[joueur];
  }
  if (saisie.mode === "sommeAuGagnant") {
    return saisie.restants[joueur];
  }
  return undefined;
}

function EnTete({
  jeu,
  manche,
  faits,
  total,
}: {
  jeu: Jeu;
  manche: number;
  faits: number;
  total: number;
}) {
  return (
    <div className="flex items-baseline justify-between">
      <h2 className="font-semibold text-lg">Manche {manche}</h2>
      <span className="text-muted-foreground text-xs">
        {faits} / {total} saisis · {jeu.court}
      </span>
    </div>
  );
}

function ChoixGagnant({
  saisie,
  setSaisie,
  onChoisi,
}: {
  saisie: SaisieEnCours;
  setSaisie: (s: SaisieEnCours) => void;
  onChoisi: (id: string) => void;
}) {
  if (saisie.mode !== "sommeAuGagnant") {
    return null;
  }
  return (
    <div className="rounded-xl border border-dashed p-3">
      <p className="mb-2 text-muted-foreground text-xs">
        Qui a posé sa dernière carte ? Il encaisse la somme des mains des autres.
      </p>
      <div className="flex flex-wrap gap-1.5">
        {JOUEURS.map((joueur) => (
          <button
            key={joueur.id}
            type="button"
            onClick={() => {
              setSaisie({ mode: "sommeAuGagnant", gagnant: joueur.id, restants: {} });
              const premier = JOUEURS.find((j) => j.id !== joueur.id);
              if (premier !== undefined) {
                onChoisi(premier.id);
              }
            }}
            className={cn(
              "rounded-full border px-3 py-1.5 text-xs",
              saisie.gagnant === joueur.id
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border",
            )}
          >
            {joueur.nom}
          </button>
        ))}
      </div>
    </div>
  );
}

function PodiumListe({
  jeu,
  saisie,
  setSaisie,
  totauxClos,
}: {
  jeu: Jeu;
  saisie: SaisieEnCours;
  setSaisie: (s: SaisieEnCours) => void;
  totauxClos: Record<string, number>;
}) {
  if (saisie.mode !== "podium") {
    return null;
  }
  function poser(id: string) {
    if (saisie.mode !== "podium") {
      return;
    }
    if (saisie.premier === id) {
      setSaisie({ ...saisie, premier: null });
      return;
    }
    if (saisie.deuxieme === id) {
      setSaisie({ ...saisie, deuxieme: null });
      return;
    }
    if (saisie.premier === null) {
      setSaisie({ ...saisie, premier: id });
      return;
    }
    if (saisie.deuxieme === null) {
      setSaisie({ ...saisie, deuxieme: id });
    }
  }
  const rang = (id: string) =>
    saisie.premier === id ? "1er" : saisie.deuxieme === id ? "2e" : null;
  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-2 gap-2">
        {[
          { titre: "1er sorti", jetons: 2, qui: saisie.premier },
          { titre: "2e sorti", jetons: 1, qui: saisie.deuxieme },
        ].map((emplacement) => (
          <div
            key={emplacement.titre}
            className={cn(
              "rounded-xl border-2 border-dashed p-3 text-center",
              emplacement.qui !== null && "border-primary border-solid bg-primary/5",
            )}
          >
            <p className="text-[11px] text-muted-foreground">{emplacement.titre}</p>
            <p className="font-semibold text-base">
              {emplacement.qui === null ? "—" : nomDe(emplacement.qui)}
            </p>
            <p className="text-[11px] text-muted-foreground">
              {emplacement.jetons} {unite(jeu, emplacement.jetons)}
            </p>
          </div>
        ))}
      </div>
      <ul className="flex flex-col gap-1.5">
        {JOUEURS.map((joueur) => (
          <li key={joueur.id}>
            <button
              type="button"
              onClick={() => poser(joueur.id)}
              className={cn(
                "flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left",
                rang(joueur.id) !== null ? "border-primary bg-primary/5" : "border-border",
              )}
            >
              <Pastille nom={joueur.nom} actif={rang(joueur.id) !== null} />
              <span className="flex-1">
                <span className="font-medium text-sm">{joueur.nom}</span>
                <span className="block text-[11px] text-muted-foreground">
                  {totauxClos[joueur.id]} {unite(jeu, totauxClos[joueur.id] ?? 0)}
                </span>
              </span>
              <span className="font-mono text-sm text-muted-foreground">
                {rang(joueur.id) ?? "—"}
              </span>
            </button>
          </li>
        ))}
      </ul>
      <NoteMaquette>
        Aucun nombre : on désigne, on ne compte pas. Un deuxième appui retire du podium.{" "}
        <strong>Il n'y a pas de 3e emplacement</strong> — la manche s'arrête au deuxième sorti.
      </NoteMaquette>
    </div>
  );
}

function nomDe(id: string): string {
  return JOUEURS.find((j) => j.id === id)?.nom ?? id;
}
