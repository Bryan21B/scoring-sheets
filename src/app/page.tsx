import { CatalogueListe } from "@/components/catalogue-liste";
import { CATALOGUE } from "@/lib/jeux/catalogue";

/**
 * L'accueil, tant qu'aucune partie n'est en cours : **le catalogue**.
 *
 * Il n'y a pas d'écran d'accueil à composer par-dessus — la première question
 * d'une soirée est « on joue à quoi ? », et l'y poser directement supprime un
 * écran de cérémonie qui n'existerait que pour être traversé.
 */
export default function Accueil() {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-4 py-8">
      <h1 className="font-semibold text-2xl tracking-tight">On joue à quoi ?</h1>
      <CatalogueListe entrees={Object.values(CATALOGUE)} />
    </main>
  );
}
