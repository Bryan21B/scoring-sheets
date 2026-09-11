import type { ReactElement } from "react";
import { LISTE } from "@/components/champs";
import type { EntreeCatalogue } from "@/lib/jeux/catalogue";
import type { JoueurId } from "@/lib/jeux/moteur";
import type { Regles } from "@/lib/jeux/regles";
import { A_SAISIR, designationsManquantes, lignesDuRecapitulatif } from "@/lib/manche/gestes";
import type { VueDeManche } from "@/lib/manche/lecture";

/**
 * Le récapitulatif : la suite de la passe avant.
 *
 * Il porte les **totaux du moteur** — jamais un décompte recalculé ici — ce que
 * la manche attend encore, et la correction. C'est de là qu'on saisit pour un
 * participant sans appareil.
 *
 * **Corriger est le même geste que saisir** : une ligne qui se tape est un lien
 * vers l'écran de saisie de cette case, remplie comprise. Pas de bouton
 * « modifier » à côté d'un bouton « saisir » — ce serait deux gestes là où le
 * domaine n'en a qu'un, et l'écran d'arrivée serait le même.
 *
 * Ce qu'il nomme comme **manquant se dérive du mode**, et de nulle part
 * ailleurs. Une case vide n'est pas un manque en soi : les quatre perdants
 * d'Uno en ont une, et rien ne leur est demandé. Dire « à saisir » de chacun
 * ferait croire la manche réparable là où elle est complète — et, au podium, une
 * case vide ne se tape pas du tout : ce qui manque y est une **désignation**,
 * qui se nomme par son rang.
 */
export function Recapitulatif({
  manche,
  totaux,
  regles,
  unite,
  adresseDeLaManche,
}: {
  manche: VueDeManche;
  /** Les totaux tels que `evaluer` les rend, la manche en cours comprise. */
  totaux: ReadonlyMap<JoueurId, number>;
  /** Les règles figées : c'est d'elles que « ce qui manque » se dérive. */
  regles: Regles;
  unite: EntreeCatalogue["unite"];
  /** L'adresse de la passe avant, où toute ligne se retape. */
  adresseDeLaManche: string;
}): ReactElement {
  const lignes = lignesDuRecapitulatif(regles, manche.cases);
  const aDesigner = designationsManquantes(regles, manche.cases);

  return (
    <section className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="font-semibold text-2xl tracking-tight">Manche {manche.numero}</h1>
        <p className="text-muted-foreground text-sm">
          Touche une ligne pour la retaper : corriger est le même geste que saisir.
        </p>
      </div>

      <ul className={LISTE}>
        {lignes.map(({ joueur, marque, seTape }) => (
          <li key={joueur.id}>
            <Ligne
              nom={joueur.nom}
              marque={marque}
              total={totaux.get(joueur.id) ?? 0}
              adresse={seTape ? `${adresseDeLaManche}?joueur=${joueur.id}` : null}
            />
          </li>
        ))}
      </ul>

      {aDesigner.length === 0 ? null : (
        <ul className={LISTE}>
          {aDesigner.map(({ rang, libelle }) => (
            <li key={rang}>
              <a
                href={adresseDeLaManche}
                className="flex items-baseline justify-between gap-3 px-4 py-3"
              >
                <span className="text-base">{libelle}</span>
                <span className="text-muted-foreground text-sm">à désigner</span>
              </a>
            </li>
          ))}
        </ul>
      )}

      <p className="text-muted-foreground text-sm">{`Totaux en ${unite.plusieurs}.`}</p>
    </section>
  );
}

/**
 * Une ligne de la liste : un joueur, ce que la manche porte pour lui, son total.
 *
 * Le lien n'est posé que sur les lignes qui **se tapent** : un rang de podium
 * n'a pas de pavé où l'emmener, et un perdant d'Uno n'a pas de case à remplir.
 * Rendre un lien mort serait pire qu'aucun lien — on le toucherait.
 */
function Ligne({
  nom,
  marque,
  total,
  adresse,
}: {
  nom: string;
  marque: string | null;
  total: number;
  adresse: string | null;
}): ReactElement {
  const contenu = (
    <>
      <span className="text-base">{nom}</span>
      <span className="flex items-baseline gap-3">
        {marque === null ? null : (
          <span
            className={
              marque === A_SAISIR
                ? "text-muted-foreground text-sm"
                : "font-mono text-xl tabular-nums"
            }
          >
            {marque}
          </span>
        )}
        <span className="text-muted-foreground text-sm tabular-nums">{`total ${total}`}</span>
      </span>
    </>
  );

  const classe = "flex items-baseline justify-between gap-3 px-4 py-3";

  return adresse === null ? (
    <div className={classe}>{contenu}</div>
  ) : (
    <a href={adresse} className={classe}>
      {contenu}
    </a>
  );
}
