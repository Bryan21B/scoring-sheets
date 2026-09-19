import { z } from "zod";
import type { Base } from "@/db/base";
import { idAppareilSchema } from "@/lib/appareil/cookie";
import { lireLeJoueurDeLAppareil } from "@/lib/appareil/lecture";
import type { CodeDePartie } from "@/lib/partie/code";
import { creerPartie } from "@/lib/partie/creation";
import type { VueDePartie } from "@/lib/partie/lecture";
import { ajouterParticipant, PAS_DE_LA_PARTIE } from "@/lib/partie/salle-attente";

/**
 * **Rejouer la même tablée** : la sortie principale de l'écran de fin.
 *
 * Une nouvelle partie, même jeu, mêmes règles, mêmes joueurs, nouveau code. Ce
 * n'est pas une reprise — la partie finie reste finie, scellée, et sa feuille
 * de score ne bouge plus — c'est la soirée suivante, ouverte sans repasser par
 * le catalogue, l'effectif et le seuil.
 */

/** Ce que le rejeu envoie : l'appareil qui appuie, et rien d'autre. */
export const rejeuSchema = z.strictObject({ idAppareil: idAppareilSchema });

/**
 * Un refus **écrit pour être lu**, au-dessus de la fiche de la partie finie.
 *
 * Une classe à part, comme pour le départ : un écran qui voudrait un jour
 * distinguer « tu regardes cette partie » de « la liste est fermée » n'aurait
 * plus de quoi le faire si tous les gestes partageaient leur type d'erreur.
 */
export class RefusDeRejeu extends Error {
  override readonly name = "RefusDeRejeu";
}

/**
 * Ouvre la partie suivante avec exactement la tablée de celle-ci.
 *
 * **Elle ne forke pas la création** : `creerPartie` ouvre la partie et y met
 * celui qui appuie, `ajouterParticipant` assoit les autres. Les deux gestes du
 * domaine existent déjà et portent leurs propres règles — le code unique, les
 * bornes de joueurs, l'instantané figé, le mode « un seul téléphone » — et les
 * réécrire ici en ferait des copies qui divergeraient.
 *
 * **Les règles se rejouent, elles ne se recopient pas.** L'effectif et la
 * valeur de fin repartent dans `creerPartie`, qui refige l'instantané par
 * `resoudreRegles` : c'est ce qui fait qu'une variante selon l'effectif — Dnup
 * à deux joueurs — se retrouve identique sans qu'on ait à la relire à la main.
 *
 * **Celui qui appuie doit être de la tablée.** Le code donne la lecture, et un
 * passant qui rejouerait ouvrirait une soirée entre des gens qu'il ne connaît
 * pas — en s'y asseyant lui-même, puisque `creerPartie` inscrit son auteur.
 *
 * **Le parti n'est pas rappelé** : {@link VueDePartie.participants} ne porte que
 * les places vivantes, si bien que celui qui est rentré chez soi à la manche 4
 * n'est pas réinvité par un bouton. C'est la même lecture qui le sort du
 * classement affiché, et non une seconde règle écrite ici.
 *
 * **Celui qui appuie se retrouve en tête de la nouvelle tablée**, quel que soit
 * son rang dans l'ancienne : l'ordre d'une tablée est son ordre d'inscription,
 * et `creerPartie` inscrit son auteur en premier. L'ensemble des joueurs est le
 * même, l'ordre des colonnes peut donc tourner d'une soirée à l'autre — ce qui
 * est exactement ce qui arrive quand c'est un autre qui ouvre la partie.
 *
 * Les autres joueurs sont assis **après** la création, hors de sa transaction :
 * c'est le prix de la réutilisation, et il est modeste. Une tablée incomplète
 * est une partie non gelée à laquelle il manque un nom, que la salle d'attente
 * sait compléter d'un geste — là où une insertion écrite ici pour tenir
 * l'atomicité dupliquerait `inscrire`.
 *
 * @throws {@link RefusDeRejeu} si l'appareil n'est pas celui d'un participant.
 * @throws {@link RefusDeCreation} si l'effectif restant sort des bornes du jeu
 * — une tablée de cinq réduite à deux par les départs ne rejoue pas un jeu qui
 * en demande trois, et le dire vaut mieux qu'ouvrir une partie injouable.
 */
export async function rejouerLaTablee(
  base: Base,
  modele: VueDePartie,
  saisie: unknown,
): Promise<CodeDePartie> {
  const donnees = rejeuSchema.parse(saisie);
  const agissantId = await lireLeJoueurDeLAppareil(base, donnees.idAppareil);
  const agissant = modele.participants.find((joueur) => joueur.id === agissantId);

  if (agissant === undefined) {
    throw new RefusDeRejeu(PAS_DE_LA_PARTIE);
  }

  const resultat = await creerPartie(base, {
    idAppareil: donnees.idAppareil,
    jeuId: modele.jeu.id,
    nombreDeJoueurs: modele.participants.length,
    finValeur: modele.regles.fin.valeur,
    identite: { mode: "roster", joueurId: agissant.id },
  });

  // `creerPartie` ne désambiguïse que sur un nom tapé ; ici l'identité vient
  // d'un identifiant déjà au roster, et cette branche est donc inatteignable.
  if (resultat.statut !== "creee") {
    throw new Error(`Rejeu de ${modele.code} : création attendue, reçu « ${resultat.statut} ».`);
  }

  for (const joueur of modele.participants) {
    if (joueur.id === agissant.id) {
      continue;
    }

    await ajouterParticipant(base, resultat.partieId, {
      idAppareil: donnees.idAppareil,
      identite: { mode: "roster", joueurId: joueur.id },
    });
  }

  return resultat.code;
}
