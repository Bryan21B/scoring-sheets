"use client";

/**
 * PROTOTYPE JETABLE — variante B, « les tuiles », issue #9.
 *
 * Modèle mental : l'app a **un verbe principal, commencer**. Les quatre entrées
 * du catalogue occupent l'écran en grandes tuiles ; les parties en cours se
 * replient en une seule ligne en haut, qu'on déplie. Le pari : on sait déjà
 * qu'une partie est en cours, on n'a pas besoin qu'on nous la montre en grand.
 *
 * La création et l'arrivée sont des **tiroirs**, pas des pages : on ne quitte
 * jamais l'accueil, ce qui rend l'annulation gratuite.
 */

import { useState } from "react";
import { BandeauSpectateur, CodePartage, NoteMaquette, NouveauNom, Pastille } from "./commun";
import { CODE_PARTIE, type EcranId, JEUX, PARTICIPANTS, PARTIES_EN_COURS, ROSTER } from "./modele";

export const NOM_VARIANTE = "Les tuiles";

export function VarianteTuiles({ ecran }: { ecran: EcranId }) {
  return (
    <div className="relative flex min-h-[75vh] flex-col gap-4">
      <Accueil />
      {ecran === "creation" && <Tiroir titre="Nouvelle partie" contenu={<Creation />} />}
      {ecran === "arrivee" && <Tiroir titre="Qui es-tu ?" contenu={<Arrivee figee={false} />} />}
      {ecran === "arrivee-lie" && <Tiroir titre="Tu rejoins" contenu={<ArriveeLiee />} />}
      {ecran === "arrivee-figee" && <Tiroir titre="Partie en cours" contenu={<Arrivee figee />} />}
      {ecran === "finie" && <Tiroir titre="Partie terminée" contenu={<Finie />} />}
    </div>
  );
}

function Accueil() {
  const [deplie, setDeplie] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setDeplie((d) => !d)}
        className="flex w-full items-center gap-2 rounded-full border bg-muted/40 px-3 py-2 text-left"
      >
        <span className="flex -space-x-2">
          {PARTIES_EN_COURS[0]?.participants.slice(0, 3).map((nom) => (
            <Pastille key={nom} nom={nom} />
          ))}
        </span>
        <span className="flex-1 text-xs">
          <strong>2 parties en cours</strong> · 6 qui prend, manche 4
        </span>
        <span className="text-muted-foreground text-xs">{deplie ? "▲" : "▼"}</span>
      </button>

      {deplie && (
        <div className="flex flex-col gap-2">
          {PARTIES_EN_COURS.map((partie) => (
            <button
              key={partie.code}
              type="button"
              className="flex items-center justify-between rounded-xl border px-3 py-2.5 text-left"
            >
              <span>
                <span className="block font-medium text-sm">{partie.jeu}</span>
                <span className="block text-[11px] text-muted-foreground">
                  {partie.participants.length} joueurs · {partie.depuis}
                </span>
              </span>
              <span className="text-muted-foreground text-xs">reprendre</span>
            </button>
          ))}
        </div>
      )}

      <div className="grid grid-cols-2 gap-2">
        {JEUX.map((jeu) => (
          <button
            key={jeu.id}
            type="button"
            className="flex aspect-square flex-col justify-end rounded-2xl border bg-muted/30 p-3 text-left"
          >
            <span className="font-semibold text-base leading-tight">{jeu.nom}</span>
            <span className="mt-1 text-[11px] text-muted-foreground leading-tight">
              {jeu.sousTitre}
            </span>
          </button>
        ))}
      </div>

      <div className="flex gap-2">
        <button type="button" className="flex-1 rounded-xl border px-3 py-2.5 text-sm">
          Code
        </button>
        <button type="button" className="flex-1 rounded-xl border px-3 py-2.5 text-sm">
          Historique
        </button>
      </div>

      <NoteMaquette>
        <strong>Ce que cette variante tranche.</strong> Commencer est le verbe principal : les
        quatre jeux prennent l&apos;écran. Les parties en cours tiennent en{" "}
        <strong>une ligne repliée</strong> — on sait qu&apos;elles existent, on n&apos;a pas besoin
        de les voir. Le prix : reprendre coûte deux appuis au lieu d&apos;un, et c&apos;est
        probablement le geste le plus fréquent de l&apos;app.
      </NoteMaquette>
    </>
  );
}

function Tiroir({ titre, contenu }: { titre: string; contenu: React.ReactNode }) {
  return (
    <div className="fixed inset-x-0 bottom-0 z-40 max-h-[80vh] overflow-y-auto rounded-t-3xl border-t bg-background p-4 pb-28 shadow-2xl">
      <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-muted-foreground/30" />
      <div className="mx-auto flex max-w-md flex-col gap-4">
        <h2 className="font-semibold text-lg">{titre}</h2>
        {contenu}
      </div>
    </div>
  );
}

