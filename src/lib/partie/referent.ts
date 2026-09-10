/** Le nom de l'en-tête HTTP, écrit une fois pour la config et pour son test. */
export const EN_TETE_REFERENT = "Referrer-Policy";

/**
 * Ne rien envoyer du tout.
 *
 * Le code d'une partie **vit dans l'URL** — c'est ce qui fait qu'un lien
 * partagé et un code dicté sont la même chose — et la page porte le lien vers
 * les règles de l'éditeur. Sans cette politique, le premier clic sortant
 * emporterait `/p/A1B2C3` dans l'en-tête `Referer` d'un site tiers.
 *
 * `no-referrer` plutôt que `strict-origin-when-cross-origin`, qui est déjà le
 * défaut de la plupart des navigateurs : ce défaut protège du départ vers un
 * autre domaine, pas d'une ressource tierce chargée depuis la page, et il n'est
 * garanti nulle part. Il n'y a par ailleurs rien à perdre — aucune mesure
 * d'audience ne lit ce champ ici.
 */
export const POLITIQUE_DE_REFERENT = "no-referrer";

/**
 * L'adresse que la politique couvre : toute page de partie, et rien d'autre.
 *
 * Le motif suit `adresseDePartie` — il ne se dérive pas d'elle, Next voulant un
 * gabarit de route et non une adresse. Les deux se lisent côte à côte :
 * `src/lib/partie/adresse.ts` écrit l'adresse, celui-ci dit ce qui la protège.
 */
export const CHEMIN_DES_PARTIES = "/p/:code*";
