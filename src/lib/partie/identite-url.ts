import { z } from "zod";
import { type IdentiteChoisie, identiteSchema } from "@/lib/partie/identite";

/**
 * Le refus que la création a renvoyé dans l'adresse, avant de l'afficher.
 *
 * Il repasse par un schéma parce que rien ne prouve qu'il sort de notre propre
 * redirection : une adresse se bricole, et celle-ci se rend dans la page. Le
 * plafond garde une phrase, pas un paragraphe collé par quelqu'un d'autre.
 */
export const messageDeRefusSchema = z.string().trim().min(1).max(200);

/** Ce que Next rend d'une query string : une valeur, plusieurs, ou rien. */
export type ParametresDeRecherche = Record<string, string | string[] | undefined>;

/**
 * La première valeur d'un paramètre, quelle que soit la forme reçue.
 *
 * Une adresse peut porter deux fois la même clé — un lien bricolé, un retour
 * arrière — et rien ne l'interdit. Prendre la première est arbitraire mais
 * total : aucune branche ne reste sans réponse.
 */
export function premierParametre(valeur: string | string[] | undefined): string | undefined {
  return Array.isArray(valeur) ? valeur[0] : valeur;
}

/**
 * Relit l'identité que l'écran précédent a mise dans l'adresse.
 *
 * C'est ce qui permet de la choisir sans encore l'écrire : entre « qui es-tu ? »
 * et la tablée, l'identité ne vit que dans l'URL. Rien n'est créé tant que la
 * partie n'est pas ouverte, et un retour arrière n'a donc rien à défaire.
 *
 * Le choix explicite l'emporte sur le nom tapé : on arrive là par « c'est
 * elle » après une désambiguïsation, et le nom traîne encore dans l'adresse.
 *
 * Rend `null` plutôt que de lever — une adresse tronquée renvoie à la question,
 * elle ne casse pas une page. C'est `identiteSchema` qui valide, comme à
 * l'écriture : deux lectures de la même forme divergeraient.
 */
export function lireIdentiteChoisie(recherche: ParametresDeRecherche): IdentiteChoisie | null {
  const joueurId = premierParametre(recherche.joueurId);
  const choisi = identiteSchema.safeParse({ mode: "roster", joueurId });

  if (choisi.success) {
    return choisi.data;
  }

  const nom = premierParametre(recherche.nom);
  const tape = identiteSchema.safeParse({ mode: "nouveau", nom });

  return tape.success ? tape.data : null;
}

/** L'autre sens : l'identité, mise dans l'adresse de l'écran suivant. */
export function ecrireIdentiteChoisie(identite: IdentiteChoisie): URLSearchParams {
  return new URLSearchParams(
    identite.mode === "roster" ? { joueurId: String(identite.joueurId) } : { nom: identite.nom },
  );
}