function Creation() {
  const [etape, setEtape] = useState(0);
  const etapes = ["Jeu", "Fin", "Table"];
  return (
    <div className="flex flex-col gap-4">
      <div className="flex gap-1.5">
        {etapes.map((nom, i) => (
          <button
            key={nom}
            type="button"
            onClick={() => setEtape(i)}
            className={
              i === etape
                ? "flex-1 rounded-full bg-primary px-2 py-1 text-[11px] text-primary-foreground"
                : "flex-1 rounded-full bg-muted px-2 py-1 text-[11px] text-muted-foreground"
            }
          >
            {nom}
          </button>
        ))}
      </div>

      {etape === 0 && (
        <div className="flex flex-col gap-2">
          {JEUX.map((jeu, i) => (
            <button
              key={jeu.id}
              type="button"
              onClick={() => setEtape(1)}
              className={
                i === 0
                  ? "rounded-xl border-2 border-primary bg-primary/5 px-3 py-2.5 text-left"
                  : "rounded-xl border px-3 py-2.5 text-left"
              }
            >
              <span className="block font-medium text-sm">{jeu.nom}</span>
              <span className="block text-[11px] text-muted-foreground">{jeu.sousTitre}</span>
            </button>
          ))}
        </div>
      )}

      {etape === 1 && (
        <div className="flex flex-col gap-3">
          <p className="text-sm">On s&apos;arrête à combien ?</p>
          <div className="flex gap-2">
            {[30, 66, 100].map((v) => (
              <button
                key={v}
                type="button"
                className={
                  v === 66
                    ? "flex-1 rounded-xl border-2 border-primary bg-primary/5 py-3 font-mono text-lg"
                    : "flex-1 rounded-xl border py-3 font-mono text-lg"
                }
              >
                {v}
              </button>
            ))}
          </div>
          <p className="text-[11px] text-muted-foreground">
            66 est la règle imprimée. Les autres valeurs sont là parce qu&apos;on s&apos;en écarte
            souvent, et jamais de beaucoup.
          </p>
          <button
            type="button"
            onClick={() => setEtape(2)}
            className="h-11 rounded-xl bg-primary font-medium text-primary-foreground text-sm"
          >
            Continuer
          </button>
        </div>
      )}

      {etape === 2 && (
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap gap-1.5">
            {ROSTER.slice(0, 6).map((nom, i) => (
              <span
                key={nom}
                className={
                  i < 3
                    ? "rounded-full bg-primary px-2.5 py-1 text-primary-foreground text-xs"
                    : "rounded-full border px-2.5 py-1 text-xs"
                }
              >
                {nom}
                {i === 0 && " · toi"}
              </span>
            ))}
          </div>
          <NouveauNom dense />
          <CodePartage code={CODE_PARTIE} compact />
          <p className="text-[11px] text-muted-foreground">
            Le code apparaît <strong>avant</strong> de valider : on le dicte pendant que les autres
            sortent leur téléphone, sans attendre un écran de confirmation.
          </p>
          <button
            type="button"
            className="h-11 rounded-xl bg-primary font-medium text-primary-foreground text-sm"
          >
            C&apos;est parti
          </button>
        </div>
      )}
    </div>
  );
}

function Arrivee({ figee }: { figee: boolean }) {
  return (
    <div className="flex flex-col gap-3">
      {figee && (
        <BandeauSpectateur>
          Manche 2 en cours : la liste est figée. Réclame ta place si tu es dedans, sinon tu
          regardes.
        </BandeauSpectateur>
      )}
      <div className="flex flex-wrap gap-1.5">
        {PARTICIPANTS.map((nom) => (
          <button
            key={nom}
            type="button"
            className="flex items-center gap-1.5 rounded-full border-2 border-primary bg-primary/5 px-3 py-1.5 text-sm"
          >
            <Pastille nom={nom} />
            {nom}
          </button>
        ))}
      </div>
      {!figee && (
        <>
          <p className="text-[11px] text-muted-foreground">Ou quelqu&apos;un d&apos;autre :</p>
          <div className="flex flex-wrap gap-1.5">
            {ROSTER.filter((n) => !PARTICIPANTS.includes(n))
              .slice(0, 5)
              .map((nom) => (
                <button key={nom} type="button" className="rounded-full border px-3 py-1.5 text-sm">
                  {nom}
                </button>
              ))}
          </div>
          <NouveauNom dense />
        </>
      )}
      <NoteMaquette>
        Tout tient <strong>sans défilement</strong>, en pastilles plutôt qu&apos;en lignes. Le prix
        : réclamer et rejoindre se ressemblent trop, et la spec en fait deux gestes de conséquences
        très différentes.
      </NoteMaquette>
    </div>
  );
}

function ArriveeLiee() {
  return (
    <div className="flex flex-col gap-3">
      <p className="text-center text-sm">6 qui prend · {PARTICIPANTS.join(", ")}</p>
      <div className="rounded-2xl border-2 border-primary bg-primary/5 p-4 text-center">
        <p className="text-muted-foreground text-xs">Cet appareil est</p>
        <p className="font-semibold text-2xl">Marie</p>
      </div>
      <button
        type="button"
        className="h-12 rounded-xl bg-primary font-medium text-primary-foreground text-sm"
      >
        Rejoindre
      </button>
      <button type="button" className="text-center text-[11px] text-muted-foreground underline">
        Ce n&apos;est pas moi
      </button>
      <NoteMaquette>
        Un appui pour entrer, et <strong>rien n&apos;est écrit avant</strong>. Fermer le tiroir sans
        appuyer laisse spectateur — la sortie est le geste naturel du tiroir, pas un bouton «
        regarder » à inventer.
      </NoteMaquette>
    </div>
  );
}

function Finie() {
  return (
    <div className="flex flex-col gap-3">
      <BandeauSpectateur>Cette partie est finie. Lisible, plus modifiable.</BandeauSpectateur>
      <p className="font-medium text-sm">Léa l&apos;emporte avec 61 têtes de bœuf</p>
      <p className="text-[11px] text-muted-foreground">6 qui prend · 7 manches · vendredi</p>
      <button type="button" className="rounded-xl border px-3 py-2.5 text-sm">
        Voir la feuille
      </button>
      <button
        type="button"
        className="h-11 rounded-xl bg-primary font-medium text-primary-foreground text-sm"
      >
        Rejouer la même tablée
      </button>
    </div>
  );
}
