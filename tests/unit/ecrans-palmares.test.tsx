import { describe, expect, it } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { Palmares } from "@/components/palmares";
import { CATALOGUE } from "@/lib/jeux/catalogue";
import { adresseDeFicheDeJoueur } from "@/lib/palmares/adresse";
import { pourcentage } from "@/lib/palmares/mots";
import {
  type JoueurClasse,
  type JoueurHorsClassement,
  PLANCHER_DE_PARTIES,
  type VueDePalmares,
} from "@/lib/palmares/taux";
import { LEA, MARIE, PAUL, ZOE } from "./helpers/tablee";

const ENTREES = Object.values(CATALOGUE);

function classe(options: Partial<JoueurClasse> = {}): JoueurClasse {
  return { joueur: MARIE, rang: 1, taux: 0.78, parties: 12, ...options };
}

function horsClassement(options: Partial<JoueurHorsClassement> = {}): JoueurHorsClassement {
  return { joueur: ZOE, parties: 2, ...options };
}

function rendre(vue: Partial<VueDePalmares> = {}): string {
  return renderToStaticMarkup(
    <Palmares
      vue={{
        classes: vue.classes ?? [classe()],
        horsClassement: vue.horsClassement ?? [],
        plancher: vue.plancher ?? PLANCHER_DE_PARTIES,
      }}
      entrees={ENTREES}
    />,
  );
}

describe("le palmarès", () => {
  it("porte le rang, le nom, le taux et le nombre de parties", () => {
    const html = rendre({ classes: [classe({ joueur: MARIE, rang: 1, taux: 0.78, parties: 12 })] });

    expect(html).toContain(MARIE.nom);
    expect(html).toContain(pourcentage(0.78));
    expect(html).toContain("12 parties");
  });

  it("rend les joueurs dans l'ordre reçu, sans en inventer un second", () => {
    // L'ordre est celui du taux, décidé par `ordonnerLePalmares`. Un tri refait
    // ici le contredirait sans que rien ne proteste.
    const html = rendre({
      classes: [
        classe({ joueur: PAUL, rang: 1, taux: 0.9 }),
        classe({ joueur: MARIE, rang: 2, taux: 0.4 }),
      ],
    });

    expect(html.indexOf(adresseDeFicheDeJoueur(PAUL.id))).toBeLessThan(
      html.indexOf(adresseDeFicheDeJoueur(MARIE.id)),
    );
  });

  it("mène à la fiche de chaque joueur, classé ou non", () => {
    const html = rendre({
      classes: [classe({ joueur: MARIE })],
      horsClassement: [horsClassement({ joueur: ZOE })],
    });

    expect(html).toContain(`href="${adresseDeFicheDeJoueur(MARIE.id)}"`);
    expect(html).toContain(`href="${adresseDeFicheDeJoueur(ZOE.id)}"`);
  });

  it("montre le même rang deux fois quand deux joueurs sont à égalité", () => {
    // L'égalité ne se départage nulle part : le palmarès n'invente pas un
    // premier et un deuxième là où `ordonnerLePalmares` a mis deux premiers.
    const html = rendre({
      classes: [
        classe({ joueur: MARIE, rang: 1, taux: 0.5 }),
        classe({ joueur: PAUL, rang: 1, taux: 0.5 }),
      ],
    });

    expect(html.match(/<span class="sr-only">Rang <\/span>1</g)).toHaveLength(2);
  });
});

describe("les hors classement du palmarès", () => {
  it("les met en bas, après les classés", () => {
    const html = rendre({
      classes: [classe({ joueur: MARIE })],
      horsClassement: [horsClassement({ joueur: ZOE })],
    });

    expect(html.indexOf(MARIE.nom)).toBeLessThan(html.indexOf(ZOE.nom));
  });

  it("dit pourquoi, en nommant le plancher plutôt qu'en le laissant deviner", () => {
    const html = rendre({
      classes: [classe()],
      horsClassement: [horsClassement({ joueur: ZOE, parties: 2 })],
      plancher: 5,
    });

    expect(html).toContain("Hors classement");
    expect(html).toContain("5 parties");
  });

  it("ne porte ni rang ni taux, sur un écran qui en montre par ailleurs", () => {
    // Deux classés et un hors classement : on **compte** les rangs et les
    // pourcentages rendus au lieu de constater leur absence sur une page qui
    // n'en contient de toute façon aucun. Une ligne hors classement qui se
    // mettrait à en afficher ferait passer les deux comptes à trois.
    const html = rendre({
      classes: [classe({ joueur: MARIE, rang: 1 }), classe({ joueur: PAUL, rang: 2 })],
      horsClassement: [horsClassement({ joueur: ZOE, parties: 2 })],
    });

    expect(html).toContain(ZOE.nom);
    expect(html).toContain("2 parties");
    expect(html.match(/<span class="sr-only">Rang <\/span>/g)).toHaveLength(2);
    expect(html.match(/%/g)).toHaveLength(2);
  });

  it("un palmarès entièrement hors classement n'est pas un état vide", () => {
    // Tout le monde est sous le plancher, et c'est honnête : la liste des noms
    // reste, avec ce qui manque à chacun, et rien ne renvoie au catalogue.
    const html = rendre({
      classes: [],
      horsClassement: [
        horsClassement({ joueur: MARIE, parties: 3 }),
        horsClassement({ joueur: PAUL, parties: 1 }),
        horsClassement({ joueur: LEA, parties: 0 }),
      ],
    });

    expect(html).toContain(MARIE.nom);
    expect(html).toContain(PAUL.nom);
    expect(html).toContain(LEA.nom);
    expect(html).not.toContain("On en commence une");
    // Le titre dit l'état plutôt que de coiffer la seule liste de la page d'un
    // « Hors classement », qui laisserait croire à un classement resté en haut.
    expect(html).toContain("Personne n’est encore classé");
    expect(html).not.toContain("Hors classement");
  });

  it("accorde le singulier d'une seule partie", () => {
    expect(rendre({ classes: [], horsClassement: [horsClassement({ parties: 1 })] })).toContain(
      "1 partie",
    );
  });
});

describe("un palmarès sans personne", () => {
  it("renvoie au catalogue, sans inventer d'écran vide", () => {
    // Le roster est vide : il n'y a pas de joueur sous le plancher, il n'y a pas
    // de joueur. C'est ce que l'historique fait déjà quand rien n'est fini.
    const html = rendre({ classes: [], horsClassement: [] });

    expect(html).toContain("On en commence une");
    for (const entree of ENTREES) {
      expect(html).toContain(`href="/creer/${entree.id}"`);
    }
  });

  it("ne propose pas une liste de joueurs qui n'existe pas", () => {
    expect(rendre({ classes: [], horsClassement: [] })).not.toContain('href="/j/');
  });
});
