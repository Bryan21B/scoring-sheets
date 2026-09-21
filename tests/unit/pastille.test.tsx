import { describe, expect, it } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import {
  COULEURS_DE_JOUEUR,
  couleurDeJoueur,
  Pastille,
  placesDeLaTablee,
} from "@/components/pastille";

describe("couleurDeJoueur", () => {
  it("donne une couleur différente à chacun des six premiers", () => {
    const six = [0, 1, 2, 3, 4, 5].map(couleurDeJoueur);

    expect(new Set(six).size).toBe(6);
  });

  it("recycle au septième — six pastilles, puis on recommence", () => {
    expect(couleurDeJoueur(6)).toBe(couleurDeJoueur(0));
    expect(couleurDeJoueur(7)).toBe(couleurDeJoueur(1));
    expect(couleurDeJoueur(13)).toBe(couleurDeJoueur(1));
  });

  it("rend une variable CSS, jamais une valeur en dur", () => {
    for (const couleur of COULEURS_DE_JOUEUR) {
      expect(couleur).toMatch(/^var\(--joueur-[1-6]\)$/);
    }
  });

  /**
   * Un index négatif ou fractionnaire ne peut pas sortir d'un `map`, mais peut
   * sortir d'un calcul de position — et un `undefined` en couleur ferait une
   * pastille transparente qu'aucun type ne signale.
   */
  it("rend toujours une couleur, même sur un index aberrant", () => {
    expect(couleurDeJoueur(-1)).toMatch(/^var\(--joueur-[1-6]\)$/);
    expect(couleurDeJoueur(1.5)).toMatch(/^var\(--joueur-[1-6]\)$/);
  });
});

describe("Pastille", () => {
  it("porte l'initiale du nom, pour qui ne distingue pas les teintes", () => {
    const html = renderToStaticMarkup(<Pastille nom="Marie" index={0} />);

    expect(html).toContain("M");
  });

  it("met l'initiale en capitale", () => {
    const html = renderToStaticMarkup(<Pastille nom="zoé" index={2} />);

    expect(html).toContain(">Z<");
  });

  it("ne lit pas l'initiale deux fois : elle est décorative à côté du nom", () => {
    const html = renderToStaticMarkup(<Pastille nom="Paul" index={1} />);

    expect(html).toContain('aria-hidden="true"');
  });

  /** Un nom vide ne doit pas produire une pastille sans rien dedans. */
  it("retombe sur un tiret quand le nom est vide", () => {
    const html = renderToStaticMarkup(<Pastille nom="" index={0} />);

    expect(html).toContain("—");
  });

  it("colore la pastille par l'index du joueur", () => {
    const html = renderToStaticMarkup(<Pastille nom="Léa" index={3} />);

    expect(html).toContain(couleurDeJoueur(3));
  });
});

describe("placesDeLaTablee", () => {
  const Tablee = [
    { id: 7, nom: "Marie" },
    { id: 3, nom: "Paul" },
    { id: 9, nom: "Zoé" },
  ];

  it("donne à chacun sa place dans l'ordre de la tablée", () => {
    const places = placesDeLaTablee(Tablee);

    expect(places.get(7)).toBe(0);
    expect(places.get(3)).toBe(1);
    expect(places.get(9)).toBe(2);
  });

  /**
   * C'est toute la raison d'être de la fonction : le classement range par rang,
   * la grille par tablée, et les deux doivent colorer Paul pareil.
   */
  it("ne dépend pas de l'ordre dans lequel on relit les joueurs", () => {
    const places = placesDeLaTablee(Tablee);
    const parLeRang = [...Tablee].reverse();

    expect(parLeRang.map(({ id }) => places.get(id))).toEqual([2, 1, 0]);
  });

  it("garde la première place d'un joueur qui reviendrait deux fois", () => {
    const places = placesDeLaTablee([...Tablee, { id: 7, nom: "Marie" }]);

    expect(places.get(7)).toBe(0);
  });

  it("ne connaît pas un joueur qui n'est pas de la tablée", () => {
    expect(placesDeLaTablee(Tablee).get(42)).toBeUndefined();
  });
});
