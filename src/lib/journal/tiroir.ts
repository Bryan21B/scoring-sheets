import { z } from "zod";
import type { journal } from "@/db/schema";
import { adresseDePartie } from "@/lib/partie/adresse";
import { type ParametresDeRecherche, premierParametre } from "@/lib/partie/identite-url";
import type { JoueurConnu } from "@/lib/roster/noms";

/**
 * La part **pure** du tiroir : son adresse, sa portée, sa mise en forme.
 *
 * Elle est séparée de `lecture.ts` pour que l'écran n'ait rien à importer de la
 * base : un composant de présentation reçoit des props, et tirer Drizzle dans
 * son graphe de modules pour y lire un nom de paramètre serait payer une
 * dépendance pour une chaîne de six lettres.
 */

/** Le geste qu'une ligne enregistre, tel que la colonne le contraint. */
export type Geste = (typeof journal.$inferSelect)["geste"];

/**
 * La charge utile d'une ligne, réduite à ce que le tiroir sait montrer.
 *
 * Discriminée par une **forme** et non par le geste : le journal est
 * append-only et ne se migre donc jamais, si bien qu'une ligne écrite par une
 * version antérieure garde pour toujours la charge utile de son époque. Un
 * lecteur qui exigerait la forme du jour rendrait le tiroir illisible
 * exactement le jour où on l'ouvre.
 */
export type DetailDuTiroir =
  | { forme: "valeur"; valeur: number | null }
  | { forme: "correction"; ancienne: number | null; nouvelle: number | null }
  | { forme: "aucun" };

/**
 * Un nombre du journal, mis en mots — et le vide **nommé** plutôt que rendu en
 * blanc.
 *
 * Une case vide est un état du domaine, pas une absence d'information : c'est
 * la désignation d'Uno, celle qui dit « il est sorti » avant que son total soit
 * tapé. Une ligne du tiroir qui n'afficherait rien se lirait « le journal n'a
 * rien gardé », ce qui est faux.
 */
export function valeurEnMots(valeur: number | null): string {
  return valeur === null ? VIDE : String(valeur);
}

/** Le mot du vide, un seul, pour que deux lignes du tiroir le disent pareil. */
const VIDE = "vide";

/** Une ligne du journal, telle que le tiroir la montre. */
export type LigneDuTiroir = {
  id: number;
  geste: Geste;
  /**
   * Le joueur **figé à l'écriture**, son nom relu maintenant.
   *
   * L'identifiant vient de la ligne et n'est jamais résolu depuis l'appareil :
   * repointer un téléphone réécrirait sinon tout son historique. Le **nom**, à
   * l'inverse, se relit — renommer un joueur propage partout, journal compris,
   * parce que c'est le même humain qui a fait la même chose.
   */
  agissant: JoueurConnu;
  /**
   * L'appareil d'où le geste est parti, réduit à une **étiquette** — « A », « B ».
   *
   * Jamais l'identifiant lui-même : c'est la valeur du cookie d'appareil, et la
   * rendre dans une page défairait le `HttpOnly` qui la protège. L'étiquette
   * suffit à ce qu'on vient chercher — le joueur seul ne distingue pas deux
   * téléphones qui se déclarent la même personne, et voir que Marie a écrit
   * depuis un appareil qui n'avait jamais été celui de Marie est précisément
   * l'anomalie pour laquelle le tiroir existe.
   *
   * `null` quand la ligne n'en porte pas : la colonne est nullable, un appareil
   * ayant pu être effacé depuis.
   */
  appareil: string | null;
  /** Le joueur dont la case est touchée. Absent des gestes qui n'en portent pas. */
  joueurConcerne: JoueurConnu | null;
  /** Le numéro nu que la ligne garde, jamais un identifiant de manche. */
  mancheNumero: number | null;
  /** La part variable du geste, relue du JSON et jamais tenue pour acquise. */
  detail: DetailDuTiroir;
  /** L'horloge du **serveur**, jamais celle du téléphone qui a tapé. */
  ecritLe: Date;
};

/**
 * Ce que le tiroir montre : la routine, ou seulement ce qui n'en est pas.
 *
 * Deux portées et pas trois : le tiroir existe pour la ligne qu'on vient
 * chercher, et un troisième cadrage serait un réglage à comprendre avant de
 * pouvoir lire.
 */
export const porteeSchema = z.enum(["corrections", "tout"]).catch("corrections");

/** La portée demandée, validée. */
export type Portee = z.infer<typeof porteeSchema>;

/** Le tiroir tel que la page de partie le reçoit : fermé, ou ouvert sur une portée. */
export type VueDuTiroir =
  | { etat: "ferme" }
  | { etat: "ouvert"; portee: Portee; lignes: readonly LigneDuTiroir[] };

/**
 * Le paramètre d'adresse qui pilote le tiroir.
 *
 * L'état vit dans l'URL et non dans le composant : le tiroir s'ouvre sur une
 * page qui **se rafraîchit toute seule** — les autres téléphones y écrivent —
 * et un état local se refermerait à chaque tour de poll, exactement pendant
 * qu'on lit la ligne qu'on était venu chercher.
 */
const PARAM_TIROIR = "journal";

/** Les 26 étiquettes de base, puis « AA », « AB » — le tableur, que tout le monde lit. */
const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

