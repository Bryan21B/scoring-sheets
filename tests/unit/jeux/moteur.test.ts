import { describe, expect, it } from "bun:test";
import { trouverEntree } from "@/lib/jeux/catalogue";
import { estComplete, evaluer, gagnantDeManche, type Manche } from "@/lib/jeux/moteur";
import { resoudreRegles } from "@/lib/jeux/resolution";

// Les quatre entrées du catalogue servent de jeux d'essai : le moteur n'a pas
// d'autre jeu de données que celui avec lequel il tournera vraiment.
const sixQuiPrend = resoudreRegles(trouverEntree("6-qui-prend"), { nombreDeJoueurs: 4 });
const uno = resoudreRegles(trouverEntree("uno"), { nombreDeJoueurs: 3 });
const dnup = resoudreRegles(trouverEntree("dnup"), { nombreDeJoueurs: 4 });
const dnupADeux = resoudreRegles(trouverEntree("dnup"), { nombreDeJoueurs: 2 });
const variante = resoudreRegles(trouverEntree("6-qui-prend-cartes-speciales"), {
  nombreDeJoueurs: 4,
});

/** Une manche lisible en une ligne : les attendus, puis les cases posées. */
function manche(
  participants: readonly number[],
  cases: readonly (readonly [number, number | null])[],
  close = false,
): Manche {
  return {
    close,
    participants,
    cases: cases.map(([joueurId, valeur]) => ({ joueurId, valeur })),
  };
}

describe("evaluer, la fonction pure", () => {
  it("rend le même état pour les mêmes arguments", () => {
    const manches = [
      manche(
        [1, 2],
        [
          [1, 5],
          [2, 3],
        ],
        true,
      ),
    ];

    expect(evaluer(sixQuiPrend, manches)).toEqual(evaluer(sixQuiPrend, manches));
  });

  it("ne modifie ni les règles ni les manches qu'on lui passe", () => {
    const manches = [
      manche(
        [1, 2],
        [
          [1, 5],
          [2, 3],
        ],
        true,
      ),
    ];
    const avant = structuredClone({ regles: sixQuiPrend, manches });

    evaluer(sixQuiPrend, manches);

    expect({ regles: sixQuiPrend, manches }).toEqual(avant);
  });

  it("ne touche aucune base et ne peut pas brancher sur le jeu", async () => {
    // Le moteur ne reçoit que des données : ce qui n'est pas dans `regles` ne
    // peut pas influencer un calcul. Le garde-fou est mécanique — importer le
    // catalogue rendrait `jeuId` atteignable, importer `@/db` rendrait la
    // fonction impure — et il vaut mieux ici qu'en prose.
    const source = await Bun.file(
      new URL("../../../src/lib/jeux/moteur.ts", import.meta.url),
    ).text();
    // Ce sont les imports qu'on épingle, pas le vocabulaire : une phrase de
    // JSDoc qui dirait « catalogue » n'est pas une dépendance.
    const imports = source.split("\n").filter((ligne) => ligne.startsWith("import"));

    expect(imports).toEqual(['import type { Regles } from "@/lib/jeux/regles";']);
  });
});

