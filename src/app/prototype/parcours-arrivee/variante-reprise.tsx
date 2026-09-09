"use client";

/**
 * PROTOTYPE JETABLE — variante C, « la reprise », issue #9.
 *
 * Modèle mental : entre amis, il y a presque toujours **une** partie en cours,
 * et c'est elle qu'on vient voir. L'accueil s'ouvre donc dessus, en grand, avec
 * les scores vivants ; commencer devient un bouton secondaire. Quand rien n'est
 * en cours, le catalogue reprend tout l'écran — l'accueil a deux visages.
 *
 * La création réutilise la forme séquentielle retenue pour la saisie
 * ([#8](https://github.com/Bryan21B/scoring-sheets/issues/8)) : une question par
 * écran, pour que l'app n'ait qu'une grammaire.
 */

import { useState } from "react";
import { BandeauSpectateur, CodePartage, NoteMaquette, NouveauNom, Pastille } from "./commun";
import { CODE_PARTIE, type EcranId, JEUX, PARTICIPANTS, PARTIES_EN_COURS, ROSTER } from "./modele";

export const NOM_VARIANTE = "La reprise";

export function VarianteReprise({ ecran }: { ecran: EcranId }) {
  if (ecran === "creation") {
    return <Creation />;
  }
  if (ecran === "finie") {
    return <Finie />;
  }
  if (ecran !== "accueil") {
    return <Arrivee ecran={ecran} />;
  }
  return <Accueil />;
}

function Accueil() {
  const [vide, setVide] = useState(false);
  const partie = PARTIES_EN_COURS[0];
  return (
    <div className="flex flex-col gap-4">
      <button
        type="button"
        onClick={() => setVide((v) => !v)}
        className="self-start rounded-full bg-muted px-2.5 py-1 text-[10px] text-muted-foreground"
      >
        {vide ? "▸ voir avec une partie en cours" : "▸ voir sans partie en cours"}
      </button>

      {vide || partie === undefined ? (
        <>
          <h1 className="font-semibold text-2xl tracking-tight">On joue à quoi ?</h1>
          <div className="flex flex-col gap-2">
            {JEUX.map((jeu) => (
              <button key={jeu.id} type="button" className="rounded-2xl border px-4 py-4 text-left">
                <span className="block font-semibold text-lg">{jeu.nom}</span>
                <span className="block text-[11px] text-muted-foreground">{jeu.sousTitre}</span>
              </button>
            ))}
          </div>
          <NoteMaquette>
            <strong>Le second visage.</strong> Sans partie en cours, le catalogue prend tout : il
            n&apos;y a rien d&apos;autre à faire. L&apos;accueil n&apos;a donc pas une hiérarchie
            mais deux, selon qu&apos;il y a quelque chose à reprendre.
          </NoteMaquette>
        </>
      ) : (
        <>
          <div className="rounded-2xl border-2 border-primary bg-primary/5 p-4">
            <p className="text-muted-foreground text-xs">{partie.depuis}</p>
            <h1 className="font-semibold text-xl tracking-tight">{partie.jeu}</h1>
            <ul className="mt-3 flex flex-col gap-1">
              {partie.participants.map((nom, i) => (
                <li key={nom} className="flex items-center gap-2">
                  <Pastille nom={nom} actif={i === 1} />
                  <span className="flex-1 text-sm">{nom}</span>
                  <span className="font-mono text-sm tabular-nums">
                    {[52, 35, 40, 36, 43][i] ?? 0}
                  </span>
                </li>
              ))}
            </ul>
            <button
              type="button"
              className="mt-4 h-12 w-full rounded-xl bg-primary font-medium text-primary-foreground text-sm"
            >
              Saisir la manche {partie.manches + 1}
            </button>
          </div>

          <div className="flex gap-2">
            <button type="button" className="flex-1 rounded-xl border px-3 py-2.5 text-sm">
              Autre partie
            </button>
            <button type="button" className="flex-1 rounded-xl border px-3 py-2.5 text-sm">
              Nouvelle partie
            </button>
          </div>
          <button
            type="button"
            className="rounded-xl border border-dashed px-3 py-2.5 text-muted-foreground text-sm"
          >
            Code · Historique
          </button>

          <NoteMaquette>
            <strong>Ce que cette variante tranche.</strong> Reprendre gagne franchement : la partie
            en cours <strong>est</strong> l&apos;accueil, scores compris, et saisir la manche
            suivante est à un appui. Commencer passe au second rang. Le prix : avec deux parties en
            cours, la seconde est derrière « autre partie », et le catalogue a disparu de la vue.
          </NoteMaquette>
        </>
      )}
    </div>
  );
}

