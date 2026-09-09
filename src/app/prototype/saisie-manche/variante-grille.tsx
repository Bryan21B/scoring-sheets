"use client";

/**
 * PROTOTYPE JETABLE — variante C, « la grille », issue #8.
 *
 * Modèle mental : la feuille quadrillée. Les manches en lignes, les joueurs en
 * colonnes, les totaux en pied de tableau. Saisir et corriger sont le même
 * geste — on tape une case, qu'elle soit de cette manche ou de l'avant-dernière.
 * L'histoire complète reste à l'écran pendant qu'on saisit.
 */

import { useState } from "react";
import { cn } from "@/lib/utils";
import { AlerteSeuil, NoteMaquette, PaveNumerique } from "./commun";
import {
  franchissements,
  historiqueDe,
  type Jeu,
  JOUEURS,
  type MancheClose,
  pointsProvisoires,
  type SaisieEnCours,
  saisieVide,
  totaux,
  unite,
} from "./modele";

export const NOM_VARIANTE = "La grille";

type Cellule = { manche: number; joueur: string };

export function VarianteGrille({ jeu }: { jeu: Jeu }) {
  const [closes, setCloses] = useState<readonly MancheClose[]>(() => historiqueDe(jeu));
  const [saisie, setSaisie] = useState<SaisieEnCours>(() => saisieVide(jeu.mode));
  const [cellule, setCellule] = useState<Cellule | null>(null);
  const [brouillon, setBrouillon] = useState("");

  const totauxClos = totaux(closes.map((m) => m.scores));
  const provisoires = pointsProvisoires(saisie);
  const franchis = franchissements(jeu, totauxClos, provisoires);
  const indexEnCours = closes.length;

  function ouvrirClose(index: number, joueur: string) {
    setCellule({ manche: index, joueur });
    setBrouillon(String(closes[index]?.scores[joueur] ?? 0));
  }

  function ouvrirEnCours(joueur: string) {
    if (saisie.mode === "podium") {
      setSaisie(cyclerPodium(saisie, joueur));
      return;
    }
    if (
      saisie.mode === "sommeAuGagnant" &&
      (saisie.gagnant === null || saisie.gagnant === joueur)
    ) {
      return;
    }
    setCellule({ manche: indexEnCours, joueur });
    const actuelle = valeurEnCours(saisie, joueur);
    setBrouillon(actuelle === undefined ? "" : String(actuelle));
  }

  function valider() {
    if (cellule === null) {
      return;
    }
    const valeur = Number(brouillon === "" ? "0" : brouillon);
    if (cellule.manche < indexEnCours) {
      // Corriger une manche déjà close : exactement le même geste que saisir.
      setCloses(
        closes.map((m, i) =>
          i === cellule.manche ? { ...m, scores: { ...m.scores, [cellule.joueur]: valeur } } : m,
        ),
      );
    } else {
      setSaisie(poser(saisie, cellule.joueur, valeur));
    }
    setCellule(null);
  }

  return (
    <div className="flex flex-col gap-3 pb-72">
      <div className="flex items-baseline justify-between">
        <h2 className="font-semibold text-lg">Feuille</h2>
        <span className="text-muted-foreground text-xs">
          {closes.length} manches closes · {jeu.court}
        </span>
      </div>

      {saisie.mode === "sommeAuGagnant" && (
        <ChoixGagnant
          gagnant={saisie.gagnant}
          onChoisir={(id) => setSaisie({ mode: "sommeAuGagnant", gagnant: id, restants: {} })}
        />
      )}

      <div className="-mx-4 overflow-x-auto px-4">
        <table className="w-full min-w-[30rem] border-separate border-spacing-0 text-sm">
          <thead>
            <tr>
              <th className="sticky left-0 z-10 bg-background pr-2 pb-1 text-left font-normal text-[11px] text-muted-foreground">
                Manche
              </th>
              {JOUEURS.map((joueur) => (
                <th key={joueur.id} className="pb-1 text-center font-medium text-xs">
                  {joueur.nom}
                  {joueur.moi && (
                    <span className="block text-[9px] text-muted-foreground">vous</span>
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {closes.map((manche, index) => (
              <tr key={manche.id}>
                <th className="sticky left-0 z-10 bg-background pr-2 text-left font-normal text-muted-foreground text-xs">
                  {index + 1}
                </th>
                {JOUEURS.map((joueur) => (
                  <td key={joueur.id} className="p-0.5">
                    <button
                      type="button"
                      onClick={() => ouvrirClose(index, joueur.id)}
                      className={cn(
                        "h-10 w-full rounded-lg border font-mono text-sm tabular-nums",
                        cellule?.manche === index && cellule.joueur === joueur.id
                          ? "border-primary bg-primary/10"
                          : "border-transparent bg-muted/40",
                      )}
                    >
                      {manche.scores[joueur.id] ?? 0}
                    </button>
                  </td>
                ))}
              </tr>
            ))}
            <LigneEnCours
              numero={indexEnCours + 1}
              saisie={saisie}
              celluleActive={cellule?.manche === indexEnCours ? cellule.joueur : null}
              onTaper={ouvrirEnCours}
            />
            <LigneTotaux totauxClos={totauxClos} provisoires={provisoires} franchis={franchis} />
          </tbody>
        </table>
      </div>

      {jeu.seuil !== null && (
        <p className="text-center text-[11px] text-muted-foreground">
          Seuil : {jeu.seuil} {jeu.unite.plusieurs}
          {jeu.finAlternative !== undefined && ` — ${jeu.finAlternative}`}
        </p>
      )}

      {franchis.length > 0 && (
        <AlerteSeuil>
          Le pied de tableau vire au rouge dès la case tapée :{" "}
          <strong>{franchis.map(nomDe).join(", ")}</strong> passe {jeu.seuil}{" "}
          {unite(jeu, jeu.seuil ?? 0)}.
        </AlerteSeuil>
      )}

      <NoteMaquette>
        <strong>Ce que cette variante tranche.</strong> Saisir et corriger sont{" "}
        <strong>le même geste</strong> : on tape une case, celle de cette manche ou celle d'il y a
        trois manches. Le pavé s'ouvre en bas sans masquer la ligne en cours. Les totaux vivent{" "}
        <strong>en pied de tableau</strong>, avec l'histoire complète au-dessus, et le
        franchissement teinte la case <strong>immédiatement</strong>. Le prix à payer : cinq
        colonnes sur un téléphone, ça défile latéralement.
      </NoteMaquette>

      {cellule !== null && (
        <div className="fixed inset-x-0 bottom-0 border-t bg-background p-3 pb-24 shadow-lg">
          <div className="mx-auto flex max-w-md flex-col gap-2">
            <div className="flex items-baseline justify-between">
              <span className="text-sm">
                {nomDe(cellule.joueur)} · manche {cellule.manche + 1}
                {cellule.manche < indexEnCours && (
                  <span className="ml-1 rounded bg-muted px-1 text-[10px] text-muted-foreground">
                    correction
                  </span>
                )}
              </span>
              <span className="font-mono text-2xl tabular-nums">
                {brouillon === "" ? "0" : brouillon}
              </span>
            </div>
            <PaveNumerique
              valeur={brouillon}
              onChiffre={(c) => setBrouillon((v) => (v + c).slice(0, 3))}
              onEffacer={() => setBrouillon("")}
              onValider={valider}
            />
          </div>
        </div>
      )}
    </div>
  );
}

function ChoixGagnant({
  gagnant,
  onChoisir,
}: {
  gagnant: string | null;
  onChoisir: (id: string) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="text-muted-foreground text-xs">Sorti :</span>
      {JOUEURS.map((joueur) => (
        <button
          key={joueur.id}
          type="button"
          onClick={() => onChoisir(joueur.id)}
          className={cn(
            "rounded-full border px-2.5 py-1 text-xs",
            gagnant === joueur.id
              ? "border-primary bg-primary text-primary-foreground"
              : "border-border",
          )}
        >
          {joueur.nom}
        </button>
      ))}
    </div>
  );
}

function LigneEnCours({
  numero,
  saisie,
  celluleActive,
  onTaper,
}: {
  numero: number;
  saisie: SaisieEnCours;
  celluleActive: string | null;
  onTaper: (joueur: string) => void;
}) {
  const sommeUno =
    saisie.mode === "sommeAuGagnant"
      ? Object.values(saisie.restants).reduce((s, r) => s + r.valeur, 0)
      : 0;
  return (
    <tr>
      <th className="sticky left-0 z-10 bg-background pr-2 text-left font-medium text-primary text-xs">
        {numero}
      </th>
      {JOUEURS.map((joueur) => {
        const valeur = valeurEnCours(saisie, joueur.id);
        const estGagnant = saisie.mode === "sommeAuGagnant" && saisie.gagnant === joueur.id;
        return (
          <td key={joueur.id} className="p-0.5">
            <button
              type="button"
              onClick={() => onTaper(joueur.id)}
              className={cn(
                "h-10 w-full rounded-lg border-2 font-mono text-sm tabular-nums",
                celluleActive === joueur.id
                  ? "border-primary bg-primary/10"
                  : valeur === undefined
                    ? "border-dashed border-muted-foreground/30 text-muted-foreground/40"
                    : "border-primary/40 bg-primary/5",
              )}
            >
              {estGagnant ? `+${sommeUno}` : (valeur ?? "·")}
            </button>
          </td>
        );
      })}
    </tr>
  );
}

function LigneTotaux({
  totauxClos,
  provisoires,
  franchis,
}: {
  totauxClos: Record<string, number>;
  provisoires: Record<string, number>;
  franchis: readonly string[];
}) {
  return (
    <tr>
      <th className="sticky left-0 z-10 bg-background pr-2 pt-2 text-left font-medium text-xs">
        Total
      </th>
      {JOUEURS.map((joueur) => (
        <td key={joueur.id} className="pt-2">
          <div
            className={cn(
              "flex h-10 items-center justify-center rounded-lg font-mono font-semibold text-sm tabular-nums",
              franchis.includes(joueur.id) ? "bg-destructive/15 text-destructive" : "bg-muted",
            )}
          >
            {(totauxClos[joueur.id] ?? 0) + (provisoires[joueur.id] ?? 0)}
          </div>
        </td>
      ))}
    </tr>
  );
}

/** Un appui sur une case Dnup place au podium, un second appui l'en retire. */
function cyclerPodium(saisie: SaisieEnCours, joueur: string): SaisieEnCours {
  if (saisie.mode !== "podium") {
    return saisie;
  }
  if (saisie.premier === joueur) {
    return { ...saisie, premier: null };
  }
  if (saisie.deuxieme === joueur) {
    return { ...saisie, deuxieme: null };
  }
  if (saisie.premier === null) {
    return { ...saisie, premier: joueur };
  }
  if (saisie.deuxieme === null) {
    return { ...saisie, deuxieme: joueur };
  }
  return saisie;
}

function poser(saisie: SaisieEnCours, joueur: string, valeur: number): SaisieEnCours {
  if (saisie.mode === "entierParJoueur") {
    return {
      mode: "entierParJoueur",
      valeurs: { ...saisie.valeurs, [joueur]: { valeur, parQui: "bryan" } },
    };
  }
  if (saisie.mode === "sommeAuGagnant") {
    return { ...saisie, restants: { ...saisie.restants, [joueur]: { valeur, parQui: "bryan" } } };
  }
  return saisie;
}

function valeurEnCours(saisie: SaisieEnCours, joueur: string): number | undefined {
  if (saisie.mode === "entierParJoueur") {
    return saisie.valeurs[joueur]?.valeur;
  }
  if (saisie.mode === "sommeAuGagnant") {
    return saisie.restants[joueur]?.valeur;
  }
  if (saisie.premier === joueur) {
    return 2;
  }
  if (saisie.deuxieme === joueur) {
    return 1;
  }
  return undefined;
}

function nomDe(id: string): string {
  return JOUEURS.find((j) => j.id === id)?.nom ?? id;
}
