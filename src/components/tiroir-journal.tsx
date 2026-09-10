import type { ReactElement } from "react";
import {
  adresseDuTiroir,
  type DetailDuTiroir,
  type Geste,
  horodatage,
  type LigneDuTiroir,
  type Portee,
  type VueDuTiroir,
} from "@/lib/journal/tiroir";

/**
 * Ce qu'une ligne **enregistre**, nommé au participe et jamais au verbe conjugué.
 *
 * « Correction », pas « a corrigé » : un nom dit ce que l'application a
 * consigné, un verbe conjugué a besoin d'un sujet et ce sujet serait une
 * personne. Or le journal ne sait pas qu'une personne a agi — voir
 * {@link Agissant}. La forme du libellé est donc load-bearing, pas cosmétique.
 *
 * Le `Record` est exhaustif par le type : ajouter un geste au schéma sans lui
 * donner de libellé ne compile pas.
 */
const LIBELLE_DU_GESTE: Record<Geste, string> = {
  saisie: "Saisie",
  correction: "Correction",
  suppressionDeManche: "Manche supprimée",
  participantAjoute: "Joueur ajouté",
  participantRetire: "Joueur retiré",
  abandon: "Partie abandonnée",
  reprise: "Partie reprise",
};

/**
 * L'avertissement que le tiroir porte en tête, et qui n'est pas une politesse.
 *
 * Le lien appareil vers joueur est une **déclaration, pas une preuve** :
 * n'importe qui peut repointer son téléphone vers n'importe quel joueur, à tout
 * moment. Le journal dit d'où un geste est parti et sous quel nom il se
 * présentait ; il ne dit pas qui l'a fait, et il ne peut pas. Voir
 * `docs/adr/0004-identite-declarative-sans-authentification.md`.
 */
const AVERTISSEMENT =
  "Un appareil se déclare, il ne se prouve pas : le journal dit d’où un geste est parti, jamais qui l’a fait.";

/** Ce que le tiroir dit quand il n'a rien à montrer, selon ce qu'on lui demandait. */
const RIEN_A_MONTRER: Record<Portee, string> = {
  corrections: "Aucune correction, aucune suppression.",
  tout: "Le journal de cette partie est vide.",
};

/**
 * Le journal d'une partie, derrière une entrée de menu discrète.
 *
 * **Discret est une exigence, pas un goût.** Le tiroir existe pour le jour où
 * un score bouge tout seul, pas pour être consulté : un `⋯` s'ignore, un
 * bouton « Journal » se remarque et invite à surveiller ses amis. C'est aussi
 * pourquoi il montre par défaut les seules corrections et suppressions —
 * trente-cinq saisies de routine enterreraient la ligne qu'on est venu
 * chercher.
 *
 * Le composant ne reçoit **aucune identité de lecteur** et aucun état de
 * partie : il n'a donc rien à conditionner, et rien qui puisse se conditionner
 * par erreur plus tard. Un spectateur l'ouvre comme un joueur, sur une partie
 * scellée comme sur une partie en cours.
 *
 * Il n'a pas non plus d'état local : ouvert, fermé et portée vivent dans
 * l'adresse. La page de partie se rafraîchit toute seule, et un `useState` se
 * viderait à chaque tour de poll — pendant la lecture, précisément.
 */
export function TiroirDuJournal({
  code,
  tiroir,
}: {
  code: string;
  tiroir: VueDuTiroir;
}): ReactElement {
  if (tiroir.etat === "ferme") {
    return <EntreeDeMenu code={code} />;
  }

  return (
    <>
      <EntreeDeMenu code={code} />
      <Panneau code={code} portee={tiroir.portee} lignes={tiroir.lignes} />
    </>
  );
}

/**
 * L'entrée de menu : trois points, et rien qui s'annonce.
 *
 * Un `aria-label` parce que « ⋯ » ne se lit pas à voix haute : la discrétion
 * est visuelle, elle n'est pas une raison de rendre le journal introuvable à
 * qui navigue autrement qu'à l'œil.
 */
function EntreeDeMenu({ code }: { code: string }): ReactElement {
  return (
    <div className="flex justify-center">
      <a
        href={adresseDuTiroir(code, "corrections")}
        aria-label="Ouvrir le journal de la partie"
        className="rounded-lg px-4 py-2 text-muted-foreground text-xl leading-none hover:text-foreground"
      >
        ⋯
      </a>
    </div>
  );
}

/**
 * Le tiroir lui-même : une feuille qui monte du bas, refermée par un lien.
 *
 * Écrit à la main plutôt qu'avec la primitive `Sheet` de shadcn, contre l'usage
 * du dépôt : celle-ci est un composant client, et tout l'état de ce tiroir vit
 * dans l'adresse pour survivre au rafraîchissement de la page de partie. La
 * prendre imposerait le `useState` qu'on cherche justement à ne pas avoir.
 */
