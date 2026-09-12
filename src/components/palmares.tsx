import type { ReactElement } from "react";
import { CatalogueListe } from "@/components/catalogue-liste";
import { LISTE } from "@/components/champs";
import { Ecran } from "@/components/ecran";
import type { EntreeCatalogue } from "@/lib/jeux/catalogue";
import { adresseDeFicheDeJoueur } from "@/lib/palmares/adresse";
import { parties, pourcentage } from "@/lib/palmares/mots";
import type { JoueurClasse, JoueurHorsClassement, VueDePalmares } from "@/lib/palmares/taux";
import type { JoueurConnu } from "@/lib/roster/noms";

/**
 * Le palmarès : **les joueurs, ordonnés par taux de victoires normalisé**.
 *
 * La liste qui mène aux fiches de joueur, exactement comme l'historique mène aux
 * fiches de partie. Elle ne décide rien de ce qu'elle montre — l'ordre, les
 * rangs et le plancher sortent de `ordonnerLePalmares`, et l'écran n'est que du
 * câblage entre les deux. Un tri refait ici contredirait le lecteur sans que
 * rien ne proteste.
 *
 * Il n'y a **pas de note**, et ce n'est pas un oubli : elle vient après la v1, et
 * s'ajoutera comme une colonne sans rien déplacer. Le palmarès v1 ne porte que
 * des faits.
 */
export function Palmares({
  vue,
  entrees,
}: {
  vue: VueDePalmares;
  entrees: readonly EntreeCatalogue[];
}): ReactElement {
  const personne = vue.classes.length === 0 && vue.horsClassement.length === 0;

  return (
    <Ecran>
      <h1 className="font-semibold text-2xl tracking-tight">Palmarès</h1>

      {personne ? (
        <RenvoiAuCatalogue entrees={entrees} />
      ) : (
        <>
          {vue.classes.length === 0 ? null : (
            <>
              <p className="text-muted-foreground text-sm">
                Part d’adversaires battus, l’égalité comptant pour moitié — gagner à six vaut donc
                ce que gagner à deux ne vaut pas.
              </p>
              <ul className={LISTE}>
                {vue.classes.map((une) => (
                  <LigneClassee key={une.joueur.id} ligne={une} />
                ))}
              </ul>
            </>
          )}

          {vue.horsClassement.length === 0 ? null : (
            <HorsClassement
              lignes={vue.horsClassement}
              plancher={vue.plancher}
              personneNEstClasse={vue.classes.length === 0}
            />
          )}
        </>
      )}
    </Ecran>
  );
}

/**
 * L'état vide : **un renvoi au catalogue**, et pas un écran inventé pour lui.
 *
 * Il ne se déclenche que quand le **roster** est vide — personne n'a encore
 * ouvert de partie. Un palmarès dont tous les joueurs sont sous le plancher n'est
 * pas cet état-là : les noms sont là, ce qui manque à chacun est écrit, et c'est
 * honnête. Les confondre ferait disparaître dix joueurs derrière « on en commence
 * une ? » le soir de la cinquième soirée.
 */
function RenvoiAuCatalogue({ entrees }: { entrees: readonly EntreeCatalogue[] }): ReactElement {
  return (
    <>
      <p className="text-muted-foreground text-sm">
        Personne n’a encore joué. On en commence une ?
      </p>
      <CatalogueListe entrees={entrees} />
    </>
  );
}

/**
 * Une ligne classée : le rang, le nom, le taux et le nombre de parties.
 *
 * Le nombre de parties est **à côté du taux** et non relégué sur la fiche : c'est
 * l'incertitude du chiffre, et un taux montré sans elle se lit comme une
 * certitude. C'est aussi ce que la note demandera quand elle arrivera.
 *
 * Le rang se fait précéder du mot, **caché à l'œil et lu à voix haute** : « 1 »
 * collé devant un nom ne dit rien à qui écoute la page. Un `aria-label` sur le
 * `span` ne ferait pas l'affaire — un élément sans rôle n'en porte pas, et
 * l'attribut serait ignoré par les lecteurs d'écran tout en ayant l'air de
 * marcher. Le texte, lui, entre dans le nom accessible du lien : « Rang 1,
 * Marie, 78 %, 12 parties ».
 */
