"use client";

import type { ReactElement } from "react";
import { useState } from "react";
import {
  type Action,
  AFFICHEUR,
  AFFICHEUR_UNITE,
  AFFICHEUR_VALEUR,
  SURTITRE,
  TITRE,
  TOUCHE_DE_CHIFFRE,
  TOUCHE_EFFACER,
} from "@/components/champs";
import { Button } from "@/components/ui/button";
import type { EntreeCatalogue } from "@/lib/jeux/catalogue";
import type { CaseDeManche } from "@/lib/manche/lecture";
import {
  appuyerUnChiffre,
  CHIFFRES,
  effacerUnChiffre,
  enTapee,
  valeurDuPave,
} from "@/lib/manche/pave";

/**
 * La passe avant : **une case, un écran**, pavé maison toujours ouvert.
 *
 * Elle ne montre **aucun total et aucune alerte**, et n'a donc rien à
 * rafraîchir : elle ne poll pas, ce qui dissout la question « ma valeur est-elle
 * remplacée pendant que je tape ». Rien ici ne doit acquérir un `useEffect` ni
 * un rafraîchissement — un test le vérifie sur la source.
 *
 * Le pavé est **maison** et non un `input[type=number]` : le clavier système
 * d'un téléphone couvre la moitié de l'écran, arrive avec sa virgule et son
 * signe moins, et met une manche de retard à s'ouvrir. Dix touches posées là
 * n'ont aucun de ces défauts, et refusent une valeur hors bornes **sèchement** —
 * le chiffre ne prend pas, rien ne s'ouvre, rien n'est perdu.
 *
 * `valeurMontree` part avec l'écriture, et c'est le cœur du contrat : c'est
 * elle, et non la valeur tapée, qui conditionne l'écriture côté serveur.
 *
 * **L'affichage est optimiste** : pendant que l'écriture est en vol, l'écran
 * donne la valeur pour enregistrée au lieu d'attendre le serveur. C'est ce que
 * la politique d'écriture concurrente suppose — « l'affichage optimiste lui a
 * déjà montré son 12 » — et ce que l'écran de refus fait reculer si quelqu'un
 * est passé avant.
 */
export function PasseAvant({
  action,
  mancheId,
  mancheNumero,
  caseASaisir,
  max,
  unite,
  recapitulatif,
  enCours = false,
}: {
  action: Action;
  mancheId: number;
  mancheNumero: number;
  caseASaisir: CaseDeManche;
  /** La borne haute du mode, telle que l'instantané de règles la fige. */
  max: number;
  unite: EntreeCatalogue["unite"];
  /** L'adresse où la passe avant se termine — un écran, pas cinq. */
  recapitulatif: string;
  /**
   * Vrai pendant qu'une écriture est en vol.
   *
   * Le pavé se ferme alors : retaper par dessus une valeur partie poserait la
   * suivante sur une condition qui n'est déjà plus celle qu'on avait vue.
   */
  enCours?: boolean;
}): ReactElement {
  // Amorcée sur la valeur montrée : on arrive ici pour corriger aussi souvent
  // que pour saisir, et repartir d'un champ vide ferait retaper un 15 juste.
  const [tapee, setTapee] = useState(enTapee(caseASaisir.valeur));
  const valeur = valeurDuPave(tapee);

  return (
    <form action={action} method="post" className="flex flex-1 flex-col gap-8">
      <input type="hidden" name="mancheId" value={mancheId} />
      <input type="hidden" name="joueurConcerneId" value={caseASaisir.joueur.id} />
      <input type="hidden" name="valeurMontree" value={enTapee(caseASaisir.valeur)} />
      <input type="hidden" name="valeur" value={tapee} />

      <div className="flex flex-col gap-1">
        <p className={SURTITRE}>Manche {mancheNumero}</p>
        <h1 className={TITRE}>{caseASaisir.joueur.nom}</h1>
      </div>

      <div className={AFFICHEUR}>
        <p className={AFFICHEUR_VALEUR}>{tapee === "" ? "—" : tapee}</p>
        <p className={AFFICHEUR_UNITE}>{enCours ? "Enregistré" : unite.plusieurs}</p>
      </div>

      <div className="grid grid-cols-3 gap-2.5">
        {CHIFFRES.map((chiffre) => (
          <button
            key={chiffre}
            type="button"
            className={TOUCHE_DE_CHIFFRE}
            disabled={enCours}
            onClick={() => setTapee((avant) => appuyerUnChiffre(avant, chiffre, max))}
          >
            {chiffre}
          </button>
        ))}
        <button
          type="button"
          className={TOUCHE_EFFACER}
          aria-label="Effacer un chiffre"
          disabled={enCours}
          onClick={() => setTapee(effacerUnChiffre)}
        >
          ←
        </button>
      </div>

      <div className="mt-auto flex flex-col gap-3">
        <Button type="submit" size="lg" className="w-full" disabled={valeur === null || enCours}>
          Valider
        </Button>
        <a href={recapitulatif} className="text-center text-muted-foreground text-sm underline">
          Voir le récapitulatif
        </a>
      </div>
    </form>
  );
}