function Panneau({
  code,
  portee,
  lignes,
}: {
  code: string;
  portee: Portee;
  lignes: readonly LigneDuTiroir[];
}): ReactElement {
  return (
    <>
      <a href={adresseDuTiroir(code, null)} className="fixed inset-0 z-40 bg-foreground/20">
        {/* Le geste naturel sur un tiroir est de toucher à côté. Le libellé
            n'est caché qu'à l'œil : un lien pleine page sans nom accessible
            serait une zone morte pour qui ne voit pas le voile. */}
        <span className="sr-only">Fermer le journal</span>
      </a>
      <section
        aria-label="Journal de la partie"
        className="fixed inset-x-0 bottom-0 z-50 flex max-h-[85svh] flex-col gap-4 overflow-y-auto rounded-t-2xl border-border border-t bg-background px-4 pt-4 pb-8"
      >
        <div className="flex flex-col gap-2">
          <h2 className="font-semibold text-lg tracking-tight">Journal de la partie</h2>
          <p className="text-muted-foreground text-sm">{AVERTISSEMENT}</p>
        </div>

        <Bascule code={code} portee={portee} />

        {lignes.length === 0 ? (
          <p className="text-muted-foreground text-sm">{RIEN_A_MONTRER[portee]}</p>
        ) : (
          <ul className="-mx-4 flex w-auto flex-col divide-y divide-border border-border border-y">
            {lignes.map((ligne) => (
              <Ligne key={ligne.id} ligne={ligne} />
            ))}
          </ul>
        )}

        <a
          href={adresseDuTiroir(code, null)}
          className="text-center text-muted-foreground text-sm underline"
        >
          Fermer
        </a>
      </section>
    </>
  );
}

/**
 * La bascule « tout afficher », qui est un lien et non un interrupteur d'état.
 *
 * **Tout reste écrit, c'est la lecture qui filtre, jamais l'écriture** : les
 * deux portées lisent le même journal complet, et aucune ligne n'a jamais été
 * perdue en chemin.
 */
function Bascule({ code, portee }: { code: string; portee: Portee }): ReactElement {
  const [vers, libelle]: [Portee, string] =
    portee === "corrections"
      ? ["tout", "Tout afficher"]
      : ["corrections", "Ne montrer que les corrections"];

  return (
    <a href={adresseDuTiroir(code, vers)} className="text-sm underline">
      {libelle}
    </a>
  );
}

/**
 * Une ligne : ce qui a été enregistré, d'où, sur quoi, et quand.
 *
 * L'ordre des quatre est celui de la lecture réelle — on cherche d'abord le
 * geste, puis on remonte à sa provenance.
 */
function Ligne({ ligne }: { ligne: LigneDuTiroir }): ReactElement {
  return (
    <li className="flex flex-col gap-0.5 px-4 py-3">
      <p className="font-medium text-base">{LIBELLE_DU_GESTE[ligne.geste]}</p>
      <Agissant nom={ligne.agissant.nom} appareil={ligne.appareil} />
      <p className="text-muted-foreground text-sm">{cibleDeLaLigne(ligne)}</p>
      <Valeurs detail={ligne.detail} />
      <time dateTime={ligne.ecritLe.toISOString()} className="text-muted-foreground text-xs">
        {horodatage(ligne.ecritLe)}
      </time>
    </li>
  );
}

/**
 * D'où le geste est parti — **jamais** qui l'a fait.
 *
 * Le sujet de la phrase est l'appareil, et le nom n'y est qu'un participe :
 * « se déclarant Marie ». Écrire « Marie a corrigé » ferait affirmer à
 * l'application une chose qu'elle ne sait pas et ne peut pas savoir, puisque le
 * lien appareil vers joueur se repointe librement. C'est le seul endroit de
 * l'écran où un nom de personne apparaît à côté d'un geste, et c'est pour cela
 * qu'il est isolé dans son propre composant : la tournure ne doit pas se
 * perdre dans une refonte de mise en page.
 *
 * L'étiquette de l'appareil est ce qui rend l'anomalie lisible : deux lignes se
 * déclarant Marie depuis « l'appareil A » et « l'appareil B » disent quelque
 * chose que le seul nom de Marie ne dit pas.
 */
function Agissant({ nom, appareil }: { nom: string; appareil: string | null }): ReactElement {
  const depuis = appareil === null ? "un appareil" : `l’appareil ${appareil}`;

  return <p className="text-muted-foreground text-sm">{`Depuis ${depuis} se déclarant ${nom}`}</p>;
}

/** La manche et le joueur que la ligne désigne, dans l'ordre où on les cherche. */
function cibleDeLaLigne(ligne: LigneDuTiroir): string {
  return [
    ligne.mancheNumero === null ? null : `Manche ${ligne.mancheNumero}`,
    ligne.joueurConcerne?.nom ?? null,
  ]
    .filter((part) => part !== null)
    .join(" · ");
}

/**
 * Ce que le geste a déplacé.
 *
 * Une correction montre **les deux valeurs** : sans l'ancienne, le journal
 * enregistre que quelque chose a changé sans dire depuis quoi, ce qui est la
 * seule chose qu'on serait venu y lire.
 */
function Valeurs({ detail }: { detail: DetailDuTiroir }): ReactElement | null {
  if (detail.forme === "aucun") {
    return null;
  }

  return (
    <p className="font-mono text-base tabular-nums">
      {detail.forme === "correction" ? `${detail.ancienne} → ${detail.nouvelle}` : detail.valeur}
    </p>
  );
}
