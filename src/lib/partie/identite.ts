import { z } from "zod";
import { nomSchema } from "@/lib/roster/noms";

/**
 * Qui ouvre la partie : quelqu'un que le roster porte déjà, ou un nom neuf.
 *
 * Deux modes plutôt qu'un champ optionnel : « j'ai choisi Marie dans la liste »
 * et « j'ai tapé Marie » ne veulent pas dire la même chose, et c'est exactement
 * cette différence que la désambiguïsation exploite.
 *
 * Coercitif sur `joueurId` parce que ses deux sources — un champ caché de
 * formulaire et un paramètre d'adresse — n'envoient jamais que des chaînes.
 */
export const identiteSchema = z.discriminatedUnion("mode", [
  z.strictObject({
    mode: z.literal("roster"),
    joueurId: z.coerce.number().int().positive(),
  }),
  z.strictObject({ mode: z.literal("nouveau"), nom: nomSchema }),
]);

/**
 * L'identité choisie à l'écran « qui es-tu ? », **pas encore écrite**.
 *
 * Elle ne vit que dans l'adresse jusqu'à l'ouverture de la partie : rien n'est
 * créé tant qu'on n'a pas validé la tablée, et un retour arrière n'a donc rien
 * à défaire.
 */
export type IdentiteChoisie = z.infer<typeof identiteSchema>;

/**
 * Les champs plats d'identité d'un formulaire, tels quels.
 *
 * Rendus **sans être validés** : c'est {@link identiteSchema} qui tranche, à
 * l'écriture, et une deuxième validation ici en ferait deux à corriger le jour
 * où la forme change. Les deux formulaires qui la portent — la tablée à la
 * création, l'arrivée en salle d'attente — envoient exactement la même chose.
 */
export function lireIdentiteDuFormulaire(formulaire: FormData): Record<string, string> {
  const mode = String(formulaire.get("mode") ?? "");

  return mode === "roster"
    ? { mode, joueurId: String(formulaire.get("joueurId") ?? "") }
    : { mode, nom: String(formulaire.get("nom") ?? "") };
}