/**
 * L'étiquette du n-ième appareil d'une partie.
 *
 * Totale au-delà de vingt-six, ce qu'aucune table n'atteindra : une fonction
 * qui rendrait `undefined` passé Z ferait disparaître l'étiquette au lieu de
 * la rallonger, et c'est le genre de trou qu'on ne voit qu'en production.
 */
export function etiquetteDAppareil(rang: number): string {
  let reste = rang;
  let etiquette = "";

  do {
    etiquette = (ALPHABET[reste % ALPHABET.length] ?? "") + etiquette;
    reste = Math.floor(reste / ALPHABET.length) - 1;
  } while (reste >= 0);

  return etiquette;
}

/**
 * Les gestes que le tiroir montre par défaut.
 *
 * Une partie de sept manches à cinq joueurs produit trente-cinq saisies de
 * routine ; elles enterreraient la ligne qu'on est venu chercher. **Tout reste
 * écrit, c'est la lecture qui filtre, jamais l'écriture** — la bascule « tout
 * afficher » rend les autres sans qu'aucune n'ait jamais été perdue.
 *
 * `abandon` et `reprise` y sont, et c'est le critère qui les y met plutôt qu'une
 * exception : la vue par défaut montre **ce qui sort de la routine**, et ces
 * deux-là sont les seuls gestes qui changent ce que les autres ont le **droit**
 * de faire. Les enterrer sous la bascule montrerait une partie qui recommence à
 * bouger sans dire pourquoi elle avait cessé, ni qui l'a rouverte — ce qui est
 * exactement la question qu'on vient poser au journal. Ils sont d'ailleurs rares
 * là où les saisies sont nombreuses : ils n'enterrent rien.
 *
 * `participantAjoute` et `participantRetire` n'y sont pas : ils ne se consignent
 * que sur un journal déjà non vide — après un dégel — et ils ne retirent de
 * droit à personne.
 */
const GESTES_MONTRES_PAR_DEFAUT: readonly Geste[] = [
  "correction",
  "suppressionDeManche",
  "abandon",
  "reprise",
];

/** Ce geste sort-il de la routine, et mérite-t-il donc la vue par défaut ? */
export function sortDeLaRoutine(geste: Geste): boolean {
  return GESTES_MONTRES_PAR_DEFAUT.includes(geste);
}

/**
 * Ce que l'adresse demande, `null` si elle ne demande rien.
 *
 * Tolérant plutôt que strict : une valeur inconnue ouvre le tiroir sur la vue
 * par défaut au lieu de lever. Une adresse se bricole, et un tiroir qui casse
 * la page de partie pour un paramètre mal tapé coûte infiniment plus cher que
 * la portée qu'il n'a pas su lire.
 */
export function porteeDeLAdresse(recherche: ParametresDeRecherche): Portee | null {
  const brut = premierParametre(recherche[PARAM_TIROIR]);

  // Avant le schéma, et pas dedans : l'absence n'est pas une portée invalide,
  // c'est un tiroir fermé. Les confondre ouvrirait le journal sur toute page.
  if (brut === undefined) {
    return null;
  }

  return porteeSchema.parse(brut);
}

/**
 * L'adresse du tiroir sur cette portée, ou celle de la page nue pour le refermer.
 *
 * Elle ne reconduit **aucun autre paramètre** de l'adresse courante, et c'est
 * voulu : le seul qui y traîne est le message de refus d'une écriture, qui est
 * transitoire et n'a rien à faire au-dessus d'un journal ouvert pour comprendre
 * ce qui s'est passé.
 */
export function adresseDuTiroir(code: string, portee: Portee | null): string {
  const page = adresseDePartie(code);

  return portee === null ? page : `${page}?${PARAM_TIROIR}=${portee}`;
}

/**
 * Le fuseau dans lequel le journal se lit.
 *
 * Fixé, et non celui du navigateur : l'horodatage est **l'horloge du serveur**,
 * et deux téléphones qui liraient la même ligne dans deux fuseaux liraient deux
 * heures différentes. Le tiroir existe pour trancher une dispute autour d'une
 * table — une seule table, un seul fuseau — et une heure qui dépend de qui
 * regarde ne tranche rien.
 */
const FUSEAU = "Europe/Paris";

const FORMAT_HORODATAGE = new Intl.DateTimeFormat("fr-FR", {
  timeZone: FUSEAU,
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

/**
 * L'horodatage d'une ligne, assemblé pièce par pièce.
 *
 * `formatToParts` et non la chaîne rendue par `format` : celle-ci varie d'une
 * version d'ICU à l'autre — l'espace avant l'heure, la présence de « à » — et
 * un écran dont le texte dépend de la version du runtime n'est pas vérifiable.
 */
export function horodatage(date: Date): string {
  const parties = new Map(
    FORMAT_HORODATAGE.formatToParts(date).map((partie) => [partie.type, partie.value]),
  );
  const jour = parties.get("day") ?? "";
  const mois = parties.get("month") ?? "";
  const annee = parties.get("year") ?? "";
  const heure = parties.get("hour") ?? "";
  const minute = parties.get("minute") ?? "";

  return `${jour}/${mois}/${annee} à ${heure}:${minute}`;
}
