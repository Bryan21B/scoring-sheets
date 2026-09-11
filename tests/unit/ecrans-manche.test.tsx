import { describe, expect, it } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { VueDeCloture } from "@/components/cloture-de-manche";
import { Designation } from "@/components/designation";
import { EcranDeRefus } from "@/components/ecran-de-refus";
import { PasseAvant } from "@/components/passe-avant";
import { Recapitulatif } from "@/components/recapitulatif";
import { type CadreDeSaisie, VueDeSaisie } from "@/components/saisie-de-case";
import { trouverEntree } from "@/lib/jeux/catalogue";
import type { Regles } from "@/lib/jeux/regles";
import { resoudreRegles } from "@/lib/jeux/resolution";
import type { EtatDeCloture } from "@/lib/manche/annonce";
import type { CaseDeManche, VueDeManche } from "@/lib/manche/lecture";
import type { DepartDePasseAvant } from "@/lib/manche/passe-avant";
import { departDeLaPasseAvant } from "@/lib/manche/passe-avant";
import type { RefusDEcriture } from "@/lib/manche/refus";
import {
  caseDe,
  casesDeLaTablee,
  casesDesignees,
  LEA,
  MARIE,
  PAUL,
  TABLEE,
} from "./helpers/tablee";

const SIX_QUI_PREND = trouverEntree("6-qui-prend");
const ADRESSE = "/p/ABC123/manche/1";
const RECAPITULATIF = `${ADRESSE}/recapitulatif`;
const JOURNAL = "/p/ABC123?journal=corrections";
const PARTIE = "/p/ABC123";

const REGLES = resoudreRegles(SIX_QUI_PREND, { nombreDeJoueurs: 3 });
const UNO = resoudreRegles(trouverEntree("uno"), { nombreDeJoueurs: 3 });
const DNUP = resoudreRegles(trouverEntree("dnup"), { nombreDeJoueurs: 3 });

/** Une borne quelconque : le pavé la reçoit en prop, sa valeur n'apprend rien ici. */
const BORNE = 200;

function passeAvant(caseASaisir: CaseDeManche, enCours = false): string {
  return renderToStaticMarkup(
    <PasseAvant
      action="/p/ABC123/manche/1"
      mancheId={7}
      mancheNumero={1}
      caseASaisir={caseASaisir}
      max={BORNE}
      unite={SIX_QUI_PREND.unite}
      recapitulatif={RECAPITULATIF}
      enCours={enCours}
    />,
  );
}

/** Le départ que la passe avant rendrait pour cette case : un pavé, et sa borne. */
function surLaCase(caseASaisir: CaseDeManche): DepartDePasseAvant {
  return { ecran: "valeur", caseASaisir, max: BORNE };
}

/** Le départ de la manche telle qu'elle se présente, pour l'appareil de Marie. */
function departPour(regles: Regles, cases: readonly CaseDeManche[]): DepartDePasseAvant {
  const depart = departDeLaPasseAvant(regles, cases, MARIE.id);

  if (depart === undefined) {
    throw new Error("La manche de test n'attend plus rien : il n'y a pas d'écran à rendre.");
  }

  return depart;
}

/** Le cadre d'une saisie, dans la manche 1. */
function cadre(depart: DepartDePasseAvant, regles = REGLES): CadreDeSaisie {
  return {
    mancheId: 7,
    mancheNumero: 1,
    depart,
    regles,
    unite: SIX_QUI_PREND.unite,
    recapitulatif: RECAPITULATIF,
    journal: JOURNAL,
  };
}

/** L'écran de désignation, rendu pour ce que la manche attend. */
function designation(regles: Regles, cases: readonly CaseDeManche[], enCours = false): string {
  const depart = departPour(regles, cases);

  if (depart.ecran !== "designation") {
    throw new Error("Cette manche n'attend pas de désignation.");
  }

  return renderToStaticMarkup(
    <Designation
      action={ADRESSE}
      mancheId={7}
      mancheNumero={1}
      designation={depart}
      recapitulatif={RECAPITULATIF}
      enCours={enCours}
    />,
  );
}

function ecranDeRefus(refus: RefusDEcriture, enCours = false, regles = REGLES): string {
  return renderToStaticMarkup(
    <EcranDeRefus
      action={ADRESSE}
      mancheId={7}
      refus={refus}
      regles={regles}
      unite={SIX_QUI_PREND.unite}
      journal={JOURNAL}
      recapitulatif={RECAPITULATIF}
      enCours={enCours}
    />,
  );
}