describe("les totaux vivants", () => {
  it("comptent une manche encore en cours de saisie", () => {
    // Trois joueurs sur quatre ont saisi la manche 2 : les compteurs bougent
    // déjà, c'est ce qui fait voir le seuil arriver.
    const etat = evaluer(sixQuiPrend, [
      manche(
        [1, 2, 3, 4],
        [
          [1, 5],
          [2, 0],
          [3, 12],
          [4, 7],
        ],
        true,
      ),
      manche(
        [1, 2, 3, 4],
        [
          [1, 10],
          [3, 2],
        ],
      ),
    ]);

    expect(etat.totaux).toEqual(
      new Map([
        [1, 15],
        [2, 0],
        [3, 14],
        [4, 7],
      ]),
    );
  });

  it("posent à zéro un joueur qui n'a encore rien marqué", () => {
    // À Uno, seul le gagnant porte une case : les autres n'ont aucune ligne, et
    // ils doivent quand même exister dans les totaux.
    const etat = evaluer(uno, [manche([1, 2, 3], [[2, 40]], true)]);

    expect(etat.totaux).toEqual(
      new Map([
        [1, 0],
        [2, 40],
        [3, 0],
      ]),
    );
  });

  it("ignorent une case touchée mais vide", () => {
    // `null` est l'état par lequel Uno passe entre la désignation et le total.
    const etat = evaluer(uno, [manche([1, 2], [[2, null]])]);

    expect(etat.totaux).toEqual(
      new Map([
        [1, 0],
        [2, 0],
      ]),
    );
  });
});

describe("la fin figée", () => {
  const soixanteDix = [
    manche(
      [1, 2, 3, 4],
      [
        [1, 60],
        [2, 3],
        [3, 4],
        [4, 5],
      ],
      true,
    ),
    manche(
      [1, 2, 3, 4],
      [
        [1, 10],
        [2, 0],
        [3, 0],
        [4, 0],
      ],
    ),
  ];

  it("ne ferme pas la partie sur une manche encore ouverte", () => {
    // Le joueur 1 est déjà à 70 têtes de bœuf pour 66 au seuil : on voit le
    // seuil arriver, et la partie ne ferme qu'à la clôture, qui est un acte
    // déclaré et non la simple complétude.
    const etat = evaluer(sixQuiPrend, soixanteDix);

    expect(etat.totaux.get(1)).toBe(70);
    expect(etat.fini).toBe(false);
    expect(etat.manchesJouees).toBe(1);
  });

  it("ferme la partie dès que la manche qui franchit le seuil est close", () => {
    const closes = soixanteDix.map((uneManche) => ({ ...uneManche, close: true }));

    const etat = evaluer(sixQuiPrend, closes);

    expect(etat.fini).toBe(true);
    expect(etat.manchesJouees).toBe(2);
  });

  it("se franchit par le total le plus haut, quelle que soit la direction", () => {
    // Le seuil ne connaît pas `direction` : à 6 qui prend le plus bas gagne, et
    // c'est pourtant le plus haut qui arrête la soirée. Les deux tables
    // ci-dessous ont la même forme — un joueur au-dessus, un joueur loin
    // dessous — et ferment toutes les deux.
    const chezLePlusBas = evaluer(sixQuiPrend, [
      manche(
        [1, 2],
        [
          [1, 70],
          [2, 3],
        ],
        true,
      ),
    ]);
    const chezLePlusHaut = evaluer(uno, [manche([1, 2], [[1, 520]], true)]);

    expect(sixQuiPrend.classement.direction).toBe("bas");
    expect(uno.classement.direction).toBe("haut");
    expect(chezLePlusBas.fini).toBe(true);
    expect(chezLePlusHaut.fini).toBe(true);
  });

  it("ne se franchit pas tant que le plus haut total reste sous le seuil", () => {
    const etat = evaluer(sixQuiPrend, [
      manche(
        [1, 2],
        [
          [1, 65],
          [2, 3],
        ],
        true,
      ),
    ]);

    expect(etat.fini).toBe(false);
  });

  it("ferme la variante 6 qui prend sur ses deux manches fixes", () => {
    const uneManche = manche(
      [1, 2],
      [
        [1, 4],
        [2, 9],
      ],
      true,
    );

    expect(evaluer(variante, [uneManche]).fini).toBe(false);
    expect(evaluer(variante, [uneManche, uneManche]).fini).toBe(true);
  });

  it("ne compte pas une manche ouverte dans les manches fixes", () => {
    const etat = evaluer(variante, [
      manche(
        [1, 2],
        [
          [1, 4],
          [2, 9],
        ],
        true,
      ),
      manche(
        [1, 2],
        [
          [1, 1],
          [2, 2],
        ],
      ),
    ]);

    expect(etat.manchesJouees).toBe(1);
    expect(etat.fini).toBe(false);
  });

  it("laisse une partie sans manche ouverte", () => {
    expect(evaluer(sixQuiPrend, [])).toEqual({
      totaux: new Map(),
      manchesGagnees: new Map(),
      classement: [],
      fini: false,
      manchesJouees: 0,
    });
  });
});

