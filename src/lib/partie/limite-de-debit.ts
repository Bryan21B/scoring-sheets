/**
 * La limite de débit, vue de celui qui l'interroge.
 *
 * Deux gestes et non un seul, parce que **seul un échec se compte**. Une table
 * de six téléphones qui relisent la même partie ne tâtonne pas : elle connaît
 * son code. Un compteur posé sur toutes les recherches enfermerait précisément
 * ceux qu'il n'y a rien à protéger contre — et il enfermerait le sondage de
 * `docs/adr/0003` le jour où il arrivera.
 */
export type Limiteur = {
  /** La clé a-t-elle encore le droit de chercher, à cet instant ? */
  estOuvert(cle: string, maintenant: number): boolean;
  /** Une recherche qui n'a rien trouvé : c'est ce qui se compte. */
  noterUnEchec(cle: string, maintenant: number): void;
};

/** L'état d'une clé : sa fenêtre courante, et ce qu'elle y a raté. */
type Fenetre = { ouverteLe: number; echecs: number };

/**
 * Au-delà, le ménage passe. Un dépôt de clés qui ne se vide jamais est une
 * fuite mémoire lente, et la limite est justement là pour absorber quelqu'un
 * qui en fabrique beaucoup.
 */
const CLES_AVANT_MENAGE = 10_000;

/**
 * Combien d'échecs, et sur quelle fenêtre, la recherche par code tolère.
 *
 * Dix par minute : se tromper d'une lettre en retapant un code dicté arrive, et
 * plusieurs fois de suite ; tirer 2³⁰ combinaisons à ce rythme prendrait deux
 * mille ans. L'enjeu est nul — le code donne la lecture, rien d'autre — mais un
 * script en tire un million sans transpirer, et c'est cela seul qu'on arrête.
 */
export const LIMITE_DE_RECHERCHE = { echecs: 10, fenetreMs: 60_000 } as const;

/**
 * Un limiteur à **fenêtre fixe**, en mémoire du processus.
 *
 * En mémoire et non en base : la limite protège d'une énumération, et une
 * énumération qui traverse plusieurs instances se paie déjà en latence réseau.
 * Y ajouter une écriture par tentative donnerait au script exactement la charge
 * qu'il cherche à provoquer.
 *
 * L'horloge est un paramètre, jamais `Date.now()` : c'est ce qui rend la
 * fenêtre vérifiable sans attendre une minute.
 */
export function creerLimiteur(options: { echecs: number; fenetreMs: number }): Limiteur {
  const fenetres = new Map<string, Fenetre>();

  /** La fenêtre encore courante pour cette clé, ou rien si elle est passée. */
  const fenetreCourante = (cle: string, maintenant: number): Fenetre | undefined => {
    const fenetre = fenetres.get(cle);

    return fenetre !== undefined && maintenant - fenetre.ouverteLe < options.fenetreMs
      ? fenetre
      : undefined;
  };

  const menage = (maintenant: number): void => {
    for (const [cle, fenetre] of fenetres) {
      if (maintenant - fenetre.ouverteLe >= options.fenetreMs) {
        fenetres.delete(cle);
      }
    }
  };

  return {
    estOuvert(cle, maintenant) {
      return (fenetreCourante(cle, maintenant)?.echecs ?? 0) < options.echecs;
    },

    noterUnEchec(cle, maintenant) {
      if (fenetres.size > CLES_AVANT_MENAGE) {
        menage(maintenant);
      }

      const fenetre = fenetreCourante(cle, maintenant);

      if (fenetre === undefined) {
        fenetres.set(cle, { ouverteLe: maintenant, echecs: 1 });
        return;
      }

      fenetre.echecs += 1;
    },
  };
}
