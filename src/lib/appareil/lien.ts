import type { Ecriture } from "@/db/base";
import { appareil } from "@/db/schema";
import type { IdAppareil } from "@/lib/appareil/cookie";

/**
 * Fait pointer un appareil vers un joueur — la seule écriture qui touche ce
 * lien, où qu'on se choisisse.
 *
 * Le lien est **global** : un appareil est une personne, partout, jamais par
 * partie. La ligne se **repointe** donc au lieu de se dédoubler, et le passé
 * n'est jamais relu — le journal fige le joueur agissant à l'écriture
 * précisément pour ça. C'est une déclaration, pas une preuve.
 *
 * Prend la transaction en cours : se choisir et devenir participant sont un
 * seul geste, et un appareil qui pointerait vers un joueur jamais inscrit
 * serait le résidu d'une transaction à moitié passée.
 */
export async function lierLAppareil(
  tx: Ecriture,
  idAppareil: IdAppareil,
  joueurId: number,
  maintenant: Date,
): Promise<void> {
  await tx
    .insert(appareil)
    .values({ id: idAppareil, joueurId, vuLe: maintenant, creeLe: maintenant })
    .onConflictDoUpdate({ target: appareil.id, set: { joueurId, vuLe: maintenant } });
}
