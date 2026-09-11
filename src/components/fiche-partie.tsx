import type { ReactElement, ReactNode } from "react";
import { BandeauDeRefus } from "@/components/bandeau-de-refus";
import { Ecran } from "@/components/ecran";
import { GrilleDeScore } from "@/components/grille-score";
import { type GestesDuTiroir, TiroirDuJournal } from "@/components/tiroir-journal";
import { horodatage, type VueDuTiroir } from "@/lib/journal/tiroir";
import type { VueDeGrille } from "@/lib/manche/lecture";
import type { FinDePartie } from "@/lib/partie/fin";
import { ADRESSE_HISTORIQUE } from "@/lib/partie/historique-url";
import type { VueDePartie } from "@/lib/partie/lecture";

/**
 * Ce qui est arrivé à la partie, dit au participe et non par un statut.
 *
 * Le `Record` est exhaustif par le type : une troisième cause ajoutée au schéma
 * sans libellé ne compile pas. Il n'y en a que deux, et il n'y en aura pas de
 * troisième — la fin est absente ou présente, jamais un état intermédiaire.
 */
const SORT_DE_LA_PARTIE: Record<FinDePartie["cause"], string> = {
  terminee: "Partie terminée",
  abandonnee: "Partie abandonnée",
};

/**
 * La fiche d'une partie scellée : **la grille complète, manche par manche**.
 *
 * C'est littéralement la *feuille de score*, le nom du produit, et elle ne coûte
 * rien : rien n'est stocké, le moteur recalcule les totaux depuis les manches.
 *
 * **Pas de courbe.** La grille montre déjà la progression, en chiffres, et elle
 * défile latéralement à cinq joueurs. Empiler une courbe par-dessus ajouterait
 * un objet pour une information qu'on a déjà sous les yeux.
 *
 * **Ce n'est pas `EcranDePartie` avec des morceaux éteints.** Cet écran-là est
 * fait pour une soirée qui bouge : il porte quatre gestes d'écriture et une
 * salle d'attente, et aucun n'a de sens ici — le scellement refuse toute
 * écriture, et la liste ne bouge plus. Lui passer des gestes morts pour en
 * éteindre la moitié déformerait les deux écrans à la fois. Ce qui se réutilise,
 * c'est ce qui est vraiment commun : la coquille, **la grille** et **le
 * tiroir**, chacun déjà son propre composant.
 *
 * Le **sondage**, lui, dépend de la cause et non de l'écran : une partie
 * terminée ne changera plus, une partie abandonnée change dès que quelqu'un la
 * reprend. La fiche le reçoit donc de la page, comme l'écran d'une partie
 * vivante — voir la prop.
 *
 * **Le journal reste accessible**, depuis le même `⋯` que sur une partie
 * vivante : une partie scellée n'est pas une partie muette, et c'est précisément
 * après coup qu'on vient y chercher pourquoi un score a bougé. C'est aussi ce
 * qui décide l'adresse de cette fiche — elle est celle de la partie, `/p/<code>`,
 * parce que le tiroir y vit et qu'une fiche ailleurs y renverrait en quittant la
 * page qu'on est en train de lire.
 *
 * Aucun vainqueur n'est nommé ici : le classement se lit dans les totaux au pied
 * de la grille, et le nommer une seconde fois ferait deux endroits à garder
 * d'accord — c'est la ligne d'historique qui a ce métier, parce qu'elle n'a pas
 * la grille à montrer.
 */
export function FicheDePartie({
  partie,
  grille,
  fin,
  tiroir,
  gestesDuTiroir,
  sondage,
  erreur,
}: {
  partie: VueDePartie;
  grille: VueDeGrille;
  fin: FinDePartie;
  tiroir: VueDuTiroir;
  /**
   * Ce que le tiroir offre de ranger — ici, **la reprise et rien d'autre**.
   *
   * C'est la seule écriture qu'une partie scellée peut porter, et elle n'existe
   * que si la cause est un abandon : une partie régulièrement terminée ne se
   * rouvre pas. La fiche ne le décide pas elle-même, `sortiesDePartie` l'a fait
   * — sans quoi la condition qui distingue les deux causes vivrait dans un
   * écran, où elle ne se vérifie qu'à l'œil.
   */
  gestesDuTiroir: GestesDuTiroir;
  /**
   * `<SondageDePartie>` sur une partie **abandonnée**, `null` sur une partie
   * terminée.
   *
   * Exigé et non optionnel, parce que c'est une décision et non un détail. Une
   * partie terminée ne changera plus sous un autre téléphone, et la sonder
   * serait une requête toutes les trois secondes pour une réponse connue
   * d'avance. Une partie **abandonnée** change, elle : c'est exactement ce que
   * la reprise fait, et sans sondage les quatre autres resteraient sur cette
   * fiche pendant que la soirée a redémarré.
   */
  sondage: ReactNode;
  /**
   * Le refus rapporté par l'adresse, s'il y en a un.
   *
   * Exigé et non optionnel, comme sur l'écran d'une partie vivante : les deux
   * partagent l'adresse `/p/<code>`, et un geste refusé y revient sans savoir
   * laquelle l'accueillera. L'omettre ici ferait disparaître le message
   * exactement quand la partie vient de se sceller — le seul moment où il
   * explique quelque chose.
   */
  erreur: string | undefined;
}): ReactElement {
  return (
    <Ecran>
      <BandeauDeRefus message={erreur} />

      <div className="flex flex-col gap-1">
        <h1 className="font-semibold text-2xl tracking-tight">{partie.jeu.nom}</h1>
        <p className="text-muted-foreground text-sm">
          {`${SORT_DE_LA_PARTIE[fin.cause]} le `}
          {/* L'horodatage du journal, et non un second formateur : c'est la même
              horloge de serveur, lue dans le même fuseau fixe. Deux mises en
              forme de la même date divergeraient le jour où l'une est corrigée. */}
          <time dateTime={fin.le.toISOString()}>{horodatage(fin.le)}</time>
        </p>
      </div>

      <GrilleDeScore partie={partie} grille={grille} />

      <TiroirDuJournal code={partie.code} tiroir={tiroir} gestes={gestesDuTiroir} />

      <a href={ADRESSE_HISTORIQUE} className="text-muted-foreground text-sm underline">
        Revenir à l’historique
      </a>

      {sondage}
    </Ecran>
  );
}