function vueDeSaisie(refus: RefusDEcriture | null, depart = surLaCase(caseDe(PAUL, 8))): string {
  return renderToStaticMarkup(
    <VueDeSaisie action={ADRESSE} cadre={cadre(depart)} refus={refus} enCours={false} />,
  );
}

function manche(...valeurs: readonly (number | null)[]): VueDeManche {
  return { id: 7, numero: 1, cases: casesDeLaTablee(...valeurs) };
}

function recapitulatif(
  vue: VueDeManche,
  totaux: ReadonlyMap<number, number>,
  regles = REGLES,
): string {
  return renderToStaticMarkup(
    <Recapitulatif
      manche={vue}
      totaux={totaux}
      regles={regles}
      unite={SIX_QUI_PREND.unite}
      adresseDeLaManche={ADRESSE}
    />,
  );
}

describe("la passe avant", () => {
  it("nomme le joueur dont c'est la case", () => {
    expect(passeAvant(caseDe(PAUL, null))).toContain("Paul");
  });

  it("dit de quelle manche il s'agit", () => {
    expect(passeAvant(caseDe(PAUL, null))).toContain("Manche 1");
  });

  it("envoie la valeur montrée avec l'écriture : c'est elle qui la conditionne", () => {
    const html = passeAvant(caseDe(PAUL, 15));

    expect(html).toContain('name="valeurMontree"');
    expect(html).toContain('value="15"');
  });

  it("envoie une valeur montrée vide quand la case l'est", () => {
    const html = passeAvant(caseDe(PAUL, null));

    expect(html).toContain('name="valeurMontree"');
    expect(html).toContain('value=""');
  });

  it("dit quelle case elle écrit, et dans quelle manche", () => {
    const html = passeAvant(caseDe(PAUL, null));

    expect(html).toContain('name="joueurConcerneId"');
    expect(html).toContain('name="mancheId"');
  });

  it("mène au récapitulatif : un écran, pas cinq", () => {
    expect(passeAvant(caseDe(PAUL, null))).toContain(`href="${RECAPITULATIF}"`);
  });
});

describe("le pavé de la passe avant", () => {
  it("est maison : dix touches, et pas un champ que le clavier système remplirait", () => {
    const html = passeAvant(caseDe(PAUL, null));

    for (const chiffre of [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]) {
      expect(html).toContain(`>${chiffre}</button>`);
    }
    expect(html).not.toContain('type="number"');
    expect(html).not.toContain('type="text"');
  });

  it("est toujours ouvert : rien à déplier pour taper", () => {
    const html = passeAvant(caseDe(PAUL, null));

    expect(html).not.toContain("<dialog");
    expect(html).not.toContain("<details");
  });
});

describe("ce que la passe avant ne montre pas", () => {
  it("n'affiche aucun total", () => {
    const html = passeAvant(caseDe(PAUL, 15)).toLowerCase();

    expect(html).not.toContain("total");
  });

  it("n'affiche aucune alerte de seuil", () => {
    const html = passeAvant(caseDe(PAUL, 15)).toLowerCase();

    expect(html).not.toContain("seuil");
    expect(html).not.toContain("s’arrête à");
  });

  it("ne poll pas : rien à rafraîchir, donc rien qui se rafraîchisse", async () => {
    // Le garde-fou est mécanique plutôt qu'en prose : c'est ce qui dissout la
    // question « ma valeur est-elle remplacée pendant que je tape ».
    const source = await Bun.file(
      new URL("../../src/components/passe-avant.tsx", import.meta.url),
    ).text();
    // Ce sont les lignes de code qu'on épingle, pas le vocabulaire : une JSDoc
    // qui dit « pas de `useEffect` ici » n'est pas un `useEffect`.
    const code = source
      .split("\n")
      .filter((ligne) => !/^\s*(\/\/|\/\*|\*)/.test(ligne))
      .join("\n");

    expect(code).not.toContain("setInterval");
    expect(code).not.toContain("useEffect");
    expect(code).not.toContain("refresh");
  });
});

