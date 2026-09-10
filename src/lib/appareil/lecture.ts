import { eq } from "drizzle-orm";
import type { Base } from "@/db/base";
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
 */
export async function lireLeJoueurDeLAppareil(
  base: Base,
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
