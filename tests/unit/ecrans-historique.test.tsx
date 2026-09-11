import { describe, expect, it } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { Historique } from "@/components/historique";
import { CATALOGUE, trouverEntree } from "@/lib/jeux/catalogue";
import type { FiltreDHistorique, LigneDHistorique } from "@/lib/partie/historique";
import { MARIE } from "./helpers/tablee";

const SIX_QUI_PREND = trouverEntree("6-qui-prend");
const ENTREES = Object.values(CATALOGUE);

/** Tout l'historique, sans filtre : ce que `/historique` montre par défaut. */
const TOUT: FiltreDHistorique = { jeuId: null, combien: 20 };

/** La date de fin des lignes de ces tests, fixe pour que l'heure lue le soit. */
const FIN = new Date("2026-09-08T19:45:00.000Z");

/** Une ligne d'historique telle que le lecteur la rend, à un détail près. */
function ligne(options: Partial<LigneDHistorique> = {}): LigneDHistorique {
  return {
    code: "A1B2C3",
    jeu: SIX_QUI_PREND,
    finLe: FIN,
    cause: "terminee",
    vainqueur: MARIE,
    nombreDeJoueurs: 3,
    ...options,
  };
}

function rendre(
  options: {
    lignes?: readonly LigneDHistorique[];
    encore?: boolean;
    filtre?: FiltreDHistorique;
  } = {},
): string {
  return renderToStaticMarkup(
    <Historique
      vue={{ lignes: options.lignes ?? [ligne()], encore: options.encore ?? false }}
      filtre={options.filtre ?? TOUT}
      entrees={ENTREES}
    />,
  );
}

/** Les adresses d'historique que la page propose, dans l'ordre du balisage. */
function liensDHistorique(html: string): string[] {
  return html.match(/href="\/historique[^"]*"/g) ?? [];
}

describe("une ligne d'historique", () => {
  it("porte le jeu, la date, le vainqueur et le nombre de joueurs", () => {
    const html = rendre({ lignes: [ligne({ vainqueur: MARIE, nombreDeJoueurs: 3 })] });

    expect(html).toContain(SIX_QUI_PREND.nom);
    // La date lisible et la date machine, comme sur la fiche : l'une pour la
    // table, l'autre pour qui lit la page autrement qu'à l'œil.
    expect(html).toContain("08/09/2026 à 21:45");
    expect(html).toContain(FIN.toISOString());
    expect(html).toContain(MARIE.nom);
    expect(html).toContain("3 joueurs");
  });

  it("mène à la fiche de la partie, qui porte la grille et le journal", () => {
    // Toute la ligne est le lien : la cible d'un pouce est la ligne entière, pas
    // une flèche posée au bout.
    expect(rendre()).toContain('href="/p/A1B2C3"');
  });

  it("marque une partie abandonnée et ne lui invente pas de vainqueur", () => {
    // Elle a eu lieu, donc elle figure ; elle ne s'est pas jouée jusqu'au bout,
    // donc rien ne prend la place du vainqueur.
    const html = rendre({ lignes: [ligne({ cause: "abandonnee", vainqueur: null })] });

    expect(html).toContain("Abandonnée");
    expect(html).toContain("3 joueurs");
    expect(html).not.toContain("l’emporte");
  });

  it("ne nomme personne quand la tête est à égalité, sans marquer d'abandon", () => {
    // Le moteur sort son classement en groupes de rang : un groupe de deux en
    // tête n'a pas de vainqueur, et ce n'est pas un abandon pour autant.
    const html = rendre({ lignes: [ligne({ cause: "terminee", vainqueur: null })] });

    expect(html).toContain("Égalité en tête");
    expect(html).not.toContain("Abandonnée");
    expect(html).not.toContain("l’emporte");
  });
});

describe("le filtre de l'historique", () => {
  it("propose un jeu par entrée du catalogue, et la liste entière", () => {
    const liens = liensDHistorique(rendre());

    // L'ensemble exact, et pas seulement « chacun est là » : un second axe de
    // filtre ajouterait une adresse ici, et ce test est ce qui le refuse.
    expect(liens).toEqual([
      'href="/historique"',
      ...ENTREES.map((entree) => `href="/historique?jeu=${entree.id}"`),
    ]);
  });

  it("est le seul filtre : rien d'autre ne se règle sur cet écran", () => {
    // Filtrer par joueur, c'est la fiche de joueur. Tout ce qui se règle ici
    // est une adresse, donc un lien — aucun champ, aucune liste déroulante.
    expect(rendre().match(/<(form|input|select|textarea)\b/g)).toBeNull();
  });

  it("marque le jeu qu'on est en train de lire", () => {
    const html = rendre({ filtre: { jeuId: "uno", combien: 20 } });

    expect(html).toContain('href="/historique?jeu=uno" aria-current="page"');
  });

  it("ne reconduit pas la page déroulée quand on change de jeu", () => {
    // Changer de filtre, c'est repartir en haut d'une autre liste : garder un
    // `voir=60` demandé pour 6 qui prend ferait dérouler soixante lignes d'Uno.
    const liens = liensDHistorique(rendre({ filtre: { jeuId: null, combien: 60 } }));

    expect(liens).toContain('href="/historique?jeu=uno"');
  });
});

describe("un historique vide", () => {
  it("renvoie au catalogue, sans inventer d'écran vide", () => {
    // Ce que l'accueil fait déjà quand aucune partie ne tourne : rien n'a été
    // terminé, et commencer une partie est à un appui.
    const html = rendre({ lignes: [] });

    expect(html).toContain("Aucune partie n’est encore finie");
    for (const entree of ENTREES) {
      expect(html).toContain(`href="/creer/${entree.id}"`);
    }
  });

  it("ne propose pas de filtrer une liste qui n'a rien à filtrer", () => {
    const liens = liensDHistorique(rendre({ lignes: [] }));

    expect(liens).toEqual([]);
  });

  it("garde le chemin du retour quand c'est le filtre qui ne rend rien", () => {
    // Un historique bien rempli qui ne montre rien parce qu'on a choisi Uno
    // n'est pas un historique vide : sans les onglets, on resterait coincé.
    const html = rendre({ lignes: [], filtre: { jeuId: "uno", combien: 20 } });

    expect(html).toContain("Uno : aucune partie n’est encore finie");
    expect(liensDHistorique(html)).toContain('href="/historique"');
  });
});

describe("le « voir plus » de l'historique", () => {
  it("déroule une page de plus, sans numéroter quoi que ce soit", () => {
    // Aucune pagination à dix joueurs : le lien augmente le nombre de lignes
    // montrées, il ne saute pas à une page.
    const html = rendre({ encore: true });

    expect(html).toContain("Voir plus");
    expect(html).toContain('href="/historique?voir=40"');
  });

  it("garde le jeu choisi en déroulant", () => {
    const html = rendre({ encore: true, filtre: { jeuId: "uno", combien: 20 } });

    // `&amp;` : c'est le balisage rendu, pas l'adresse une fois relue.
    expect(html).toContain('href="/historique?jeu=uno&amp;voir=40"');
  });

  it("ne promet rien de plus quand la page a tout montré", () => {
    expect(rendre({ encore: false })).not.toContain("Voir plus");
  });
});