describe("le récapitulatif", () => {
  const totaux = new Map([
    [MARIE.id, 8],
    [PAUL.id, 23],
    [LEA.id, 0],
  ]);

  it("montre les totaux du moteur", () => {
    const html = recapitulatif(manche(8, 15, null), totaux);

    expect(html).toContain("23");
  });

  it("nomme les cases encore vides par le joueur qu'elles concernent", () => {
    const html = recapitulatif(manche(8, 15, null), totaux);

    expect(html).toContain("Léa");
    expect(html).toContain("à saisir");
  });

  it("ne dit pas « à saisir » d'une case remplie à zéro", () => {
    const html = recapitulatif(manche(0, 15, 3), totaux);

    expect(html).not.toContain("à saisir");
  });

  it("laisse retaper n'importe quelle ligne, remplie comprise", () => {
    const html = recapitulatif(manche(8, 15, null), totaux);

    for (const joueur of TABLEE) {
      expect(html).toContain(`href="${ADRESSE}?joueur=${joueur.id}"`);
    }
  });

  it("dit de quelle manche il récapitule", () => {
    expect(recapitulatif(manche(8, 15, null), totaux)).toContain("Manche 1");
  });

  // Les totaux vivants montrent le seuil arriver, et c'est ce qui rend la
  // correction possible tant qu'elle vaut encore. L'alerte, elle, ne sort que
  // de la clôture : ici elle s'allumerait puis s'éteindrait à chaque correction.
  it("n'annonce aucune fin de partie, seuil franchi ou non", () => {
    const franchi = new Map([
      [MARIE.id, 70],
      [PAUL.id, 23],
      [LEA.id, 0],
    ]);
    const html = recapitulatif(manche(8, 15, 3), franchi).toLowerCase();

    expect(html).not.toContain("terminée");
    expect(html).not.toContain("seuil");
  });
});

describe("l'affichage optimiste de la saisie", () => {
  // « L'affichage optimiste lui a déjà montré son 12 » : l'écran affirme la
  // valeur pendant que l'écriture est en vol, il n'attend pas le serveur pour
  // la porter. Ce test épingle la règle de rendu, pas le temps du navigateur.
  it("donne la valeur pour enregistrée pendant que l'écriture est en vol", () => {
    const html = passeAvant(caseDe(PAUL, 12), true);

    expect(html).toContain("12");
    expect(html).toContain("Enregistré");
  });

  it("n'affirme rien tant que rien n'est parti", () => {
    expect(passeAvant(caseDe(PAUL, 12))).not.toContain("Enregistré");
  });

  it("ne laisse pas retaper par dessus une écriture en vol", () => {
    // L'attribut rendu, et non la sous-chaîne « disabled » : les classes
    // Tailwind du bouton la portent déjà, et l'assertion passerait toujours.
    expect(passeAvant(caseDe(PAUL, 12), true)).toContain('disabled=""');
    expect(passeAvant(caseDe(PAUL, 12))).not.toContain('disabled=""');
  });
});

describe("l'écran de refus", () => {
  const Refus: RefusDEcriture = { joueur: PAUL, valeurArrivee: 8, valeurTapee: 12 };

  it("montre la valeur qui est arrivée : c'est elle qui rend le recul lisible", () => {
    expect(ecranDeRefus(Refus)).toContain("8");
  });

  // Nommer Léa demanderait au chemin d'écriture d'aller lire le journal pour
  // composer sa phrase. Le journal est une trace qu'on consulte, jamais une
  // pièce du flux — il est à un appui de là pour qui veut savoir qui.
  it("ne nomme pas l'auteur, et dit où le trouver", () => {
    const html = ecranDeRefus(Refus);

    expect(html).not.toContain("Marie");
    expect(html).not.toContain("Léa");
    expect(html).toContain(`href="${JOURNAL}"`);
  });

  it("nomme la case dont il parle, qui est celle qu'on saisissait", () => {
    expect(ecranDeRefus(Refus)).toContain("Paul");
  });

  it("garde la valeur tapée sous la main", () => {
    expect(ecranDeRefus(Refus)).toContain("12");
  });

  it("repose la valeur tapée par dessus la valeur arrivée, en un seul appui", () => {
    const html = ecranDeRefus(Refus);

    expect(html).toContain('name="valeurMontree" value="8"');
    expect(html).toContain('name="valeur" value="12"');
    expect(html.match(/type="submit"/g)).toHaveLength(1);
  });

  it("dit qu'une case est redevenue vide plutôt que de montrer un blanc", () => {
    const html = ecranDeRefus({ joueur: PAUL, valeurArrivee: null, valeurTapee: 12 });

    expect(html).toContain("vide");
    expect(html).toContain('name="valeurMontree" value=""');
  });

  it("laisse en rester là sans réappliquer", () => {
    expect(ecranDeRefus(Refus)).toContain(`href="${RECAPITULATIF}"`);
  });

  // Le même garde-fou que le pavé : réappuyer reposerait la valeur sur une
  // condition qui n'est déjà plus celle qu'on vient de lire.
  it("se ferme pendant que la réapplication est en vol", () => {
    expect(ecranDeRefus(Refus, true)).toContain('disabled=""');
    expect(ecranDeRefus(Refus)).not.toContain('disabled=""');
  });
});

