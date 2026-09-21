import type { ReactElement } from "react";
import { type Action, CARTE, CHAMP_NOM, LISTE, SOUS_TITRE } from "@/components/champs";
import { Pastille } from "@/components/pastille";
import { Button } from "@/components/ui/button";
import type { VueDePartie } from "@/lib/partie/lecture";
import {
  type Arrivee,
  type EtatDeSalle,
  estDeLaPartie,
  PAS_DE_LA_PARTIE,
} from "@/lib/partie/salle-attente";
import type { JoueurConnu } from "@/lib/roster/noms";

/**
 * La tablée et ce qu'on peut encore en faire.
 *
 * Tant qu'aucune manche n'existe, la partie est en **salle d'attente** : on
 * ajoute, on retire, on se choisit. Il n'y a **pas de bouton démarrer** — ce
 * serait un écran de cérémonie qui n'existe que pour être cliqué, et le gel se
 * déduit de la première manche saisie.
 *
 * Le composant ne décide rien : il reçoit l'état lu par
 * `lireSalleDAttente` et n'écrit **que par des formulaires**. C'est ce qui rend
 * la proposition « armée mais non inscrite » vraie au sens fort — aucun
 * chargement de cette page ne peut inscrire qui que ce soit.
 */
export function SalleDAttente({
  partie,
  salle,
  roster,
  rejoindre,
  ajouter,
  retirer,
  partir,
}: {
  partie: VueDePartie;
  salle: EtatDeSalle;
  roster: readonly JoueurConnu[];
  rejoindre: Action;
  ajouter: Action;
  retirer: Action;
  /**
   * Le **départ** d'une partie commencée, à ne pas confondre avec `retirer`.
   *
   * Voir {@link sortieDeLaTablee}, qui décide lequel des deux la tablée offre.
   */
  partir: Action;
}): ReactElement {
  const dedans = estDeLaPartie(salle);

  return (
    <section className="flex flex-col gap-8">
      <Tablee
        partie={partie}
        moi={salle.arrivee.statut === "inconnu" ? undefined : salle.arrivee.joueur}
        sortie={sortieDeLaTablee(salle, { retirer, partir })}
      />

      {dedans && !salle.gelee ? (
        <AjouterSansTelephone partie={partie} roster={roster} ajouter={ajouter} />
      ) : null}

      {dedans ? null : (
        <Arriver partie={partie} salle={salle} roster={roster} rejoindre={rejoindre} />
      )}
    </section>
  );
}

/**
 * Le geste de sortie que chaque ligne de la tablée porte, et les mots qui le
 * disent.
 *
 * Un seul objet plutôt que deux actions côte à côte : **les deux gestes ne
 * coexistent jamais**, et les passer séparément laisserait un écran offrir les
 * deux à la fois sans que rien ne s'en aperçoive.
 */
type SortieDeTablee = {
  action: Action;
  /** Le mot sur ma propre ligne. */
  mien: string;
  /** Le mot sur la ligne de quelqu'un d'autre — jamais accordé, on ne sait pas. */
  autre: string;
};

/**
 * Lequel des deux gestes la tablée offre, et sous quels mots.
 *
 * **C'est le gel qui les sépare**, et il n'en laisse jamais deux. Avant la
 * première manche, on *corrige la liste* : `retirer` efface une place où rien
 * n'a encore été marqué. Après, on *s'en va* : `partir` garde la place et les
 * valeurs déjà saisies, et écrit sa ligne de journal. Ce sont deux gestes du
 * domaine — `salle-attente.ts` d'un côté, `depart.ts` de l'autre — et donc deux
 * verbes : un mot unique ferait croire qu'on efface Paul de la soirée alors
 * qu'il rentre simplement chez lui.
 *
 * **Rien pour le spectateur**, des deux côtés du gel : le code donne la
 * lecture, l'écriture demande d'être de la tablée.
 */
function sortieDeLaTablee(
  salle: EtatDeSalle,
  gestes: { retirer: Action; partir: Action },
): SortieDeTablee | undefined {
  if (!estDeLaPartie(salle)) {
    return undefined;
  }

  return salle.gelee
    ? { action: gestes.partir, mien: "Je quitte la table", autre: "Quitte la table" }
    : { action: gestes.retirer, mien: "Je m’en vais", autre: "Retirer" };
}

/**
 * Qui est autour de la table, et le geste pour en sortir.
 *
 * La sortie est offerte **à tout participant, sur n'importe quelle ligne** :
 * celui qui a été ajouté sans téléphone n'a personne d'autre pour le faire, et
 * il n'existe aucun rôle de créateur dans ce design.
 *
 * Laquelle des deux sorties, c'est {@link sortieDeLaTablee} qui l'a tranché :
 * la liste, elle, se dessine pareil dans les deux cas.
 */
