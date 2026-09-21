import type { ComponentProps } from "react";

/**
 * Ce que plusieurs écrans partagent, écrit une seule fois.
 *
 * Les classes vivent ici parce qu'elles sont **la même chose**, pas parce
 * qu'elles se ressemblent : la liste pleine largeur est le motif de l'app —
 * catalogue, roster, tablée — et un champ de nom se saisit pareil qu'on ouvre
 * une partie ou qu'on la rejoigne. Trois copies divergent le jour où l'une est
 * corrigée seule, et l'écart ne se voit qu'à l'écran.
 *
 * Depuis le kit Memphis — `docs/specs/2026-09-20-design-system-memphis.md` —
 * c'est aussi le vocabulaire de formes du design system : le trait, la carte,
 * l'ombre dure, la touche. Les jetons de couleur sont dans `globals.css` ; ce
 * qui est ici est ce qu'aucune variable CSS ne peut porter, une composition de
 * classes utilitaires.
 */

/**
 * Une action de formulaire, telle qu'une page câble la sienne.
 *
 * Le type est ici plutôt que recopié dans chaque composant qui écrit : tous les
 * gestes de l'app passent par un `form`, et une action serveur liée ou une
 * adresse en `GET` sont les deux seules formes qu'ils prennent.
 */
export type Action = ComponentProps<"form">["action"];

/**
 * Une action serveur qui **rend un état à l'écran**, telle que `useActionState`
 * la veut : l'état précédent, le formulaire, le nouvel état.
 *
 * Générique et posée ici, à côté de {@link Action}, parce que c'est la même
 * chose vue de l'autre bout : un `form` dont le geste a quelque chose à
 * répondre. Les modules de domaine n'ont pas à porter une forme dictée par
 * React, et deux copies de cette signature — une par écran qui refuse quelque
 * chose — divergeraient le jour où l'une gagne un paramètre.
 */
export type ActionServeur<Etat> = (precedent: Etat, formulaire: FormData) => Promise<Etat>;

/**
 * Le trait du kit : **3 px, partout**.
 *
 * Écrit en valeur arbitraire parce que Tailwind ne nomme que 1, 2, 4 et 8 — et
 * 3 px n'est pas un réglage fin, c'est la façon dont ce design system détache
 * une surface. Un hairline d'un pixel disparaît à un mètre, et l'écran est posé
 * au milieu de la table.
 */
export const TRAIT = "border-[3px] border-border";

/**
 * Une carte : le trait, le rayon, le papier plus clair, et l'ombre dure.
 *
 * L'ombre est un **aplat décalé**, jamais un flou — c'est la signature du kit,
 * et elle s'efface d'elle-même en mode sombre, où le liseré prend le relais
 * (voir `--ombre` dans `globals.css`).
 */
export const CARTE = `rounded-lg bg-card ${TRAIT} shadow-carte`;

/**
 * La liste pleine largeur : catalogue, tablée, récapitulatif, journal.
 *
 * Elle était naguère à fond perdu, débordant des marges de la page. Le kit en
 * fait une **carte contenue** : séparateurs de 3 px d'un bord à l'autre de la
 * carte, coins arrondis, ombre dure. Le `overflow-hidden` est ce qui fait
 * suivre les coins à la première et à la dernière ligne.
 */
export const LISTE = `flex flex-col divide-y-[3px] divide-border overflow-hidden ${CARTE}`;

/** Une ligne de liste qui se touche : elle s'allume au survol comme à l'appui. */
export const LIGNE_TOUCHABLE = "hover:bg-accent active:bg-accent";

/**
 * Le socle d'un champ de saisie : haut, cerclé, sur fond de carte.
 *
 * Le focus est une **ombre dure lagon** et non un halo flou : c'est la même
 * grammaire que le reste du kit, et ça se voit de loin. `outline-none` est
 * compensé par cette ombre, jamais laissé nu.
 */
const CHAMP = `h-13 w-full rounded-lg bg-card px-3.5 ${TRAIT} outline-none focus-visible:shadow-[4px_4px_0_var(--ring)]`;

/** Le champ texte d'un nom de joueur. */
export const CHAMP_NOM = `${CHAMP} text-[17px]`;

/**
 * Le champ d'un nombre — effectif d'une tablée, seuil de fin.
 *
 * En `font-mono` et centré comme tous les nombres de l'app : ce qu'on y tape
 * finira dans une colonne de la feuille de score, et se relit dans la même
 * police que là-bas.
 */
export const CHAMP_NOMBRE = `${CHAMP} text-center font-mono font-bold text-[22px] tabular-nums`;