describe("la complétude, dérivée du mode de saisie", () => {
  it("attend toutes les valeurs à 6 qui prend", () => {
    const partielle = manche(
      [1, 2, 3, 4],
      [
        [1, 5],
        [2, 0],
        [3, 12],
      ],
    );
    const touchee = manche(
      [1, 2, 3, 4],
      [
        [1, 5],
        [2, 0],
        [3, 12],
        [4, null],
      ],
    );
    const pleine = manche(
      [1, 2, 3, 4],
      [
        [1, 5],
        [2, 0],
        [3, 12],
        [4, 7],
      ],
    );

    expect(estComplete(sixQuiPrend, partielle)).toBe(false);
    expect(estComplete(sixQuiPrend, touchee)).toBe(false);
    expect(estComplete(sixQuiPrend, pleine)).toBe(true);
  });

  it("attend une désignation et un total unique à Uno", () => {
    // Deux gestes, jamais n : le gagnant, puis le total des cartes restantes de
    // tous les autres. Une valeur par perdant n'est pas une manche d'Uno.
    expect(estComplete(uno, manche([1, 2, 3], []))).toBe(false);
    expect(estComplete(uno, manche([1, 2, 3], [[2, null]]))).toBe(false);
    expect(estComplete(uno, manche([1, 2, 3], [[2, 40]]))).toBe(true);
    expect(
      estComplete(
        uno,
        manche(
          [1, 2, 3],
          [
            [2, 40],
            [3, 15],
          ],
        ),
      ),
    ).toBe(false);
  });

  it("attend un premier et un deuxième à Dnup", () => {
    // La valeur d'une case `podium` est le **rang**, `1` pour le premier et `2`
    // pour le deuxième — l'encodage que `docs/specs/2026-09-09-schema.md` fixe
    // pour la colonne. On y désigne des joueurs, les jetons sont un résultat et
    // jamais une saisie.
    expect(estComplete(dnup, manche([1, 2, 3, 4], [[1, 1]]))).toBe(false);
    expect(
      estComplete(
        dnup,
        manche(
          [1, 2, 3, 4],
          [
            [1, 1],
            [2, null],
          ],
        ),
      ),
    ).toBe(false);
    expect(
      estComplete(
        dnup,
        manche(
          [1, 2, 3, 4],
          [
            [1, 1],
            [2, 2],
          ],
        ),
      ),
    ).toBe(true);
    // Un rang zéro n'existe pas : la colonne compte à partir de un.
    expect(
      estComplete(
        dnup,
        manche(
          [1, 2, 3, 4],
          [
            [1, 0],
            [2, 1],
          ],
        ),
      ),
    ).toBe(false);
  });
});

