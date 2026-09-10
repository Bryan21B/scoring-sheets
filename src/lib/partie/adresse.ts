import { codeSchema } from "@/lib/partie/code";

/**
 * L'adresse d'une partie, écrite **une seule fois** dans le dépôt.
 *
 * Le code vit dans l'URL : c'est ce qui fait qu'un lien envoyé par messagerie
 * et un code dicté au téléphone sont la même chose. Ce format-là ne se recopie
 * donc pas d'un écran à l'autre — il se lit ici, et les pages de partie portent
 * pour cette raison une politique de référent restrictive.
 *
 * Prend une chaîne et non un {@link CodeDePartie} : un code faux **a** une
 * adresse, celle qui affiche « ce code ne mène à aucune partie ». Refuser de la
 * construire obligerait l'appelant à réécrire `/p/` pour ce seul cas.
 */
export function adresseDePartie(code: string): string {
  return `/p/${code}`;
}

/**
 * Ce que le champ « j'ai un code » vise, ou `null` si ce n'est pas un code.
 *
 * Le lien reçu et le code retapé ne sont **pas deux chemins** : celui-ci se
 * normalise puis rejoint exactement l'adresse de celui-là. C'est
 * `codeSchema` qui tranche, comme partout ailleurs — une deuxième lecture de la
 * même forme divergerait le jour où l'une est corrigée seule.
 *
 * `null` et non l'adresse du texte brut : l'appelant décide quoi en faire, et
 * les deux décisions existent — la page « rejoindre » y envoie quand même pour
 * afficher l'état dédié, une action d'écriture rentre à l'accueil.
 */
export function adresseDuCodeTape(brut: string): string | null {
  const code = codeSchema.safeParse(brut);

  return code.success ? adresseDePartie(code.data) : null;
}
