import type { ReactElement } from "react";
import type { Action } from "@/components/champs";
import type { DepartDePasseAvant } from "@/lib/manche/passe-avant";

/** Ce que l'écran de désignation demande : la question, et qui l'on peut nommer. */
export type DesignationADemander = Extract<DepartDePasseAvant, { ecran: "designation" }>;

/** Une touche de nom : haute, pleine largeur, tapée sans regarder, comme le pavé. */
const TOUCHE =
  "h-16 w-full rounded-lg border border-border bg-background px-4 text-left text-xl outline-none active:bg-muted focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

/**
 * L'écran qui **nomme un joueur** : « qui est sorti ? », « deuxième sorti ? ».
 *
 * L'autre espèce de geste, et la seule que les deux autres jeux demandent. Une
 * désignation est une information **publique** — toute la table l'a vue — qu'une
 * seule personne pose : l'écran est donc le même sur les cinq téléphones, et la
 * passe avant ne s'y distribue pas.
 *
 * Une touche par nom, et rien à taper. Un menu déroulant ou une liste à cocher
 * demanderait deux gestes là où le domaine n'en a qu'un, sur un écran qu'on
 * traverse debout ; la touche pleine largeur est le pavé sous une autre forme.
 *
 * Chaque nom porte **son propre formulaire** : les envois diffèrent par la case
 * qu'ils visent, et un formulaire unique devrait porter un état de sélection que
 * l'écran n'a aucune raison de tenir.
 *
 * `valeurMontree` part vide avec chaque envoi, et c'est exact : on ne désigne
 * que des joueurs dont la case est vide — ceux qui tiennent déjà un rang ne sont
 * pas proposés. C'est ce qui laisse la condition d'écriture arrêter deux
 * téléphones qui désigneraient en même temps.
 */
export function Designation({
  action,
  mancheId,
  mancheNumero,
  designation,
  recapitulatif,
  enCours = false,
}: {
  action: Action;
  mancheId: number;
  mancheNumero: number;
  designation: DesignationADemander;
  /** L'adresse où la passe avant se termine — un écran, pas cinq. */
  recapitulatif: string;
  /**
   * Vrai pendant qu'une désignation est en vol.
   *
   * Les touches se ferment alors, pour la raison qui ferme le pavé : nommer
   * quelqu'un d'autre par dessus poserait la seconde désignation sur une
   * condition qui n'est déjà plus celle qu'on avait vue.
   */
  enCours?: boolean;
}): ReactElement {
  return (
    <section className="flex flex-1 flex-col gap-8">
      <div className="flex flex-col gap-1">
        <p className="text-muted-foreground text-sm">Manche {mancheNumero}</p>
        <h1 className="font-semibold text-3xl tracking-tight">{designation.question}</h1>
      </div>

      <div className="flex flex-col gap-2">
        {designation.candidats.map((joueur) => (
          <form key={joueur.id} action={action} method="post">
            <input type="hidden" name="mancheId" value={mancheId} />
            <input type="hidden" name="joueurConcerneId" value={joueur.id} />
            <input type="hidden" name="valeurMontree" value="" />
            <input type="hidden" name="valeur" value={designation.valeur} />
            <button type="submit" className={TOUCHE} disabled={enCours}>
              {joueur.nom}
            </button>
          </form>
        ))}
      </div>

      <div className="mt-auto">
        <a
          href={recapitulatif}
          className="block text-center text-muted-foreground text-sm underline"
        >
          Voir le récapitulatif
        </a>
      </div>
    </section>
  );
}