describe("un refus arrête le geste", () => {
  it("montre le pavé tant que rien n'est refusé", () => {
    expect(vueDeSaisie(null)).toContain(">7</button>");
  });

  // Un écran, jamais un bandeau : à la trentième manche d'une soirée, un
  // bandeau se rate. Le pavé disparaît, il n'est pas repoussé plus bas.
  it("remplace la saisie par l'écran de refus au lieu de le poser au-dessus", () => {
    const html = vueDeSaisie({ joueur: PAUL, valeurArrivee: 8, valeurTapee: 12 });

    expect(html).not.toContain(">7</button>");
    expect(html).not.toContain("Effacer un chiffre");
    expect(html).toContain("Réappliquer");
  });

  // Le recul de l'affichage optimiste : le 12 laisse la place au 8 arrivé.
  it("fait reculer l'affichage sur la valeur arrivée", () => {
    const html = vueDeSaisie({ joueur: PAUL, valeurArrivee: 8, valeurTapee: 12 });

    expect(html).toContain("8");
    expect(html).not.toContain("Enregistré");
  });
});

function cloture(etat: EtatDeCloture): string {
  return renderToStaticMarkup(
    <VueDeCloture action={RECAPITULATIF} mancheId={7} etat={etat} partie={PARTIE} />,
  );
}

describe("clore la manche", () => {
  // N'importe quel participant clôt : le composant ne reçoit aucune identité de
  // lecteur, il n'a donc rien à conditionner et rien qui puisse l'être un jour
  // par erreur. C'est le serveur qui vérifie qu'on est bien de la tablée.
  it("offre le geste à qui regarde le récapitulatif", () => {
    const html = cloture(null);

    expect(html).toContain("Clore la manche");
    expect(html).toContain('name="mancheId" value="7"');
  });

  it("montre un refus de clôture, et laisse réessayer une fois la manche réparée", () => {
    const html = cloture({ statut: "refusee", message: "Il manque des valeurs à cette manche." });

    expect(html).toContain("Il manque des valeurs à cette manche.");
    expect(html).toContain("Clore la manche");
  });
});

describe("l'alerte de fin de partie", () => {
  // Clore la manche **est** la confirmation de fin de partie : il n'y a pas de
  // second écran « voulez-vous terminer ».
  it("ne dit rien tant qu'aucune clôture n'a rien terminé", () => {
    expect(cloture(null)).not.toContain("terminée");
  });

  it("annonce la fin que la clôture a estampillée", () => {
    const html = cloture({ statut: "finie", cause: "terminee" });

    expect(html).toContain("terminée");
    expect(html).toContain(`href="${PARTIE}"`);
  });

  it("ne repropose pas de clore une partie qui est finie", () => {
    expect(cloture({ statut: "finie", cause: "terminee" })).not.toContain("Clore la manche");
  });

  it("dit l'abandon comme un abandon, sans le confondre avec une fin régulière", () => {
    expect(cloture({ statut: "finie", cause: "abandonnee" })).toContain("abandonnée");
  });
});

describe("l'écran de désignation", () => {
  const vierges = casesDeLaTablee(null, null, null);

  it("pose la question d'Uno, et ne montre aucun pavé", () => {
    const html = designation(UNO, vierges);

    expect(html).toContain("Qui est sorti ?");
    expect(html).not.toContain(">7</button>");
    expect(html).not.toContain("Effacer un chiffre");
  });

  it("propose la tablée, un nom par touche", () => {
    const html = designation(UNO, vierges);

    for (const joueur of TABLEE) {
      expect(html).toContain(joueur.nom);
      expect(html).toContain(`name="joueurConcerneId" value="${joueur.id}"`);
    }
  });

  it("pose le vide sur la case du sorti à Uno : la ligne est la désignation", () => {
    const html = designation(UNO, vierges);

    expect(html).toContain('name="valeur" value=""');
    expect(html).toContain('name="valeurMontree" value=""');
  });

  it("pose le rang lui-même à Dnup, où les jetons sont un résultat", () => {
    expect(designation(DNUP, vierges)).toContain('name="valeur" value="1"');
  });

  it("demande le deuxième sorti sans reproposer le premier", () => {
    const html = designation(DNUP, casesDeLaTablee(null, 1, null));

    expect(html).toContain("Deuxième sorti ?");
    expect(html).not.toContain(`name="joueurConcerneId" value="${PAUL.id}"`);
    expect(html).toContain(`name="joueurConcerneId" value="${LEA.id}"`);
  });

  it("dit de quelle manche il s'agit, et mène au récapitulatif", () => {
    const html = designation(UNO, vierges);

    expect(html).toContain("Manche 1");
    expect(html).toContain(`href="${RECAPITULATIF}"`);
  });

  it("se ferme pendant qu'une désignation est en vol", () => {
    expect(designation(UNO, vierges, true)).toContain('disabled=""');
    expect(designation(UNO, vierges)).not.toContain('disabled=""');
  });
});