describe("le gagnant d'une manche, dérivé et jamais saisi", () => {
  it("est le meilleur score de la manche à 6 qui prend, où le plus bas gagne", () => {
    const pleine = manche(
      [1, 2, 3, 4],
      [
        [1, 5],
        [2, 0],
        [3, 12],
        [4, 7],
      ],
      true,
    );

    expect(gagnantDeManche(sixQuiPrend, pleine)).toBe(2);
  });

  it("suit la direction du classement, et elle seule", () => {
    // Aucune entrée du catalogue ne croise `entierParJoueur` et « le plus haut
    // gagne » : la variation se fabrique ici pour montrer que le meilleur score
    // d'une manche se lit par `direction`, pas par une convention cachée.
    const alEnvers = { ...sixQuiPrend, classement: { direction: "haut" } } as const;
    const pleine = manche(
      [1, 2, 3, 4],
      [
        [1, 5],
        [2, 0],
        [3, 12],
        [4, 7],
      ],
      true,
    );

    expect(gagnantDeManche(alEnvers, pleine)).toBe(3);
  });

  it("est le gagnant désigné à Uno, celui-là même qui encaisse le total", () => {
    expect(gagnantDeManche(uno, manche([1, 2, 3], [[2, 40]], true))).toBe(2);
  });

  it("est le premier du podium à Dnup", () => {
    const podium = manche(
      [1, 2, 3, 4],
      [
        [1, 2],
        [3, 1],
      ],
      true,
    );

    expect(gagnantDeManche(dnup, podium)).toBe(3);
  });

  it("n'existe pas quand la manche est à égalité", () => {
    // Égalité sur une manche : personne ne la gagne, et rien ne la départage.
    const exAequo = manche(
      [1, 2, 3],
      [
        [1, 4],
        [2, 4],
        [3, 9],
      ],
      true,
    );

    expect(gagnantDeManche(sixQuiPrend, exAequo)).toBeUndefined();
  });

  it("n'existe pas tant que la manche est incomplète", () => {
    // Le meilleur score des trois joueurs qui ont saisi n'est pas le gagnant de
    // la manche : c'est le meilleur score de trois joueurs.
    const partielle = manche(
      [1, 2, 3, 4],
      [
        [1, 5],
        [2, 0],
        [3, 12],
      ],
    );

    expect(gagnantDeManche(sixQuiPrend, partielle)).toBeUndefined();
  });
});

describe("les manches gagnées", () => {
  it("ne comptent que les manches closes", () => {
    const etat = evaluer(sixQuiPrend, [
      manche(
        [1, 2, 3, 4],
        [
          [1, 5],
          [2, 0],
          [3, 12],
          [4, 7],
        ],
        true,
      ),
      manche(
        [1, 2, 3, 4],
        [
          [1, 0],
          [2, 9],
          [3, 9],
          [4, 9],
        ],
      ),
    ]);

    // Le joueur 1 mène la manche 2, mais elle n'est pas close : elle ne compte
    // pas encore, alors même que son 0 est déjà dans les totaux.
    expect(etat.totaux.get(1)).toBe(5);
    expect(etat.manchesGagnees).toEqual(
      new Map([
        [1, 0],
        [2, 1],
        [3, 0],
        [4, 0],
      ]),
    );
  });

  it("ne créditent personne sur une manche à égalité", () => {
    const exAequo = manche(
      [1, 2],
      [
        [1, 4],
        [2, 4],
      ],
      true,
    );

    expect(evaluer(sixQuiPrend, [exAequo]).manchesGagnees).toEqual(
      new Map([
        [1, 0],
        [2, 0],
      ]),
    );
  });

  it("ne créditent aucun jeton à Dnup à deux joueurs", () => {
    // Le cas qui a ouvert le ticket 42 : deux manches gagnées par la même
    // personne rendaient des totaux de 4 et 2, pour une variante dont le livret
    // ne compte aucun jeton. Les manches gagnées ferment la partie ; les totaux
    // restent à zéro, y compris pour un rang de plus que le barème n'en paie —
    // à deux, il n'y a pas de deuxième sorti.
    const gagneeParUn = manche(
      [1, 2],
      [
        [1, 1],
        [2, 2],
      ],
      true,
    );

    const etat = evaluer(dnupADeux, [gagneeParUn, gagneeParUn]);

    expect(etat.totaux).toEqual(
      new Map([
        [1, 0],
        [2, 0],
      ]),
    );
    expect(etat.fini).toBe(true);
  });

  it("ferment Dnup à deux joueurs sur deux manches gagnées", () => {
    // À deux, Dnup est une autre variante : la partie se gagne à deux manches,
    // et la saisie change avec elle — on désigne toujours un rang, mais il ne
    // rapporte aucun jeton.
    const gagneeParUn = manche(
      [1, 2],
      [
        [1, 1],
        [2, 2],
      ],
      true,
    );

    expect(dnupADeux.fin).toEqual({ type: "manchesGagnees", valeur: 2 });
    expect(evaluer(dnupADeux, [gagneeParUn]).fini).toBe(false);
    expect(evaluer(dnupADeux, [gagneeParUn, gagneeParUn]).fini).toBe(true);
    expect(evaluer(dnupADeux, [gagneeParUn, gagneeParUn]).manchesGagnees).toEqual(
      new Map([
        [1, 2],
        [2, 0],
      ]),
    );
  });

  it("ne ferment pas Dnup sur une deuxième manche restée ouverte", () => {
    const close = manche(
      [1, 2],
      [
        [1, 1],
        [2, 2],
      ],
      true,
    );
    const ouverte = manche(
      [1, 2],
      [
        [1, 1],
        [2, 2],
      ],
    );

    expect(evaluer(dnupADeux, [close, ouverte]).fini).toBe(false);
  });

  it("distribuent les jetons du barème à Dnup à quatre", () => {
    // `jetons: [2, 1]` : deux jetons au premier, un au deuxième, rien aux
    // autres. Le rang saisi vaut `1` puis `2`, et c'est le barème qui dit ce
    // qu'il rapporte.
    const etat = evaluer(dnup, [
      manche(
        [1, 2, 3, 4],
        [
          [3, 1],
          [1, 2],
        ],
        true,
      ),
    ]);

    expect(etat.totaux).toEqual(
      new Map([
        [1, 1],
        [2, 0],
        [3, 2],
        [4, 0],
      ]),
    );
  });
});

