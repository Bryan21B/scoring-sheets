/**
 * L'id qu'un `RETURNING` vient de rendre, ou un échec sec.
 *
 * `noUncheckedIndexedAccess` oblige à traiter le cas « aucune ligne », et le
 * traiter par un `0` écrirait une clé étrangère qui ne désigne personne — la
 * contrainte la rejetterait, mais après coup et avec un message qui ne dit rien.
 * Une insertion sans id rendu est une base cassée, pas une valeur par défaut.
 *
 * @throws si la base n'a rendu aucune ligne.
 */
export function idRendu(lignes: readonly { id: number }[], quoi: string): number {
  const id = lignes[0]?.id;

  if (id === undefined) {
    throw new Error(`Insertion de ${quoi} sans id rendu : la base n'a pas répondu.`);
  }

  return id;
}