describe("l'écran que la passe avant ouvre, selon le mode", () => {
  it("ouvre le pavé là où la manche attend une valeur", () => {
    const html = vueDeSaisie(null, surLaCase(caseDe(PAUL, null)));

    expect(html).toContain(">7</button>");
    expect(html).not.toContain("Qui est sorti ?");
  });

  it("ouvre la désignation là où la manche attend un nom, et pas le pavé", () => {
    const html = renderToStaticMarkup(
      <VueDeSaisie
        action={ADRESSE}
        cadre={cadre(departPour(UNO, casesDeLaTablee(null, null, null)), UNO)}
        refus={null}
        enCours={false}
      />,
    );

    expect(html).toContain("Qui est sorti ?");
    expect(html).not.toContain(">7</button>");
  });

  it("laisse le refus remplacer la désignation comme il remplace le pavé", () => {
    const html = renderToStaticMarkup(
      <VueDeSaisie
        action={ADRESSE}
        cadre={cadre(departPour(DNUP, casesDeLaTablee(null, null, null)), DNUP)}
        refus={{ joueur: PAUL, valeurArrivee: 1, valeurTapee: 1 }}
        enCours={false}
      />,
    );

    expect(html).not.toContain("Premier sorti ?");
    expect(html).toContain("Réappliquer");
  });
});

describe("l'écran de refus, selon ce que la colonne porte", () => {
  it("dit un rang comme un rang à Dnup, et non comme un nombre de jetons", () => {
    const html = ecranDeRefus({ joueur: PAUL, valeurArrivee: 1, valeurTapee: 2 }, false, DNUP);

    expect(html).toContain("1er");
    expect(html).toContain("Paul");
  });

  it("dit une désignation refusée sans prétendre qu'un nombre a été tapé", () => {
    const html = ecranDeRefus({ joueur: PAUL, valeurArrivee: 24, valeurTapee: null }, false, UNO);

    expect(html).not.toContain("null");
    expect(html).toContain("désignation");
  });
});

describe("le récapitulatif des deux autres modes", () => {
  const totaux = new Map([
    [MARIE.id, 0],
    [PAUL.id, 24],
    [LEA.id, 0],
  ]);

  it("ne dit « à saisir » d'aucun perdant à Uno : rien ne leur est demandé", () => {
    const html = recapitulatif({ id: 7, numero: 1, cases: casesDesignees(PAUL.id) }, totaux, UNO);

    expect(html.match(/à saisir/g)).toHaveLength(1);
    expect(html).toContain("Marie");
  });

  it("nomme la désignation qui manque plutôt qu'une case de perdant", () => {
    const html = recapitulatif(manche(null, null, null), totaux, UNO);

    expect(html).toContain("Sorti");
    expect(html).toContain("à désigner");
    expect(html).not.toContain("à saisir");
  });

  it("nomme les deux rangs de Dnup, dans l'ordre, et n'en fait taper aucun", () => {
    const html = recapitulatif(manche(null, null, null), totaux, DNUP);

    expect(html).toContain("Premier sorti");
    expect(html).toContain("Deuxième sorti");
    expect(html).not.toContain("à saisir");
  });

  it("montre les rangs déjà désignés comme des rangs", () => {
    const html = recapitulatif(manche(2, 1, null), totaux, DNUP);

    expect(html).toContain("1er");
    expect(html).toContain("2e");
  });

  it("ne renvoie au pavé que les lignes qui se tapent vraiment", () => {
    const aucunPave = recapitulatif(manche(2, 1, null), totaux, DNUP);
    const leTotalDuSorti = recapitulatif(manche(null, 24, null), totaux, UNO);

    expect(aucunPave).not.toContain(`${ADRESSE}?joueur=`);
    expect(leTotalDuSorti).toContain(`${ADRESSE}?joueur=${PAUL.id}`);
    expect(leTotalDuSorti).not.toContain(`${ADRESSE}?joueur=${MARIE.id}`);
  });

  it("garde une ligne par ligne à 6 qui prend, où chacun compte devant soi", () => {
    const html = recapitulatif(manche(8, null, null), totaux);

    for (const joueur of TABLEE) {
      expect(html).toContain(`${ADRESSE}?joueur=${joueur.id}`);
    }
  });
});