function LigneClassee({ ligne }: { ligne: JoueurClasse }): ReactElement {
  return (
    <li>
      <a
        href={adresseDeFicheDeJoueur(ligne.joueur.id)}
        className="flex w-full items-baseline gap-3 px-4 py-4 hover:bg-muted active:bg-muted"
      >
        <span className="w-6 shrink-0 text-muted-foreground text-sm tabular-nums">
          <span className="sr-only">Rang </span>
          {ligne.rang}
        </span>
        <span className="flex-1 font-medium text-base">{ligne.joueur.nom}</span>
        <span className="text-muted-foreground text-sm tabular-nums">
          {`${pourcentage(ligne.taux)} · ${parties(ligne.parties)}`}
        </span>
      </a>
    </li>
  );
}

/**
 * Ceux qui n'ont pas encore assez joué : **en bas, sans rang, la raison écrite**.
 *
 * Un groupe à part et non des lignes grisées au bout de la même liste : ils ne
 * sont pas derniers, ils ne sont **pas classés**, et un taux sur trois parties ne
 * veut rien dire. Le titre et la phrase disent laquelle des deux choses c'est.
 *
 * Le plancher vient de la vue, jamais recopié : deux copies divergeraient le jour
 * où l'une est corrigée seule, et la phrase affichée serait alors fausse sans que
 * rien ne proteste.
 *
 * **Quand personne n'est classé, le titre le dit.** Un palmarès dont tout le
 * monde est sous le plancher n'est pas un état vide, c'est un palmarès honnête —
 * mais coiffer la seule liste de la page d'un « Hors classement » laisserait
 * croire qu'un classement existe au-dessus et n'a pas chargé. La phrase bascule
 * avec lui : « il faut cinq parties » se lit vers l'avant, là où « moins de cinq
 * parties » trie ceux qui restent en arrière.
 */
function HorsClassement({
  lignes,
  plancher,
  personneNEstClasse,
}: {
  lignes: readonly JoueurHorsClassement[];
  plancher: number;
  personneNEstClasse: boolean;
}): ReactElement {
  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-col gap-1">
        <h2 className="font-semibold text-base tracking-tight">
          {personneNEstClasse ? "Personne n’est encore classé" : "Hors classement"}
        </h2>
        <p className="text-muted-foreground text-sm">
          {personneNEstClasse
            ? `Il faut ${parties(plancher)} pour qu’un taux de victoires veuille dire quelque chose.`
            : `Moins de ${parties(plancher)} : le taux ne voudrait encore rien dire.`}
        </p>
      </div>
      <ul className={LISTE}>
        {lignes.map((une) => (
          <LigneHorsClassement key={une.joueur.id} joueur={une.joueur} parties={une.parties} />
        ))}
      </ul>
    </section>
  );
}

/**
 * Une ligne hors classement : le nom, et ce qui manque. **Aucun taux.**
 *
 * Le type de la ligne n'en porte pas, ce qui rend l'omission structurelle plutôt
 * que disciplinaire : il n'y a rien à oublier d'afficher ici.
 */
function LigneHorsClassement({
  joueur,
  parties: combien,
}: {
  joueur: JoueurConnu;
  parties: number;
}): ReactElement {
  return (
    <li>
      <a
        href={adresseDeFicheDeJoueur(joueur.id)}
        className="flex w-full items-baseline gap-3 px-4 py-4 hover:bg-muted active:bg-muted"
      >
        <span className="flex-1 font-medium text-base">{joueur.nom}</span>
        <span className="text-muted-foreground text-sm tabular-nums">{parties(combien)}</span>
      </a>
    </li>
  );
}
