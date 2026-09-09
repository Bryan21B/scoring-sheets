import type { ZodError } from "zod";

/**
 * Rend les défauts d'un parse Zod en liste lisible, une ligne par champ.
 *
 * Partagé plutôt que recopié : chaque frontière qui valide — l'environnement au
 * boot, l'instantané de règles relu en base — rend le même rapport, et corriger
 * sa forme les rattrape toutes. Le préfixe du message, lui, reste à l'appelant :
 * c'est lui qui sait ce qui était invalide.
 */
export function formatZodIssues(error: ZodError): string {
  return error.issues
    .map((issue) => `  - ${issue.path.join(".") || "(root)"}: ${issue.message}`)
    .join("\n");
}
