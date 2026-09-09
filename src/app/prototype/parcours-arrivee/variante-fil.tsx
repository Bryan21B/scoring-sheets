"use client";

/**
 * PROTOTYPE JETABLE — variante A, « le fil », issue #9.
 *
 * Modèle mental : tout est une page qui défile, rien n'est un tiroir. L'accueil
 * met les parties en cours **en premier par la position**, sans les privilégier
 * autrement : on descend et le catalogue est là. Reprendre gagne parce que
 * reprendre est plus fréquent, pas parce que l'écran l'impose.
 */

import { BandeauSpectateur, CodePartage, NoteMaquette, NouveauNom, Pastille } from "./commun";
import { CODE_PARTIE, type EcranId, JEUX, PARTICIPANTS, PARTIES_EN_COURS, ROSTER } from "./modele";

export const NOM_VARIANTE = "Le fil";

export function VarianteFil({ ecran }: { ecran: EcranId }) {
  if (ecran === "creation") {
    return <Creation />;
  }
  if (ecran === "finie") {
    return <Finie />;
  }
  if (ecran !== "accueil") {
    return <Arrivee ecran={ecran} />;
  }
  return (
    <div className="flex flex-col gap-5">
      <h1 className="font-semibold text-2xl tracking-tight">Feuilles de score</h1>

      <section className="flex flex-col gap-2">
        <h2 className="font-medium text-muted-foreground text-xs uppercase tracking-wide">
          En cours
        </h2>
        {PARTIES_EN_COURS.map((partie) => (
          <button
            key={partie.code}
            type="button"
            className="flex w-full flex-col gap-2 rounded-xl border p-3 text-left"
          >
            <span className="flex items-baseline justify-between">
              <span className="font-medium text-sm">{partie.jeu}</span>
              <span className="text-[11px] text-muted-foreground">{partie.depuis}</span>
            </span>
            <span className="flex items-center gap-1">
              {partie.participants.map((nom) => (
                <Pastille key={nom} nom={nom} />
              ))}
            </span>
            <span className="text-[11px] text-muted-foreground">
              Manche {partie.manches + 1} · {partie.meneur} mène à {partie.score}
            </span>
          </button>
        ))}
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="font-medium text-muted-foreground text-xs uppercase tracking-wide">
          Nouvelle partie
        </h2>
        {JEUX.map((jeu) => (
          <button
            key={jeu.id}
            type="button"
            className="flex w-full items-center justify-between rounded-xl border px-3 py-2.5 text-left"
          >
            <span>
              <span className="block font-medium text-sm">{jeu.nom}</span>
              <span className="block text-[11px] text-muted-foreground">{jeu.sousTitre}</span>
            </span>
            <span className="text-muted-foreground text-xs">{jeu.joueurs}</span>
          </button>
        ))}
      </section>

      <section className="flex flex-col gap-2">
        <button type="button" className="rounded-xl border border-dashed px-3 py-2.5 text-sm">
          Rejoindre avec un code
        </button>
        <button type="button" className="rounded-xl border border-dashed px-3 py-2.5 text-sm">
          Historique et palmarès
        </button>
      </section>

      <NoteMaquette>
        <strong>Ce que cette variante tranche.</strong> Reprendre passe avant commencer,{" "}
        <strong>par la position seulement</strong> : même traitement visuel, l&apos;ordre fait le
        travail. Le catalogue reste entièrement visible sans geste. Le prix : avec cinq parties en
        cours, le catalogue tombe sous la ligne de flottaison.
      </NoteMaquette>
    </div>
  );
}

function Creation() {
  return (
    <div className="flex flex-col gap-5">
      <h1 className="font-semibold text-2xl tracking-tight">Nouvelle partie</h1>

      <section className="flex flex-col gap-2">
        <h2 className="font-medium text-muted-foreground text-xs uppercase tracking-wide">Jeu</h2>
        {JEUX.map((jeu, index) => (
          <button
            key={jeu.id}
            type="button"
            className={
              index === 0
                ? "rounded-xl border-2 border-primary bg-primary/5 px-3 py-2.5 text-left"
                : "rounded-xl border px-3 py-2.5 text-left"
            }
          >
            <span className="block font-medium text-sm">{jeu.nom}</span>
            <span className="block text-[11px] text-muted-foreground">{jeu.sousTitre}</span>
          </button>
        ))}
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="font-medium text-muted-foreground text-xs uppercase tracking-wide">
          Fin de partie
        </h2>
        <div className="flex items-center gap-2 rounded-xl border px-3 py-2.5">
          <span className="flex-1 text-sm">On s&apos;arrête à</span>
          <input
            defaultValue="66"
            inputMode="numeric"
            className="w-20 rounded-lg border bg-background px-2 py-1 text-right font-mono text-sm"
          />
          <span className="text-muted-foreground text-xs">têtes de bœuf</span>
        </div>
        <p className="text-[11px] text-muted-foreground">
          66 par défaut, la règle imprimée. Changer ici ne vaut que pour cette partie.
        </p>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="font-medium text-muted-foreground text-xs uppercase tracking-wide">
          Qui joue
        </h2>
        <div className="flex flex-wrap gap-1.5">
          {ROSTER.slice(0, 5).map((nom, index) => (
            <span
              key={nom}
              className={
                index < 3
                  ? "flex items-center gap-1 rounded-full bg-primary px-2.5 py-1 text-primary-foreground text-xs"
                  : "rounded-full border px-2.5 py-1 text-xs"
              }
            >
              {nom}
              {index === 0 && <span className="text-[10px] opacity-70">toi</span>}
            </span>
          ))}
        </div>
        <NouveauNom dense />
        <p className="text-[11px] text-muted-foreground">
          Tu es dans la partie d&apos;office : créer une partie, c&apos;est y être. Les autres
          peuvent être ajoutés ici sans téléphone — ils réclameront leur place en ouvrant le lien.
        </p>
      </section>

      <button
        type="button"
        className="h-12 rounded-xl bg-primary font-medium text-primary-foreground text-sm"
      >
        Créer la partie
      </button>

      <NoteMaquette>
        Une seule page qui défile, tout est réglable avant de valider et rien ne se cache. Le seuil
        est <strong>rempli d&apos;avance</strong> : on ne le regarde que les soirs où on s&apos;en
        écarte.
      </NoteMaquette>
    </div>
  );
}