/**
 * Le champ d'un code de partie : **gros, espacé, en capitales**.
 *
 * Plus haut que les autres et à `0.3em` d'interlettrage parce qu'un code **se
 * dicte** : six symboles détachés se lisent à voix haute, un bloc de six ne se
 * lit pas.
 */
export const CHAMP_CODE = `${CHAMP} h-16 text-center font-mono font-bold text-[26px] uppercase tracking-[0.3em]`;

/**
 * Une touche : le pavé de chiffres, et la désignation d'un nom.
 *
 * Elle s'**enfonce** à l'appui — elle glisse de 3 px et perd son ombre, si bien
 * que le doigt voit la touche descendre sous lui. C'est le seul retour qu'un
 * écran posé sur la table peut donner, et il ne coûte rien.
 */
export const TOUCHE = `rounded-lg bg-card ${TRAIT} shadow-touche outline-none transition-[transform,box-shadow] duration-75 active:translate-x-[3px] active:translate-y-[3px] active:shadow-none focus-visible:shadow-[3px_3px_0_var(--ring)] disabled:opacity-50 disabled:shadow-none`;

/** Une touche du pavé : haute, carrée, tapée sans regarder. */
export const TOUCHE_DE_CHIFFRE = `${TOUCHE} h-17 font-mono font-bold text-[26px]`;

/**
 * La touche qui **efface**, large de deux colonnes et rose pâle.
 *
 * Elle est la seule touche colorée du pavé, et les deux vont ensemble : elle
 * ferme la grille de dix chiffres — sans elle, la dernière rangée serait
 * bancale — et elle est la seule dont un appui par erreur coûte quelque chose.
 * On la vise, là où les chiffres se tapent sans regarder.
 */
export const TOUCHE_EFFACER = `${TOUCHE_DE_CHIFFRE} col-span-2 bg-effacer text-effacer-encre`;

/** Une touche de nom : le pavé sous une autre forme, pleine largeur. */
export const TOUCHE_DE_NOM = `${TOUCHE} min-h-15 w-full px-4 text-left font-semibold text-lg`;

/**
 * **Le** titre d'un écran, et il n'y en a qu'un.
 *
 * Darker Grotesque 900, serré, sur une ou deux lignes. Le kit est formel :
 * « jamais deux niveaux sur un écran » — un second titre de cette taille ferait
 * deux entrées à un écran qui n'en a qu'une. Ce qui vient dessous est un
 * {@link SOUS_TITRE}, dans la police d'interface.
 *
 * En `clamp` parce que la même phrase coiffe un téléphone tenu en main et un
 * portable posé au milieu de la table.
 */
export const TITRE =
  "font-heading font-black text-[clamp(2.5rem,11vw,3.25rem)] leading-[0.9] tracking-[-0.03em]";

/** Un titre de section, sous le titre de l'écran : la police d'interface, pas l'autre. */
export const SOUS_TITRE = "font-semibold text-lg tracking-tight";

/**
 * Le surtitre : la petite capitale monospace qui nomme ce qu'on regarde.
 *
 * « Manche 3 », « Partie en cours ». Elle est en `font-mono` et espacée parce
 * qu'elle est une **étiquette**, pas une phrase : on ne la lit pas, on la
 * repère.
 */
export const SURTITRE =
  "font-mono font-medium text-[0.8125rem] uppercase tracking-[0.16em] text-muted-foreground";

/**
 * L'afficheur : le grand nombre du pavé, et celui de l'écran de refus.
 *
 * Sur la surface d'appoint, cerclé, le chiffre à 68 px. C'est le seul endroit
 * de l'app où un nombre est plus gros que le titre — et c'est voulu : pendant
 * qu'on tape, la valeur *est* l'écran.
 */
export const AFFICHEUR = `flex flex-col items-center gap-1 rounded-lg bg-accent p-4 ${TRAIT}`;

/** Le nombre dans l'afficheur. */
export const AFFICHEUR_VALEUR = "font-mono font-bold text-[68px] leading-none tabular-nums";

/** Ce que le nombre compte, sous lui, en étiquette. */
export const AFFICHEUR_UNITE = `${SURTITRE} text-[0.6875rem] tracking-[0.14em]`;

/**
 * Un bandeau d'alerte : ce qui refuse, ce qui vient d'échouer.
 *
 * Cerclé comme tout le reste plutôt que teinté au dixième : un fond à 10 %
 * d'opacité sur du papier crème ne se distingue plus du papier.
 */
export const ALERTE = `flex flex-col gap-2 rounded-lg bg-card p-4 text-destructive ${TRAIT} border-destructive`;
