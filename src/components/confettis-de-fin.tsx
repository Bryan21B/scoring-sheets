"use client";

import confetti from "canvas-confetti";
import { useEffect } from "react";
import type { Fete } from "@/lib/partie/fete";

/**
 * D'où la salve part : un peu au-dessus du milieu, pour que les pièces
 * retombent sur l'écran plutôt que d'en sortir par le haut.
 */
const DEPART = { y: 0.35 } as const;

/** L'ouverture de la gerbe, en degrés. Large : c'est une table, pas un canon. */
const OUVERTURE = 90;

/**
 * La salve de fin de partie — **l'animation, et jamais la décision**.
 *
 * Ce composant ne sait pas qui a gagné, ni depuis quand la partie est finie, ni
 * si celui qui regarde était à table. Tout cela est tranché en amont par
 * `feteDeLaFin`, qui rend un {@link Fete} : une fête qui tombe et son nombre de
 * pièces, ou rien du tout. C'est ce partage qui rend la règle vérifiable — une
 * condition écrite dans le `useEffect` ne s'atteste qu'à l'œil, et une fête ne
 * se rejoue pas pour vérifier.
 *
 * Il ne rend **rien** : `canvas-confetti` monte son propre canevas en position
 * fixe et le retire tout seul. Rien à placer dans la page, rien à défaire.
 *
 * La salve part **une fois**, à l'arrivée sur l'écran. L'effet ne dépend que du
 * nombre de pièces : une partie terminée ne se sonde pas — elle ne changera
 * plus — donc ce rendu-ci est le seul, et il n'y a pas de battement qui
 * viendrait retirer une seconde gerbe trois secondes plus tard.
 */
export function ConfettisDeFin({ fete }: { fete: Fete }): null {
  const pieces = fete.statut === "tombe" ? fete.pieces : 0;

  useEffect(() => {
    if (pieces === 0) {
      return;
    }

    // Fire-and-forget : la promesse se résout à la fin de l'animation, et
    // l'attendre ne servirait qu'à retenir un effet qui n'a rien à ranger.
    void confetti({ particleCount: pieces, spread: OUVERTURE, origin: DEPART });
  }, [pieces]);

  return null;
}
