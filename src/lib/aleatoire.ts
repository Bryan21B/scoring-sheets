/** Les valeurs qu'un octet peut prendre. C'est ce que 256 veut dire plus bas. */
const VALEURS_PAR_OCTET = 256;

/**
 * Tire une chaîne au hasard dans un alphabet, sans biais.
 *
 * Deux identifiants du domaine sortent d'ici — la valeur opaque du cookie
 * d'appareil et le code d'une partie — et ce qu'ils partagent n'est pas la
 * forme mais **l'argument de non-biais** : `octet % n` n'est uniforme que si
 * `n` divise 256. À 33 symboles, les premiers sortiraient plus souvent, et
 * rien à l'usage ne le montrerait. Écrit une fois, il ne peut pas être vrai
 * ici et faux là.
 *
 * @throws si l'alphabet ne divise pas 256 — c'est une erreur de programmation,
 * pas une entrée à valider, et elle doit tomber au premier appel.
 */
export function tirerAuHasard(alphabet: string, longueur: number): string {
  if (alphabet.length === 0 || VALEURS_PAR_OCTET % alphabet.length !== 0) {
    throw new Error(
      `Un alphabet de ${alphabet.length} symboles biaiserait le tirage : il doit diviser ${VALEURS_PAR_OCTET}.`,
    );
  }

  const octets = crypto.getRandomValues(new Uint8Array(longueur));

  return Array.from(octets, (octet) => alphabet[octet % alphabet.length]).join("");
}
