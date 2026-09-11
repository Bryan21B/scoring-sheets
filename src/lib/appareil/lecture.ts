import { eq } from "drizzle-orm";
import type { Lecture } from "@/db/base";
import { appareil } from "@/db/schema";
import { idAppareilSchema } from "@/lib/appareil/cookie";

/**
 * Le joueur vers lequel un appareil pointe, ou `null`.
 *
 * `null` couvre les quatre façons de n'être personne — pas de cookie, un cookie
 * bricolé, un appareil que la base ne connaît pas, un navigateur vierge — et
 * c'est délibéré : la passe avant démarre sur la première case manquante dans
 * tous ces cas, et les distinguer ferait quatre branches pour un seul
 * comportement.
 *
 * Le lien est **global**, jamais par partie, et c'est une **déclaration, pas
 * une preuve** : ce que cette fonction rend sert à savoir sur quel écran
 * démarrer, jamais à autoriser quoi que ce soit.
 *
 * Prend une {@link Lecture} : la même question se pose depuis une page, qui a
 * la base, et depuis l'intérieur d'une écriture qui doit savoir **qui agit**
 * avant de consigner sa ligne de journal. Une seconde version pour la
 * transaction divergerait de celle-ci le jour où l'une est corrigée seule.
 */
export async function lireLeJoueurDeLAppareil(
  base: Lecture,
  valeurDuCookie: string | undefined,
): Promise<number | null> {
  const id = idAppareilSchema.safeParse(valeurDuCookie);

  if (!id.success) {
    return null;
  }

  const [ligne] = await base
    .select({ joueurId: appareil.joueurId })
    .from(appareil)
    .where(eq(appareil.id, id.data))
    .limit(1);

  return ligne?.joueurId ?? null;
}
