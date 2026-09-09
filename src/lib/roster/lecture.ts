import { asc } from "drizzle-orm";
import type { Base } from "@/db/base";
import { joueur } from "@/db/schema";
import type { JoueurConnu } from "@/lib/roster/noms";

/**
 * Le roster global, dans l'ordre où il se relit : par nom.
 *
 * Global et non par partie — c'est la même liste partout, et c'est ce qui fait
 * que « qui es-tu ? » ne se repose pas à chaque soirée.
 */
export async function listerLeRoster(base: Base): Promise<JoueurConnu[]> {
  return base.select({ id: joueur.id, nom: joueur.nom }).from(joueur).orderBy(asc(joueur.nom));
}