function Tablee({
  partie,
  moi,
  sortie,
}: {
  partie: VueDePartie;
  moi: JoueurConnu | undefined;
  sortie: SortieDeTablee | undefined;
}): ReactElement {
  return (
    <div className="flex flex-col gap-2">
      <h2 className={SOUS_TITRE}>
        {partie.participants.length === 1 ? "1 joueur" : `${partie.participants.length} joueurs`}
      </h2>
      <ul className={LISTE}>
        {partie.participants.map((joueur, place) => (
          <li key={joueur.id} className="flex items-center justify-between gap-3 px-4 py-3">
            {/* La pastille est posée ici parce que c'est ici que la place se
                décide : la feuille de score et le podium relisent le même
                ordre. Voir `placesDeLaTablee`. */}
            <span className="flex items-center gap-2.5 font-semibold text-[17px]">
              <Pastille nom={joueur.nom} index={place} />
              {joueur.nom}
            </span>
            {sortie === undefined ? null : (
              <form action={sortie.action} method="post">
                <input type="hidden" name="code" value={partie.code} />
                <input type="hidden" name="joueurId" value={joueur.id} />
                <Button type="submit" size="sm" variant="ghost">
                  {joueur.id === moi?.id ? sortie.mien : sortie.autre}
                </Button>
              </form>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * Le mode « un seul téléphone au milieu de la table ».
 *
 * Ces participants n'ont aucun lien vers un appareil et **réclameront leur
 * place** s'ils ouvrent le lien plus tard : c'est pour ça que le geste est
 * offert de plein droit et non comme un pis-aller.
 *
 * Le roster est proposé **à côté** du champ libre : le groupe du vendredi soir
 * y est déjà, et n'offrir que le champ libre renverrait « Zoé existe déjà »
 * sans nulle part où la choisir.
 */
function AjouterSansTelephone({
  partie,
  roster,
  ajouter,
}: {
  partie: VueDePartie;
  roster: readonly JoueurConnu[];
  ajouter: Action;
}): ReactElement {
  const dehors = horsDeLaTablee(partie, roster);

  return (
    <div className="flex flex-col gap-6">
      {dehors.length > 0 ? (
        <ChoixDeJoueurs
          titre="Ajouter quelqu’un du roster"
          libelle="Ajouter"
          code={partie.code}
          joueurs={dehors}
          action={ajouter}
        />
      ) : null}

      <form action={ajouter} method="post" className="flex flex-col gap-3">
        <input type="hidden" name="code" value={partie.code} />
        <input type="hidden" name="mode" value="nouveau" />
        <label htmlFor="ajout" className="font-semibold text-sm">
          Ajouter un joueur sans téléphone
        </label>
        <input
          id="ajout"
          name="nom"
          type="text"
          autoComplete="off"
          required
          placeholder="Paul"
          className={CHAMP_NOM}
        />
        <Button type="submit" size="lg" variant="outline">
          Ajouter
        </Button>
      </form>
    </div>
  );
}

/**
 * Ce qu'on propose à qui n'est pas encore de la partie.
 *
 * Deux entrées, et c'est le gel qui les sépare : **réclamer** une place déjà là
 * reste permis une fois la partie commencée, **rejoindre** ne l'est plus. Sans
 * cette distinction, celui qui a été ajouté à la création et n'ouvre le lien
 * qu'après la manche 1 serait spectateur de sa propre partie.
 */
function Arriver({
  partie,
  salle,
  roster,
  rejoindre,
}: {
  partie: VueDePartie;
  salle: EtatDeSalle;
  roster: readonly JoueurConnu[];
  rejoindre: Action;
}): ReactElement {
  const choisir = (
    <Choisir partie={partie} roster={roster} gelee={salle.gelee} rejoindre={rejoindre} />
  );

  if (salle.gelee) {
    return (
      <div className="flex flex-col gap-6">
        <Spectateur />
        {salle.arrivee.statut === "inconnu" ? choisir : null}
      </div>
    );
  }

  return salle.arrivee.statut === "propose" ? (
    <Proposition arrivee={salle.arrivee} code={partie.code} rejoindre={rejoindre}>
      {choisir}
    </Proposition>
  ) : (
    choisir
  );
}

/**
 * Le bandeau qui dit **pourquoi** l'écran ne propose rien.
 *
 * Ni refus sec — regarder une partie où on ne joue pas est normal entre amis —
 * ni boutons inertes sans explication, qui produisent des gens convaincus que
 * l'app est cassée.
 */
function Spectateur(): ReactElement {
  return <p className={`p-4 text-muted-foreground text-sm ${CARTE}`}>{PAS_DE_LA_PARTIE}</p>;
}

/**
 * « Rejoindre en tant que Marie » : **pré-sélectionné et non inscrit**.
 *
 * Le bouton est armé — un geste pour entrer — mais rien n'est écrit tant qu'on
 * n'appuie pas, et c'est exactement ce qui rend le spectateur possible. Le nom
 * est cliquable pour changer : le `details` tient la liste complète à portée,
 * sans JavaScript et sans quitter l'écran.
 */
function Proposition({
  arrivee,
  code,
  rejoindre,
  children,
}: {
  arrivee: Extract<Arrivee, { statut: "propose" }>;
  code: string;
  rejoindre: Action;
  children: ReactElement;
}): ReactElement {
  return (
    <div className={`flex flex-col gap-4 p-4 ${CARTE}`}>
      <form action={rejoindre} method="post" className="flex flex-col gap-3">
        <input type="hidden" name="code" value={code} />
        <input type="hidden" name="mode" value="roster" />
        <input type="hidden" name="joueurId" value={arrivee.joueur.id} />
        <Button type="submit" size="lg" className="w-full">
          {`Rejoindre en tant que ${arrivee.joueur.nom}`}
        </Button>
      </form>

      <details>
        <summary className="cursor-pointer text-muted-foreground text-sm">
          {`Ce n’est pas ${arrivee.joueur.nom} ?`}
        </summary>
        <div className="pt-4">{children}</div>
      </details>
    </div>
  );
}

/**
 * La liste complète : les places de la partie d'abord, le roster ensuite, le
 * champ « nouveau nom » toujours.
 *
 * L'ordre n'est pas cosmétique. Se **reconnaître dans la partie** est le geste
 * le plus fréquent quand on arrive sur un lien — c'est celui qu'on a été
 * inscrit sans son téléphone — et c'est aussi le seul qui reste permis une fois
 * la partie commencée.
 */
/** Le roster moins ceux qui sont déjà autour de la table. */
function horsDeLaTablee(
  partie: VueDePartie,
  roster: readonly JoueurConnu[],
): readonly JoueurConnu[] {
  return roster.filter(
    (joueur) => !partie.participants.some((present) => present.id === joueur.id),
  );
}

function Choisir({
  partie,
  roster,
  gelee,
  rejoindre,
}: {
  partie: VueDePartie;
  roster: readonly JoueurConnu[];
  gelee: boolean;
  rejoindre: Action;
}): ReactElement {
  const dehors = horsDeLaTablee(partie, roster);

  return (
    <div className="flex flex-col gap-6">
      {partie.participants.length > 0 ? (
        <ChoixDeJoueurs
          titre="Réclamer sa place"
          libelle="C’est moi"
          code={partie.code}
          joueurs={partie.participants}
          action={rejoindre}
        />
      ) : null}

      {!gelee && dehors.length > 0 ? (
        <ChoixDeJoueurs
          titre="Rejoindre la partie"
          libelle="Rejoindre"
          code={partie.code}
          joueurs={dehors}
          action={rejoindre}
        />
      ) : null}

      {gelee ? null : (
        <form action={rejoindre} method="post" className="flex flex-col gap-3">
          <input type="hidden" name="code" value={partie.code} />
          <input type="hidden" name="mode" value="nouveau" />
          <label htmlFor="nom" className="font-semibold text-sm">
            Un nouveau nom
          </label>
          <input
            id="nom"
            name="nom"
            type="text"
            autoComplete="off"
            required
            placeholder="Marie"
            className={CHAMP_NOM}
          />
          <Button type="submit" size="lg" variant="outline">
            Continuer
          </Button>
        </form>
      )}
    </div>
  );
}

/** Une liste de joueurs à choisir, en boutons radio : un seul envoi, un seul choix. */
function ChoixDeJoueurs({
  titre,
  libelle,
  code,
  joueurs,
  action,
}: {
  titre: string;
  libelle: string;
  code: string;
  joueurs: readonly JoueurConnu[];
  action: Action;
}): ReactElement {
  return (
    <form action={action} method="post" className="flex flex-col gap-3">
      <input type="hidden" name="code" value={code} />
      <input type="hidden" name="mode" value="roster" />
      <p className="font-semibold text-sm">{titre}</p>
      <ul className={LISTE}>
        {joueurs.map((joueur) => (
          <li key={joueur.id}>
            <label className="flex w-full cursor-pointer items-center gap-3 px-4 py-3.5 font-medium text-[17px]">
              <input
                type="radio"
                name="joueurId"
                value={joueur.id}
                required
                className="size-5 accent-primary"
              />
              {joueur.nom}
            </label>
          </li>
        ))}
      </ul>
      <Button type="submit" size="lg">
        {libelle}
      </Button>
    </form>
  );
}
