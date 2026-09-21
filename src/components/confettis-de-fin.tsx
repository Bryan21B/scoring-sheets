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
 * Les aplats du kit dont la gerbe se colore, nommés et non recopiés.
 *
 * `canvas-confetti` peint sur un canevas : il lui faut des couleurs résolues,
 * là où le reste de l'app ne manipule que des variables CSS. Les **lire** au
 * moment de tirer plutôt que réécrire les six hexadécimaux ici garde
 * `globals.css` seule source — et fait suivre la gerbe au mode sombre, où les
 * aplats montent en clarté.
 */
const APLATS_DE_LA_GERBE = ["--framboise", "--lagon", "--mandarine", "--raisin"] as const;

/**
 * Les couleurs de la gerbe, telles que la feuille de style les donne à
 * l'instant du tir.
 *
 * `undefined` si aucune ne se résout — hors navigateur, ou avant que la
 * feuille ne soit là. `canvas-confetti` retombe alors sur ses couleurs à lui,
 * ce qui vaut mieux qu'une gerbe transparente.
 */
function couleursDeLaGerbe(): string[] | undefined {
  const feuille = getComputedStyle(document.documentElement);
  const couleurs = APLATS_DE_LA_GERBE.map((nom) => feuille.getPropertyValue(nom).trim()).filter(
    (couleur) => couleur !== "",
  );

  return couleurs.length === 0 ? undefined : couleurs;
}

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
  // `null` et non `0` : « aucune fête » et « une salve vide » ne sont pas la
  // même chose, et c'est exactement pour ça que {@link Fete} a deux branches
  // plutôt qu'un nombre. Un zéro rendrait l'absence indistinguable d'une gerbe
  // qu'on aurait vidée, et laisserait monter le canevas d'un lien rouvert trois
  // jours plus tard. L'effet n'en dépend que par ce scalaire, que React sait
  // comparer d'un rendu à l'autre — un objet y relancerait la salve à chaque fois.
  const salve = fete.statut === "tombe" ? fete.pieces : null;

  useEffect(() => {
    if (salve === null) {
      return;
    }

    // Fire-and-forget : la promesse se résout à la fin de l'animation, et
    // l'attendre ne servirait qu'à retenir un effet qui n'a rien à ranger.
    void confetti({
      particleCount: salve,
      spread: OUVERTURE,
      origin: DEPART,
      colors: couleursDeLaGerbe(),
    });
  }, [salve]);

  return null;
}
