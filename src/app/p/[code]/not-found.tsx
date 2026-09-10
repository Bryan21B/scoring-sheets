import type { ReactElement } from "react";
import { CodeInconnu } from "@/components/code-inconnu";

/**
 * Ce qu'un code que personne ne porte affiche.
 *
 * Un état **dédié** et non la page 404 du framework : un code se dicte à voix
 * haute, se tromper d'une lettre est le cas ordinaire, et la seule chose utile
 * est de pouvoir le retaper sur place. Ce qu'il ne montre jamais, c'est la
 * partie de quelqu'un d'autre — un code n'est pas recyclé, précisément pour ça.
 */
export default function PartieIntrouvable(): ReactElement {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-4 py-8">
      <CodeInconnu />
    </main>
  );
}
