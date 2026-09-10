import type { ReactElement } from "react";
import { type Action, CHAMP_NOM, LISTE } from "@/components/champs";
import { Button } from "@/components/ui/button";
import type { VueDePartie } from "@/lib/partie/lecture";
import { type Arrivee, type EtatDeSalle, PAS_DE_LA_PARTIE } from "@/lib/partie/salle-attente";
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
}: {
  partie: VueDePartie;
  salle: EtatDeSalle;
  roster: readonly JoueurConnu[];
  rejoindre: Action;
  ajouter: Action;
  retirer: Action;
}): ReactElement {
  const dedans = salle.arrivee.statut === "participant";

  return (
    <section className="flex flex-col gap-8">
      <Tablee
        partie={partie}
        moi={salle.arrivee.statut === "inconnu" ? undefined : salle.arrivee.joueur}
        retirer={dedans && !salle.gelee ? retirer : undefined}
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
 * Qui est autour de la table, et le geste pour en sortir.
 *
 * Le retrait est offert **à tout participant, sur n'importe quelle ligne** :
 * celui qui a été ajouté sans téléphone n'a personne d'autre pour le faire, et
 * il n'existe aucun rôle de créateur dans ce design.
 */
function Tablee({
  partie,
  moi,
  retirer,
}: {
  partie: VueDePartie;
  moi: JoueurConnu | undefined;
  retirer: Action | undefined;
}): ReactElement {
  return (
    <div className="flex flex-col gap-2">
      <h2 className="font-medium text-sm">
        {partie.participants.length === 1 ? "1 joueur" : `${partie.participants.length} joueurs`}
      </h2>
      <ul className={LISTE}>
        {partie.participants.map((joueur) => (
          <li key={joueur.id} className="flex items-center justify-between gap-3 px-4 py-3">
            <span className="text-base">{joueur.nom}</span>
            {retirer === undefined ? null : (
              <form action={retirer} method="post">
                <input type="hidden" name="code" value={partie.code} />
                <input type="hidden" name="joueurId" value={joueur.id} />
                <Button type="submit" size="sm" variant="ghost">
                  {joueur.id === moi?.id ? "Je m’en vais" : "Retirer"}
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
        <label htmlFor="ajout" className="font-medium text-sm">
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
  return (
    <p className="rounded-lg bg-muted p-3 text-muted-foreground text-sm">{PAS_DE_LA_PARTIE}</p>
  );
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
    <div className="flex flex-col gap-4 rounded-lg border border-border bg-muted/40 p-4">
      <form action={rejoindre} method="post" className="flex flex-col gap-3">
        <input type="hidden" name="code" value={code} />
        <input type="hidden" name="mode" value="roster" />
        <input type="hidden" name="joueurId" value={arrivee.joueur.id} />
        <Button type="submit" size="lg">
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
          <label htmlFor="nom" className="font-medium text-sm">
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
      <p className="font-medium text-sm">{titre}</p>
      <ul className={LISTE}>
        {joueurs.map((joueur) => (
          <li key={joueur.id}>
            <label className="flex w-full cursor-pointer items-center gap-3 px-4 py-3 text-base">
              <input type="radio" name="joueurId" value={joueur.id} required />
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
