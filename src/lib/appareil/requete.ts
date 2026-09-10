import { cookies, headers } from "next/headers";
import {
  assurerIdAppareil,
  type IdAppareil,
  idAppareilSchema,
  NOM_COOKIE_APPAREIL,
  OPTIONS_COOKIE_APPAREIL,
} from "@/lib/appareil/cookie";
import { cleDOrigine, EN_TETE_ADRESSE, EN_TETE_ADRESSE_REELLE } from "@/lib/partie/origine";

/**
 * L'identifiant d'appareil de la requête courante, posé s'il manquait.
 *
 * Le proxy l'a normalement déjà posé ; le refaire ici couvre le cas où une
 * action arrive sans être passée par lui — un `POST` direct, un cookie effacé
 * entre deux écrans. Sans ça, se choisir n'écrirait aucun lien et personne ne
 * serait reconnu au retour.
 */
export async function assurerLAppareil(): Promise<IdAppareil> {
  const bocal = await cookies();
  const idAppareil = assurerIdAppareil(bocal.get(NOM_COOKIE_APPAREIL)?.value);

  bocal.set(NOM_COOKIE_APPAREIL, idAppareil, OPTIONS_COOKIE_APPAREIL);

  return idAppareil;
}

/**
 * L'identifiant d'appareil de la requête courante, **sans rien écrire**.
 *
 * C'est la seule forme utilisable depuis une page : Next refuse qu'un composant
 * serveur pose un cookie, et il n'y a rien à poser — le proxy l'a fait, et il
 * réinjecte la valeur dans la requête transmise pour que le rendu du **même**
 * chargement la voie déjà.
 *
 * Rend `undefined` plutôt que d'en fabriquer un : un appareil inconnu est un
 * appareil inconnu, et lui inventer un identifiant qui ne sera jamais renvoyé
 * au navigateur ne reconnaîtrait personne.
 */
export async function lireLAppareil(): Promise<IdAppareil | undefined> {
  const valeur = (await cookies()).get(NOM_COOKIE_APPAREIL)?.value;
  const parsed = idAppareilSchema.safeParse(valeur);

  return parsed.success ? parsed.data : undefined;
}

/**
 * La clé sous laquelle la requête courante compte ses tentatives.
 *
 * Lit l'en-tête plutôt que le cookie en premier : voir
 * `src/lib/partie/origine.ts`, qui porte la décision et se vérifie sans requête.
 */
export async function cleDeLaRequete(idAppareil: string | undefined): Promise<string> {
  const entetes = await headers();

  return cleDOrigine(
    {
      reelle: entetes.get(EN_TETE_ADRESSE_REELLE),
      transmise: entetes.get(EN_TETE_ADRESSE),
    },
    idAppareil,
  );
}