function Arrivee({ ecran }: { ecran: EcranId }) {
  const figee = ecran === "arrivee-figee";
  const lie = ecran === "arrivee-lie";
  return (
    <div className="flex flex-col gap-5">
      <div>
        <p className="text-muted-foreground text-xs">Tu rejoins</p>
        <h1 className="font-semibold text-2xl tracking-tight">6 qui prend</h1>
        <p className="text-muted-foreground text-xs">
          {PARTICIPANTS.join(", ")} · {figee ? "manche 2 en cours" : "en salle d'attente"}
        </p>
      </div>

      {lie && (
        <section className="flex flex-col gap-2 rounded-xl border-2 border-primary bg-primary/5 p-3">
          <p className="text-sm">
            Rejoindre en tant que <strong>Marie</strong>
          </p>
          <button
            type="button"
            className="h-11 rounded-lg bg-primary font-medium text-primary-foreground text-sm"
          >
            C&apos;est moi, rejoindre
          </button>
          <button type="button" className="text-[11px] text-muted-foreground underline">
            Ce n&apos;est pas moi, choisir un autre nom
          </button>
        </section>
      )}

      {figee && (
        <BandeauSpectateur>
          La partie a commencé, on ne peut plus s&apos;y ajouter. Si tu es déjà dans la liste,
          choisis-toi pour reprendre ta place. Sinon tu la regardes.
        </BandeauSpectateur>
      )}

      {!lie && (
        <section className="flex flex-col gap-2">
          <h2 className="font-medium text-muted-foreground text-xs uppercase tracking-wide">
            Déjà dans la partie
          </h2>
          {PARTICIPANTS.map((nom) => (
            <button
              key={nom}
              type="button"
              className="flex items-center gap-3 rounded-xl border px-3 py-2.5 text-left"
            >
              <Pastille nom={nom} />
              <span className="flex-1 font-medium text-sm">{nom}</span>
              <span className="text-[11px] text-muted-foreground">réclamer</span>
            </button>
          ))}

          {!figee && (
            <>
              <h2 className="mt-3 font-medium text-muted-foreground text-xs uppercase tracking-wide">
                Autres joueurs connus
              </h2>
              {ROSTER.filter((n) => !PARTICIPANTS.includes(n))
                .slice(0, 4)
                .map((nom) => (
                  <button
                    key={nom}
                    type="button"
                    className="flex items-center gap-3 rounded-xl border px-3 py-2.5 text-left"
                  >
                    <Pastille nom={nom} />
                    <span className="flex-1 text-sm">{nom}</span>
                    <span className="text-[11px] text-muted-foreground">rejoindre</span>
                  </button>
                ))}
              <NouveauNom dense />
            </>
          )}
        </section>
      )}

      <NoteMaquette>
        <strong>L&apos;écran n&apos;est jamais sauté</strong>, même sur un appareil déjà lié : le
        bouton est armé et pré-rempli, mais rien n&apos;est écrit tant qu&apos;on n&apos;appuie pas.
        C&apos;est ce qui rend le spectateur possible sans lui demander de le déclarer.{" "}
        <strong>Réclamer</strong> et <strong>rejoindre</strong> sont deux sections distinctes, pas
        deux boutons sur la même ligne.
      </NoteMaquette>
    </div>
  );
}

function Finie() {
  return (
    <div className="flex flex-col gap-5">
      <div>
        <p className="text-muted-foreground text-xs">Ce lien mène à</p>
        <h1 className="font-semibold text-2xl tracking-tight">Une partie terminée</h1>
      </div>
      <BandeauSpectateur>
        Cette partie est finie. Elle reste lisible, mais on ne peut plus y écrire.
      </BandeauSpectateur>
      <div className="rounded-xl border p-3">
        <p className="text-[11px] text-muted-foreground">6 qui prend · 7 manches · vendredi</p>
        <p className="mt-1 font-medium text-sm">Léa l&apos;emporte avec 61 têtes de bœuf</p>
      </div>
      <button type="button" className="rounded-xl border px-3 py-2.5 text-sm">
        Voir la feuille
      </button>
      <button
        type="button"
        className="h-12 rounded-xl bg-primary font-medium text-primary-foreground text-sm"
      >
        Rejouer la même tablée
      </button>
      <NoteMaquette>
        Un vieux lien ne montre jamais la partie de quelqu&apos;un d&apos;autre : les codes ne sont
        pas recyclés. La sortie proposée est <strong>rejouer</strong>, parce que c&apos;est ce
        qu&apos;on veut vraiment quand on rouvre un lien de vendredi.
      </NoteMaquette>
    </div>
  );
}

/** Le code affiché après création, réutilisé par la barre de la maquette. */
export function CodeApresCreation() {
  return <CodePartage code={CODE_PARTIE} />;
}
