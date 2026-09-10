import { describe, expect, it } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { CatalogueListe } from "@/components/catalogue-liste";
import { Identification } from "@/components/identification";
import { PartieEntete } from "@/components/partie-entete";
import { TableeFormulaire } from "@/components/tablee-formulaire";
import { CATALOGUE, trouverEntree } from "@/lib/jeux/catalogue";
import { resoudreRegles } from "@/lib/jeux/resolution";
import type { JoueurConnu } from "@/lib/roster/noms";

const ENTREES = Object.values(CATALOGUE);
const MARIE: JoueurConnu = { id: 1, nom: "Marie" };
const PAUL: JoueurConnu = { id: 2, nom: "Paul" };

describe("l'accueil sans partie en cours", () => {
  it("montre les quatre entrées du catalogue", () => {
    const html = renderToStaticMarkup(<CatalogueListe entrees={ENTREES} />);

    expect(html).toContain("6 qui prend");
    expect(html).toContain("6 qui prend — cartes spéciales");
    expect(html).toContain("Uno");
    expect(html).toContain("Dnup");
  });

  it("les range en liste, une ligne par entrée", () => {
    // Deux 6 qui prend sont indiscernables en tuiles ; une ligne pleine largeur
    // laisse la place d'écrire ce qui les distingue.
    const html = renderToStaticMarkup(<CatalogueListe entrees={ENTREES} />);

    expect(html.match(/<li/g)).toHaveLength(4);
    expect(html).toContain("<ul");
  });

  it("mène chaque entrée à sa création", () => {
    const html = renderToStaticMarkup(<CatalogueListe entrees={ENTREES} />);

    for (const entree of ENTREES) {
      expect(html).toContain(`href="/creer/${entree.id}"`);
    }
  });

  it("distingue les deux entrées d'une même famille par leur fin de partie", () => {
    const html = renderToStaticMarkup(<CatalogueListe entrees={ENTREES} />);

    expect(html).toContain("66 têtes de bœuf");
    expect(html).toContain("2 manches");
  });
});

describe("« qui es-tu ? »", () => {
  it("montre le roster global", () => {
    const html = renderToStaticMarkup(<Identification jeuId="uno" roster={[MARIE, PAUL]} />);

    expect(html).toContain("Marie");
    expect(html).toContain("Paul");
    expect(html).toContain('value="1"');
  });

  it("montre le champ nouveau nom, roster garni", () => {
    const html = renderToStaticMarkup(<Identification jeuId="uno" roster={[MARIE, PAUL]} />);

    expect(html).toContain('name="nom"');
  });

  it("le montre aussi quand le roster est vide — une liste vide est une liste vide", () => {
    const html = renderToStaticMarkup(<Identification jeuId="uno" roster={[]} />);

    expect(html).toContain('name="nom"');
  });

  it("pose la question quand le nom tapé existe déjà", () => {
    const html = renderToStaticMarkup(
      <Identification jeuId="uno" roster={[MARIE, PAUL]} nomPropose="Marie" homonymes={[MARIE]} />,
    );

    expect(html).toContain("Marie existe déjà");
    expect(html).toContain("C’est elle");
    expect(html).toContain("une autre Marie");
  });

  it("réclame un nom distinctif plutôt que de suffixer toute seule", () => {
    const html = renderToStaticMarkup(
      <Identification jeuId="uno" roster={[MARIE]} nomPropose="Marie" homonymes={[MARIE]} />,
    );

    expect(html).not.toContain("Marie (2)");
    expect(html).toContain('name="nom"');
  });
});

describe("la tablée", () => {
  const uno = trouverEntree("uno");
  const dnup = trouverEntree("dnup");

  it("pré-remplit le seuil à la valeur imprimée", () => {
    const html = renderToStaticMarkup(
      <TableeFormulaire action="/creer" entree={uno} identite={{ mode: "roster", joueurId: 1 }} />,
    );

    expect(html).toContain('name="finValeur"');
    expect(html).toContain('value="500"');
  });

  it("suit la variation par effectif : Dnup s'ouvre à deux en manches gagnées", () => {
    const html = renderToStaticMarkup(
      <TableeFormulaire action="/creer" entree={dnup} identite={{ mode: "roster", joueurId: 1 }} />,
    );

    expect(html).toContain("manches gagnées");
  });

  it("borne le nombre de joueurs à ce que le jeu accepte", () => {
    const html = renderToStaticMarkup(
      <TableeFormulaire action="/creer" entree={dnup} identite={{ mode: "roster", joueurId: 1 }} />,
    );

    expect(html).toContain('min="2"');
    expect(html).toContain('max="5"');
  });

  it("reprend ce qui avait été tapé quand un refus renvoie ici", () => {
    // Un refus coûte une correction, jamais une ressaisie : sans ça, corriger
    // « 12 joueurs » effacerait aussi le « on s’arrête à 30 » d'à côté.
    const html = renderToStaticMarkup(
      <TableeFormulaire
        action="/creer"
        entree={uno}
        identite={{ mode: "roster", joueurId: 1 }}
        reprise={{ nombreDeJoueurs: "6", finValeur: "30" }}
      />,
    );

    expect(html).toContain('value="6"');
    expect(html).toContain('value="30"');
  });

  it("ne vide jamais le seuil, même sur un effectif hors bornes", () => {
    // Un champ `required` vidé ferait porter le refus par le navigateur, sans
    // un mot sur la raison — et la vraie phrase du serveur n'arriverait jamais.
    const html = renderToStaticMarkup(
      <TableeFormulaire
        action="/creer"
        entree={dnup}
        identite={{ mode: "roster", joueurId: 1 }}
        reprise={{ nombreDeJoueurs: "9" }}
      />,
    );

    expect(html).not.toContain('name="finValeur" value=""');
    expect(html).toContain("Dnup se joue de 2 à 5 joueurs");
  });

  it("emporte l'identité choisie sans l'avoir encore écrite", () => {
    const html = renderToStaticMarkup(
      <TableeFormulaire
        action="/creer"
        entree={uno}
        identite={{ mode: "nouveau", nom: "Marie B." }}
      />,
    );

    expect(html).toContain('value="nouveau"');
    expect(html).toContain('value="Marie B."');
  });
});

describe("la page de partie", () => {
  const uno = trouverEntree("uno");
  const vue = {
    id: 1,
    code: "A1B2C3",
    jeu: uno,
    regles: resoudreRegles(uno, { nombreDeJoueurs: 3 }),
    participants: [MARIE, PAUL],
  };

  it("affiche le code, qui est ce qu'on dicte à la table", () => {
    expect(renderToStaticMarkup(<PartieEntete partie={vue} />)).toContain("A1B2C3");
  });

  it("l'affiche à tout participant, le créateur n'ayant aucun statut ici", () => {
    // Ce n'est pas toujours le créateur qui a son téléphone en main quand
    // quelqu'un arrive : la page ne sait pas qui regarde, et c'est voulu.
    const vueSansCreatrice = { ...vue, participants: [PAUL] };

    expect(renderToStaticMarkup(<PartieEntete partie={vueSansCreatrice} />)).toContain("A1B2C3");
  });

  it("dit le jeu et la fin sous lesquels la partie a été ouverte", () => {
    const html = renderToStaticMarkup(<PartieEntete partie={vue} />);

    expect(html).toContain("Uno");
    expect(html).toContain("500 points");
  });

  it("nomme les participants", () => {
    const html = renderToStaticMarkup(<PartieEntete partie={vue} />);

    expect(html).toContain("Marie");
    expect(html).toContain("Paul");
  });
});
