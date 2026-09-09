/**
 * PROTOTYPE JETABLE — maquette du parcours d'arrivée, issue #9.
 *
 * Données figées en mémoire, aucune persistance. La logique du parcours est
 * déjà tranchée par `docs/specs/2026-08-31-identite-et-arrivee.md` : ce
 * prototype ne la rediscute pas, il cherche à quoi ressemblent les écrans.
 */

/** Une entrée du catalogue, réduite à ce que l'accueil et la création affichent. */
export type Jeu = {
  id: string;
  nom: string;
  sousTitre: string;
  seuilParDefaut: number | null;
  unite: string;
  joueurs: string;
};

/** Une partie déjà commencée, telle que l'accueil la résume. */
export type PartieEnCours = {
  code: string;
  jeu: string;
  participants: readonly string[];
  manches: number;
  meneur: string;
  score: number;
  depuis: string;
  aMoi: boolean;
};

export const JEUX: readonly Jeu[] = [
  {
    id: "6-qui-prend",
    nom: "6 qui prend",
    sousTitre: "Le moins de têtes de bœuf gagne",
    seuilParDefaut: 66,
    unite: "têtes de bœuf",
    joueurs: "2 à 10",
  },
  {
    id: "6-qui-prend-cartes-speciales",
    nom: "6 qui prend",
    sousTitre: "Variante cartes spéciales — deux manches",
    seuilParDefaut: null,
    unite: "têtes de bœuf",
    joueurs: "2 à 8",
  },
  {
    id: "uno",
    nom: "Uno",
    sousTitre: "Premier à 500 points",
    seuilParDefaut: 500,
    unite: "points",
    joueurs: "2 à 10",
  },
  {
    id: "dnup",
    nom: "Dnup",
    sousTitre: "Premier à 4 jetons lettre",
    seuilParDefaut: 4,
    unite: "jetons",
    joueurs: "2 à 5",
  },
];

export const PARTIES_EN_COURS: readonly PartieEnCours[] = [
  {
    code: "K7M2QX",
    jeu: "6 qui prend",
    participants: ["Bryan", "Léa", "Marc", "Sofia", "Théo"],
    manches: 3,
    meneur: "Léa",
    score: 35,
    depuis: "il y a 12 min",
    aMoi: true,
  },
  {
    code: "B3PWNH",
    jeu: "Uno",
    participants: ["Bryan", "Sofia", "Nadia"],
    manches: 1,
    meneur: "Sofia",
    score: 218,
    depuis: "hier",
    aMoi: true,
  },
];

/** Le roster global, tel qu'il est après quelques soirées. */
export const ROSTER: readonly string[] = [
  "Bryan",
  "Léa",
  "Marc",
  "Sofia",
  "Théo",
  "Nadia",
  "Julien",
  "Chloé",
];

/** Les participants de la partie qu'on rejoint par le lien. */
export const PARTICIPANTS: readonly string[] = ["Marie", "Paul", "Sofia"];

/** Le code de la partie qu'on rejoint. Crockford Base32, six caractères, dictable. */
export const CODE_PARTIE = "K7M2QX";

/**
 * Les écrans de la maquette.
 *
 * Les trois variantes rendent les mêmes, pour qu'on compare des écrans
 * comparables. Les quatre états d'arrivée viennent du diagramme de la spec.
 */
export const ECRANS = [
  { id: "accueil", nom: "Accueil" },
  { id: "creation", nom: "Création" },
  { id: "arrivee", nom: "Arrivée — appareil vierge" },
  { id: "arrivee-lie", nom: "Arrivée — appareil déjà lié" },
  { id: "arrivee-figee", nom: "Arrivée — partie figée" },
  { id: "finie", nom: "Partie terminée" },
] as const;

/** L'identifiant d'un écran de la maquette. */
export type EcranId = (typeof ECRANS)[number]["id"];

/** L'écran servi quand l'URL n'en désigne aucun de valide. */
export const ECRAN_PAR_DEFAUT: EcranId = "accueil";

/** Normalise le paramètre d'URL en identifiant d'écran connu. */
export function ecranParId(id: string | undefined): EcranId {
  const trouve = ECRANS.find((e) => e.id === id);
  return trouve === undefined ? ECRAN_PAR_DEFAUT : trouve.id;
}

/** Le nom lisible d'un écran, pour la barre de bascule. */
export function nomEcran(id: EcranId): string {
  return ECRANS.find((e) => e.id === id)?.nom ?? id;
}
