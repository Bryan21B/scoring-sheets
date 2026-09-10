import { describe, expect, it } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { CodeInconnu, TropDeTentatives } from "@/components/code-inconnu";
import { RejoindreParCode } from "@/components/rejoindre-par-code";
import { SalleDAttente } from "@/components/salle-attente";
import { trouverEntree } from "@/lib/jeux/catalogue";
import { resoudreRegles } from "@/lib/jeux/resolution";
import type { VueDePartie } from "@/lib/partie/lecture";
import type { Arrivee } from "@/lib/partie/salle-attente";
import type { JoueurConnu } from "@/lib/roster/noms";

const UNO = trouverEntree("uno");
const MARIE: JoueurConnu = { id: 1, nom: "Marie" };
const ZOE: JoueurConnu = { id: 3, nom: "Zoé" };

/** Une partie d'Uno où Marie est seule, telle que la page la reçoit. */
const PARTIE: VueDePartie = {
  id: 1,
  code: "A1B2C3",
  jeu: UNO,
  regles: resoudreRegles(UNO, { nombreDeJoueurs: 3 }),
  participants: [MARIE],
};

/** L'écran, sous un état d'arrivée et un gel donnés. */
function rendre(arrivee: Arrivee, gelee = false): string {
  return renderToStaticMarkup(
    <SalleDAttente
      partie={PARTIE}
      salle={{ gelee, arrivee }}
      roster={[MARIE, ZOE]}
      rejoindre="/p/rejoindre"
      ajouter="/p/ajouter"
      retirer="/p/retirer"
    />,
  );
}

describe("la salle d'attente, quand l'appareil est déjà lié", () => {
  const proposeZoe: Arrivee = { statut: "propose", joueur: ZOE };

  it("propose de rejoindre sous le nom qu'elle connaît", () => {
    expect(rendre(proposeZoe)).toContain("Rejoindre en tant que Zoé");
  });

  it("pré-sélectionne ce nom, et n'inscrit personne pour autant", () => {
    // Le bouton est armé — un geste pour entrer — mais tout passe par un
    // formulaire : rien n'est écrit tant qu'on n'appuie pas.
    const html = rendre(proposeZoe);

    expect(html).toContain('name="joueurId"');
    expect(html).toContain('value="3"');
    expect(html).toContain('action="/p/rejoindre"');
    expect(html).toContain('type="submit"');
  });

  it("ne la compte pas dans la tablée tant qu'elle n'a pas appuyé", () => {
    const html = rendre(proposeZoe);
    const tablee = html.slice(html.indexOf("<ul"), html.indexOf("</ul>"));

    expect(tablee).toContain("Marie");
    expect(tablee).not.toContain("Zoé");
  });

  it("laisse changer de nom sans quitter l'écran", () => {
    const html = rendre(proposeZoe);

    expect(html).toContain("Ce n’est pas Zoé");
    expect(html).toContain('name="nom"');
    expect(html).toContain("Marie");
  });
});

describe("la salle d'attente, quand l'appareil est vierge", () => {
  it("montre les participants à réclamer avant le reste du roster", () => {
    const html = rendre({ statut: "inconnu" });

    expect(html).toContain("Réclamer sa place");
    expect(html.indexOf("Réclamer sa place")).toBeLessThan(html.indexOf("Rejoindre la partie"));
  });

  it("montre le champ nouveau nom à côté de la liste", () => {
    expect(rendre({ statut: "inconnu" })).toContain('name="nom"');
  });
});

describe("la salle d'attente, une fois la partie commencée", () => {
  it("dit au spectateur pourquoi il regarde, plutôt que de rester inerte", () => {
    const html = rendre({ statut: "propose", joueur: ZOE }, true);

    expect(html).toContain("Tu regardes cette partie, tu n’y joues pas.");
    expect(html).not.toContain("Rejoindre en tant que Zoé");
  });

  it("laisse malgré tout réclamer une place déjà là", () => {
    // Paul, ajouté à la création puis arrivé après la manche 1, ne doit pas
    // être spectateur de sa propre partie.
    const html = rendre({ statut: "inconnu" }, true);

    expect(html).toContain("Réclamer sa place");
    expect(html).not.toContain("Rejoindre la partie");
  });

  it("ne propose plus de retirer personne", () => {
    expect(rendre({ statut: "participant", joueur: MARIE }, true)).not.toContain(
      'action="/p/retirer"',
    );
  });
});