describe("le classement, en groupes de rang", () => {
  it("range du plus bas au plus haut à 6 qui prend, partie non finie", () => {
    // Le podium consultable en cours de partie n'est pas un mode particulier :
    // c'est la sortie normale du moteur, affichée plus tôt, et il se lit sur les
    // totaux vivants — la manche 2 encore ouverte a déjà déplacé le joueur 1.
    const etat = evaluer(sixQuiPrend, [
      manche(
        [1, 2, 3, 4],
        [
          [1, 5],
          [2, 0],
          [3, 12],
          [4, 7],
        ],
        true,
      ),
      manche(
        [1, 2, 3, 4],
        [
          [1, 10],
          [3, 2],
        ],
      ),
    ]);

    expect(etat.fini).toBe(false);
    expect(etat.classement).toEqual([[2], [4], [3], [1]]);
  });

  it("range du plus haut au plus bas à Uno", () => {
    const etat = evaluer(uno, [manche([1, 2, 3], [[2, 40]], true)]);

    expect(etat.classement).toEqual([[2], [1, 3]]);
  });

  it("met les ex æquo dans le même groupe et ne les départage jamais", () => {
    const etat = evaluer(sixQuiPrend, [
      manche(
        [1, 2, 3],
        [
          [1, 5],
          [2, 5],
          [3, 9],
        ],
        true,
      ),
    ]);

    expect(etat.classement).toEqual([[1, 2], [3]]);
  });

  it("saute le rang suivant après un groupe : deux premiers, puis le troisième", () => {
    // Deux joueurs sur la même marche, et la marche d'après est le rang 3. Le
    // type le dit tout seul : deux groupes, le second arrivant en position 2 de
    // la liste alors qu'il est troisième de la partie.
    const etat = evaluer(uno, [
      manche([1, 2, 3], [[1, 30]], true),
      manche([1, 2, 3], [[2, 30]], true),
      manche([1, 2, 3], [[1, 0]], true),
    ]);

    expect(etat.totaux).toEqual(
      new Map([
        [1, 30],
        [2, 30],
        [3, 0],
      ]),
    );
    expect(etat.classement).toEqual([[1, 2], [3]]);
  });
});