function Creation() {
  const [etape, setEtape] = useState(0);
  return (
    <div className="flex min-h-[70vh] flex-col gap-6">
      <div className="flex gap-1.5">
        {[0, 1, 2].map((i) => (
          <button
            key={i}
            type="button"
            onClick={() => setEtape(i)}
            className={`h-1.5 flex-1 rounded-full ${i <= etape ? "bg-primary" : "bg-muted"}`}
          />
        ))}
      </div>

      {etape === 0 && (
        <div className="flex flex-1 flex-col justify-center gap-4">
          <p className="text-center font-semibold text-2xl tracking-tight">On joue à quoi ?</p>
          <div className="flex flex-col gap-2">
            {JEUX.map((jeu) => (
              <button
                key={jeu.id}
                type="button"
                onClick={() => setEtape(1)}
                className="h-14 rounded-xl border font-medium text-base"
              >
                {jeu.nom}
              </button>
            ))}
          </div>
        </div>
      )}

      {etape === 1 && (
        <div className="flex flex-1 flex-col justify-center gap-4">
          <p className="text-center font-semibold text-2xl tracking-tight">Qui joue ?</p>
          <div className="flex flex-wrap justify-center gap-1.5">
            {ROSTER.map((nom, i) => (
              <button
                key={nom}
                type="button"
                className={
                  i < 3
                    ? "rounded-full bg-primary px-3 py-1.5 text-primary-foreground text-sm"
                    : "rounded-full border px-3 py-1.5 text-sm"
                }
              >
                {nom}
                {i === 0 && " · toi"}
              </button>
            ))}
          </div>
          <NouveauNom dense />
          <button
            type="button"
            onClick={() => setEtape(2)}
            className="h-12 rounded-xl bg-primary font-medium text-primary-foreground text-sm"
          >
            Continuer
          </button>
          <p className="text-center text-[11px] text-muted-foreground">
            Le seuil n&apos;est pas demandé : 66 par défaut, modifiable dans la partie.
          </p>
        </div>
      )}

      {etape === 2 && (
        <div className="flex flex-1 flex-col justify-center gap-4">
          <p className="text-center font-semibold text-2xl tracking-tight">Dicte ce code</p>
          <CodePartage code={CODE_PARTIE} />
          <button
            type="button"
            className="h-12 rounded-xl bg-primary font-medium text-primary-foreground text-sm"
          >
            Commencer la manche 1
          </button>
        </div>
      )}

      <NoteMaquette>
        Même grammaire que la saisie retenue en{" "}
        <a className="underline" href="https://github.com/Bryan21B/scoring-sheets/issues/8">
          #8
        </a>{" "}
        : une question par écran. Le seuil <strong>n&apos;est pas demandé à la création</strong> —
        on ne s&apos;en écarte pas si souvent, et le demander à chaque partie taxe le cas courant
        pour servir le rare.
      </NoteMaquette>
    </div>
  );
}

function Arrivee({ ecran }: { ecran: EcranId }) {
  const figee = ecran === "arrivee-figee";
  const lie = ecran === "arrivee-lie";
  return (
    <div className="flex min-h-[70vh] flex-col justify-center gap-5">
      <div className="text-center">
        <p className="text-muted-foreground text-xs">6 qui prend · {PARTICIPANTS.join(", ")}</p>
        <h1 className="mt-1 font-semibold text-2xl tracking-tight">
          {lie ? "Tu es Marie ?" : "Qui es-tu ?"}
        </h1>
      </div>

      {figee && (
        <BandeauSpectateur>
          La manche 2 est commencée : plus personne ne s&apos;ajoute. Si tu es dans la liste,
          choisis-toi. Sinon, tu regardes.
        </BandeauSpectateur>
      )}

      {lie ? (
        <div className="flex flex-col gap-3">
          <button
            type="button"
            className="h-16 rounded-2xl bg-primary font-semibold text-lg text-primary-foreground"
          >
            Oui, rejoindre
          </button>
          <button type="button" className="h-12 rounded-xl border text-sm">
            Non, je suis quelqu&apos;un d&apos;autre
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {PARTICIPANTS.map((nom) => (
            <button
              key={nom}
              type="button"
              className="h-14 rounded-xl border-2 font-medium text-base"
            >
              {nom}
            </button>
          ))}
          {!figee && (
            <>
              <p className="mt-2 text-center text-[11px] text-muted-foreground">
                Pas dans la liste ?
              </p>
              <div className="flex flex-wrap justify-center gap-1.5">
                {ROSTER.filter((n) => !PARTICIPANTS.includes(n))
                  .slice(0, 5)
                  .map((nom) => (
                    <button
                      key={nom}
                      type="button"
                      className="rounded-full border px-3 py-1.5 text-sm"
                    >
                      {nom}
                    </button>
                  ))}
              </div>
              <NouveauNom dense />
            </>
          )}
        </div>
      )}

      <NoteMaquette>
        Une question, plein écran, des cibles énormes — c&apos;est l&apos;écran qu&apos;on ouvre
        debout, dans le bruit, en passant le téléphone. La hiérarchie fait le travail que les
        étiquettes font ailleurs : les participants sont <strong>au-dessus et plus gros</strong> que
        le roster, donc réclamer précède rejoindre sans qu&apos;on ait à nommer les deux gestes.
      </NoteMaquette>
    </div>
  );
}

function Finie() {
  return (
    <div className="flex min-h-[70vh] flex-col justify-center gap-5 text-center">
      <p className="text-muted-foreground text-xs">Vendredi · 7 manches</p>
      <h1 className="font-semibold text-2xl tracking-tight">Léa l&apos;a emporté</h1>
      <p className="font-mono text-4xl tabular-nums">61</p>
      <p className="text-muted-foreground text-xs">têtes de bœuf</p>
      <BandeauSpectateur>
        Cette partie est finie. On peut la lire, plus l&apos;écrire.
      </BandeauSpectateur>
      <button
        type="button"
        className="h-12 rounded-xl bg-primary font-medium text-primary-foreground text-sm"
      >
        Rejouer la même tablée
      </button>
      <button type="button" className="text-[11px] text-muted-foreground underline">
        Voir la feuille
      </button>
    </div>
  );
}
