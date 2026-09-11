import { and, eq, isNull } from "drizzle-orm";
import type { Base, Ecriture } from "@/db/base";
import { participant } from "@/db/schema";
import { lireLeJoueurDeLAppareil } from "@/lib/appareil/lecture";
import { consignerUnMouvementDeParticipant } from "@/lib/journal/ligne";
import { journalEstVide } from "@/lib/partie/cycle";
import { exigerUnePartieOuverte } from "@/lib/partie/fin";
import {
  estParticipant,
  PAS_DE_LA_PARTIE,
  type RefusDArrivee,
  retraitSchema,
} from "@/lib/partie/salle-attente";

/**
 * Le **départ** d'un participant : Paul rentre chez lui à la manche 4 sur 10.
 *
 * À ne pas confondre avec le retrait de la salle d'attente, qui vit dans
 * `salle-attente.ts` et s'arrête au gel. Ce sont deux gestes et non un seul :
 * là-bas on **corrige la liste** d'une partie qui n'a pas commencé, et rien
 * n'existe encore à protéger ; ici quelqu'un **s'en va d'une partie en cours**,
 * et ses valeurs déjà saisies restent — le journal les a vues, l'histoire est
 * vraie et ne se réécrit pas.
 *
 * Avec la **réclamation**, c'est la seule chose que le gel laisse passer sur la
 * liste : les deux ne font qu'enlever ou reprendre une place existante, jamais
 * en ajouter une.
 */

/**
 * Un refus **écrit pour être lu**, au-dessus de la page de partie.
 *
 * Une classe à part de {@link RefusDArrivee}, alors que la phrase est la même :
 * ce refus-ci ne parle ni d'arriver ni d'une liste fermée, et un écran qui
 * voudrait un jour distinguer « tu regardes cette partie » de « la partie a
 * commencé » n'aurait plus de quoi le faire si les deux gestes partageaient
 * leur type d'erreur.
 */
export class RefusDeDepart extends Error {
  override readonly name = "RefusDeDepart";
}

/**
 * Exige que l'appareil qui agit soit celui d'un participant **vivant**.
 *
 * C'est la ligne que le code seul ne franchit pas : le code donne la lecture,
 * l'écriture demande d'être de la tablée. Ce n'est **pas de l'autorisation** —
 * le lien appareil vers joueur est une déclaration, jamais une preuve — c'est
 * une appartenance, et une appartenance se lit en base. Ce qu'on arrête ici est
 * le passant qui vide la table des autres, pas une fraude.
 *
 * **N'importe quel participant fait sortir n'importe lequel**, y compris celui
 * qui n'a pas de téléphone pour partir lui-même : il n'y a pas de rôle de
 * créateur dans ce design, et en inventer un ici en créerait un pour une seule
 * fonctionnalité.
 *
 * Celui qui **est déjà parti** n'en est plus un : son téléphone retrouve la
 * lecture seule du spectateur, ce qui est exactement ce que son départ voulait
 * dire.
 *
 * Rend le joueur agissant, que la ligne de journal **fige** : le relire plus
 * tard depuis l'appareil réécrirait l'histoire de ce téléphone à chaque fois
 * qu'il se repointe.
 *
 * @throws {@link RefusDeDepart} si l'appareil n'est pas celui d'un participant.
 */
async function exigerUneMainDeLaPartie(
  tx: Ecriture,
  partieId: number,
  idAppareil: string,
): Promise<number> {
  const joueurId = await lireLeJoueurDeLAppareil(tx, idAppareil);

  if (joueurId === null || !(await estParticipant(tx, partieId, joueurId))) {
    throw new RefusDeDepart(PAS_DE_LA_PARTIE);
  }

  return joueurId;
}

/**
 * Fait sortir un participant d'une partie en cours.
 *
 * Le participant **garde sa ligne**, marquée d'un `retire_le`, et ses valeurs
 * déjà saisies restent en base : ce qu'il a marqué avant de partir continue de
 * compter dans son total. Ce qu'il cesse d'être, c'est un **attendu** — la
 * complétude des manches ouvertes après lui ne le réclame plus, et le
 * classement ne le range plus. Voir `src/lib/jeux/moteur.ts`, qui lit
 * l'effectif courant comme l'intersection des attendus de ses manches.
 *
 * **Le geste se consigne dès que le journal est non vide**, ce qui est la règle
 * de la spec et non une condition propre au départ : avant la première case
 * saisie, bouger la liste *est* la salle d'attente et n'a aucune conséquence à
 * tracer. La condition se lit dans le journal lui-même plutôt que dans un état
 * « a déjà eu une manche », que la suppression de la manche 1 viendrait
 * contredire. Voir `docs/specs/2026-09-09-journal.md`.
 *
 * **Retirer quelqu'un qui n'est déjà plus là ne fait rien**, ligne de journal
 * comprise : la liste est celle qu'on voulait, et une seconde ligne raconterait
 * deux départs pour un seul. C'est le zéro ligne touchée qui le dit, et non une
 * relecture préalable — deux téléphones qui appuient ensemble ont tous les deux
 * vu Paul à table.
 *
 * Une partie **scellée** refuse le départ comme elle refuse tout le reste, et
 * par le même garde-fou : le scellement est une seule règle, pas une condition
 * recopiée par geste. Il n'y a donc rien à faire pour quelqu'un qui s'aperçoit
 * le lendemain que Paul était déjà parti — c'est le prix assumé de l'estampille
 * de fin.
 *
 * @throws {@link PartieScellee} si la partie porte une fin.
 * @throws {@link RefusDeDepart} si l'appareil n'est pas celui d'un participant.
 */
export async function retirerDeLaPartie(
  base: Base,
  partieId: number,
  brut: unknown,
): Promise<void> {
  const donnees = retraitSchema.parse(brut);
  const maintenant = new Date();

  await base.transaction(async (tx) => {
    const agissantId = await exigerUneMainDeLaPartie(tx, partieId, donnees.idAppareil);

    await exigerUnePartieOuverte(tx, partieId);

    const parties = await tx
      .update(participant)
      .set({ retireLe: maintenant })
      .where(
        and(
          eq(participant.partieId, partieId),
          eq(participant.joueurId, donnees.joueurId),
          isNull(participant.retireLe),
        ),
      )
      .returning({ id: participant.id });

    // Personne n'a bougé : il était déjà parti, la liste est celle qu'on
    // voulait, et une seconde ligne raconterait deux départs pour un seul.
    if (parties.length === 0) {
      return;
    }

    if (await journalEstVide(tx, partieId)) {
      return;
    }

    await consignerUnMouvementDeParticipant(tx, {
      partieId,
      geste: "participantRetire",
      joueurConcerneId: donnees.joueurId,
      agissant: { joueurId: agissantId, appareilId: donnees.idAppareil },
    });
  });
}