describe("le participant retiré", () => {
  // Paul, le joueur 4, rentre chez lui après la manche 1 : il sort des attendus
  // des manches suivantes, ses valeurs déjà saisies restent.
  const avantSonDepart = manche(
    [1, 2, 3, 4],
    [
      [1, 5],
      [2, 3],
      [3, 1],
      [4, 0],
    ],
    true,
  );
  const apresSonDepart = manche(
    [1, 2, 3],
    [
      [1, 2],
      [2, 9],
      [3, 9],
    ],
    true,
  );

  it("ne compte plus dans la complétude des manches suivantes", () => {
    // La table peut finir sans lui : sans cela, la manche 2 resterait à jamais
    // incomplète et ne pourrait plus se clore.
    expect(estComplete(sixQuiPrend, apresSonDepart)).toBe(true);
  });

  it("ne bloque pas la complétude d'Uno avec la case vide qu'il laisse", () => {
    // Une case existe dès qu'elle est touchée : Paul a été désigné, puis il est
    // parti avant que son total soit tapé. Sa case n'est plus attendue, elle ne
    // doit pas empêcher la manche de se clore.
    const laisseeVide = manche(
      [1, 2, 3],
      [
        [2, 40],
        [4, null],
      ],
    );

    expect(estComplete(uno, laisseeVide)).toBe(true);
  });

  it("garde le gagnant de la manche qu'il avait remportée avant de partir", () => {
    // L'histoire est vraie et ne se réécrit pas : sortir Paul des attendus ne
    // lui retire pas la manche qu'il a gagnée quand il était là.
    const gagneeParPaul = manche([1, 2, 3], [[4, 40]], true);

    expect(gagnantDeManche(uno, gagneeParPaul)).toBe(4);
    expect(evaluer(uno, [gagneeParPaul]).manchesGagnees.get(4)).toBe(1);
  });

  it("garde les valeurs qu'il avait déjà saisies", () => {
    const etat = evaluer(sixQuiPrend, [avantSonDepart, apresSonDepart]);

    expect(etat.totaux).toEqual(
      new Map([
        [1, 7],
        [2, 12],
        [3, 10],
        [4, 0],
      ]),
    );
  });

  it("ne figure pas au classement", () => {
    // Le laisser au classement avec ses zéros le ferait gagner à 6 qui prend en
    // partant tôt, puisque le plus bas l'emporte.
    const etat = evaluer(sixQuiPrend, [avantSonDepart, apresSonDepart]);

    expect(etat.classement).toEqual([[1], [3], [2]]);
  });

  it("ne ferme pas la partie de ceux qui jouent encore", () => {
    // Son total franchit le seuil, mais il n'est plus de la partie : la soirée
    // des autres ne s'arrête pas sur le score de quelqu'un qui est rentré.
    const etat = evaluer(sixQuiPrend, [
      manche(
        [1, 2, 3, 4],
        [
          [1, 5],
          [2, 3],
          [3, 1],
          [4, 70],
        ],
        true,
      ),
      apresSonDepart,
    ]);

    expect(etat.totaux.get(4)).toBe(70);
    expect(etat.fini).toBe(false);
  });

  it("se lit pareil que la manche porte l'effectif du jour ou celui d'aujourd'hui", () => {
    // Le moteur lit l'intersection des attendus : que l'appelant recopie
    // l'effectif courant sur toutes les manches ou garde celui de chacune, la
    // partie sort identique. Une source d'erreur en moins chez l'appelant.
    const effectifDuJour = evaluer(sixQuiPrend, [avantSonDepart, apresSonDepart]);
    const effectifCourant = evaluer(sixQuiPrend, [
      { ...avantSonDepart, participants: [1, 2, 3] },
      apresSonDepart,
    ]);

    expect(effectifDuJour).toEqual(effectifCourant);
  });
});
