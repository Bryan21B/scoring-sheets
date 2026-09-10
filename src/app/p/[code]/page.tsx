import { notFound } from "next/navigation";
import type { ReactElement } from "react";
import { ouvrirLaMancheSuivanteAction } from "@/app/p/[code]/actions";
import {
  ajouterParticipantAction,
  rejoindreAction,
  retirerParticipantAction,
} from "@/app/p/actions";
import { TropDeTentatives } from "@/components/code-inconnu";
import { Ecran } from "@/components/ecran";
import { EcranDePartie } from "@/components/ecran-de-partie";
import { FicheDePartie } from "@/components/fiche-partie";
import { SondageDePartie } from "@/components/sondage-de-partie";
import { db } from "@/db";
import { cleDeLaRequete, lireLAppareil } from "@/lib/appareil/requete";
import { lireLeTiroir } from "@/lib/journal/lecture";
import { lireLaGrille } from "@/lib/manche/lecture";
import { lireLaFin } from "@/lib/partie/fin";
import { messageDeRefusSchema, premierParametre } from "@/lib/partie/identite-url";
import { chercherPartieParCode, limiteDeRecherche } from "@/lib/partie/recherche";
import { lireSalleDAttente } from "@/lib/partie/salle-attente";
import { listerLeRoster } from "@/lib/roster/lecture";

/**
 * Jamais mise en cache : le code désigne une partie qui bouge, et une page
 * gardée montrerait la tablée d'il y a dix minutes.
 */
export const dynamic = "force-dynamic";

/**
 * La page d'une partie, atteinte par son code.
 *
 * Le code **est** l'adresse, et il donne la **lecture** : la page ne demande à
 * personne qui il est, et montre donc son code à tous ceux qui l'ouvrent — le
 * créateur n'a aucun statut particulier ici. L'écriture, elle, demande d'être
 * participant, et c'est la salle d'attente qui en offre l'unique entrée.
 *
 * Les deux gestes de la page cohabitent parce que le domaine les enchaîne :
 * tant qu'aucune manche n'existe la tablée bouge, et c'est **la première manche
 * saisie** qui la gèle. Il n'y a donc pas de bouton « démarrer » — « saisir la
 * manche suivante » en tient lieu, sans jamais l'annoncer.
 *
 * Elle porte **la même grille et le même poll que l'accueil** : c'est la même
 * partie, et deux façons de la montrer divergeraient. La grille n'apparaît
 * qu'une fois une manche ouverte — avant, c'est la salle d'attente qui a
 * quelque chose à dire, pas un tableau de tirets.
 *
 * La forme de l'écran vit dans `EcranDePartie`, et **la règle « le code donne
 * la lecture, l'écriture demande d'être participant » avec elle** : ici il n'y
 * a que du câblage, comme sur l'accueil.
 * **Deux écrans à une seule adresse.** Tant que la partie est ouverte, celui de
 * la soirée ; une fois **scellée**, sa fiche — la grille complète et le journal,
 * sans les gestes qui ne mènent plus nulle part. Le code est l'adresse d'une
 * partie et les liens du tiroir visent `/p/<code>` : une fiche logée ailleurs
 * ferait quitter la page au moment même où l'on ouvre le journal pour comprendre
 * ce qui s'est passé.
 *
 * La recherche est **limitée en débit** : 2³⁰ combinaisons pour quelques
 * centaines de parties font un enjeu nul, mais un script tire un million de
 * codes sans transpirer. Voir `src/lib/partie/limite-de-debit.ts`.
 *
 * L'appareil se **lit** ici, il ne s'écrit pas : Next refuse qu'un composant
 * serveur pose un cookie, et le proxy l'a déjà posé — en le réinjectant dans la
 * requête transmise, si bien que le tout premier chargement d'un lien partagé
 * voit déjà l'appareil.
 */
export default async function PageDePartie(props: PageProps<"/p/[code]">): Promise<ReactElement> {
  const idAppareil = await lireLAppareil();
  const trouvee = await chercherPartieParCode(db, limiteDeRecherche, {
    code: (await props.params).code,
    cle: await cleDeLaRequete(idAppareil),
    maintenant: Date.now(),
  });

  if (trouvee.statut === "tropDeTentatives") {
    return (
      <Ecran>
        <TropDeTentatives />
      </Ecran>
    );
  }

  if (trouvee.statut === "inconnue") {
    notFound();
  }

  const partie = trouvee.partie;
  // Le message vient de l'adresse, donc de l'extérieur : il est rendu dans la
  // page, et rien ne dit qu'il sort de notre propre redirection.
  const erreur = messageDeRefusSchema.safeParse(
    premierParametre((await props.searchParams).erreur),
  );
  const grille = await lireLaGrille(db, partie.id, partie.regles);
  const fin = await lireLaFin(db, partie.id);

  // Une partie **scellée** montre sa fiche, pas l'écran d'une soirée qui bouge :
  // ni « saisir la manche suivante », ni salle d'attente, ni sondage — le
  // scellement refuse toute écriture, et rien ne changera plus sous un autre
  // téléphone. À la **même adresse**, parce que le code est l'adresse d'une
  // partie et que les liens du tiroir du journal visent `/p/<code>` : une fiche
  // ailleurs ferait quitter la page en ouvrant le journal.
  if (fin !== null) {
    return (
      <FicheDePartie
        partie={partie}
        grille={grille}
        fin={fin}
        tiroir={await lireLeTiroir(db, partie.id, await props.searchParams)}
        erreur={erreur.success ? erreur.data : undefined}
      />
    );
  }

  return (
    <EcranDePartie
      partie={partie}
      grille={grille}
      salle={await lireSalleDAttente(db, partie.id, idAppareil)}
      roster={await listerLeRoster(db)}
      tiroir={await lireLeTiroir(db, partie.id, await props.searchParams)}
      gestes={{
        ouvrirLaMancheSuivante: ouvrirLaMancheSuivanteAction.bind(null, partie.code),
        rejoindre: rejoindreAction,
        ajouter: ajouterParticipantAction,
        retirer: retirerParticipantAction,
      }}
      erreur={erreur.success ? erreur.data : undefined}
      sondage={<SondageDePartie code={partie.code} version={partie.version} />}
    />
  );
}