describe("la salle d'attente, quand on en est", () => {
  const marieEstLa: Arrivee = { statut: "participant", joueur: MARIE };

  it("laisse s'en aller tant qu'aucune manche n'existe", () => {
    const html = rendre(marieEstLa);

    expect(html).toContain('action="/p/retirer"');
    expect(html).toContain("Je m’en vais");
  });

  it("laisse ajouter quelqu'un qui n'a pas de téléphone", () => {
    const html = rendre(marieEstLa);

    expect(html).toContain('action="/p/ajouter"');
    expect(html).toContain("sans téléphone");
  });

  it("ne repropose pas de rejoindre à qui est déjà dedans", () => {
    expect(rendre(marieEstLa)).not.toContain("Rejoindre en tant que");
  });

  it("emporte le code dans chaque formulaire, puisqu'il désigne la partie", () => {
    expect(rendre(marieEstLa)).toContain('value="A1B2C3"');
  });
});

describe("le champ « j’ai un code »", () => {
  it("mène à la même chaîne que le lien", () => {
    const html = renderToStaticMarkup(<RejoindreParCode />);

    expect(html).toContain('action="/rejoindre"');
    expect(html).toContain('name="code"');
  });
});

describe("ce qu'un code sans partie affiche", () => {
  it("dit que ce code ne mène nulle part, et le dit pour lui seul", () => {
    const html = renderToStaticMarkup(<CodeInconnu />);

    expect(html).toContain("Ce code ne mène à aucune partie");
  });

  it("laisse retaper plutôt que de renvoyer à l'accueil sans un mot", () => {
    expect(renderToStaticMarkup(<CodeInconnu />)).toContain('name="code"');
  });

  it("distingue le code faux du code trop souvent essayé", () => {
    const html = renderToStaticMarkup(<TropDeTentatives />);

    expect(html).toContain("Trop d’essais");
    expect(html).not.toContain("Ce code ne mène à aucune partie");
  });
});

describe("la tablée", () => {
  it("nomme qui est autour de la table", () => {
    const aDeux: VueDePartie = { ...PARTIE, participants: [MARIE, ZOE] };
    const html = renderToStaticMarkup(
      <SalleDAttente
        partie={aDeux}
        salle={{ gelee: false, arrivee: { statut: "participant", joueur: MARIE } }}
        roster={[MARIE, ZOE]}
        rejoindre="/p/rejoindre"
        ajouter="/p/ajouter"
        retirer="/p/retirer"
      />,
    );

    expect(html).toContain("Marie");
    expect(html).toContain("Zoé");
    expect(html).toContain("2 joueurs");
  });
});

describe("ajouter quelqu'un qui n'a pas de téléphone", () => {
  const marieEstLa: Arrivee = { statut: "participant", joueur: MARIE };

  it("propose le roster autant que le champ libre", () => {
    // Le groupe du vendredi soir est déjà au roster : n'offrir que le champ
    // libre y renverrait « Zoé existe déjà » sans nulle part où la choisir.
    const html = rendre(marieEstLa);
    const ajout = html.slice(html.indexOf('action="/p/ajouter"'));

    expect(ajout).toContain('value="3"');
    expect(ajout).toContain("Zoé");
  });

  it("n'y repropose pas ceux qui sont déjà autour de la table", () => {
    const html = rendre(marieEstLa);
    const ajout = html.slice(html.indexOf('action="/p/ajouter"'));
    const liste = ajout.slice(ajout.indexOf("<ul"), ajout.indexOf("</ul>"));

    expect(liste).not.toContain("Marie");
  });

  it("garde le champ libre pour un nom que le roster ne porte pas", () => {
    expect(rendre(marieEstLa)).toContain("sans téléphone");
  });
});
