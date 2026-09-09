# Uno

- **Entrée du catalogue** : `uno`
- **Livret** : notice Mattel **GDJ85**, édition **112 cartes** de 2019,
  trilingue anglais / espagnol / **français canadien**. 2 à 10 joueurs, 7 ans et +.
- **Source** : <https://service.mattel.com/instruction_sheets/GDJ85-FR.pdf>
  (`sha256 77fc0aba…8fa1`, relevé le 2026-09-09)
- **Aucun livret local** : Uno est la seule des quatre entrées sans PDF dans
  `rules/`. Le digest est écrit depuis la notice en ligne.
- **Si la boîte est un 108 cartes**, voir « Pièges » : deux lignes du barème
  n'existent pas et la notice correspondante est ailleurs.

## But du jeu

Se débarrasser le premier de toutes ses cartes à chaque manche, et **encaisser**
la valeur de tout ce qui reste dans la main des autres. Les points s'accumulent
de manche en manche. **Le plus haut gagne.**

## Déroulement d'une manche

7 cartes chacun, le reste en pioche, la carte du dessus retournée pour ouvrir la
défausse. On recouvre par une carte de **même couleur, même chiffre ou même
symbole**. Sans carte jouable, on pioche : la carte piochée se joue tout de suite
si elle le peut, sinon le tour passe.

Les cartes Action (+2, Inversion, Passer, blanche, blanche +4, Mélanger les
mains, à personnaliser) changent le tour, pas le décompte — elles ne comptent
qu'à l'instant où la manche s'arrête, dans la main de celui qui les tient encore.

En posant son **avant-dernière** carte, il faut crier « UNO ». Un joueur qui
oublie et se fait reprendre avant que le suivant ait joué **pioche deux cartes**.

La manche s'arrête quand un joueur pose sa dernière carte.

## Décompte

Le joueur sorti encaisse la **somme des cartes restant dans la main de tous les
autres**. Les autres marquent zéro.

| Carte restante | Points |
|---|---|
| Numérotée de 0 à 9 | sa valeur |
| +2 | 20 |
| Inversion | 20 |
| Passer | 20 |
| Carte blanche | 50 |
| Carte blanche +4 | 50 |
| Mélanger les mains | 40 |
| À personnaliser | 40 |

Un seul joueur marque par manche, et sa saisie est **un total unique**, pas une
valeur par joueur — c'est ce que le mode `sommeAuGagnant` traduit.

## Fin de partie

Le premier à **500 points** gagne. Si personne ne les atteint, on remélange et on
enchaîne.

La notice décrit aussi un **décompte inversé** : chacun note les points de sa
propre main à chaque manche, et quand quelqu'un atteint ou dépasse 500, c'est
celui qui en a le **moins** qui gagne. C'est une autre façon de compter, pas la
règle par défaut. L'app applique la règle imprimée.

## Pièges

- **Les cartes piochées de force comptent.** Si la dernière carte posée est un +2
  ou une blanche +4, le joueur suivant pioche quand même, et ces cartes entrent
  dans le décompte de la manche. On les oublie parce que la manche est finie.
- **La blanche +4 ne se joue que sans carte de la couleur demandée.** Un joueur
  peut lancer un défi : s'il a raison, le tricheur pioche 4 cartes ; s'il a tort,
  il pioche **6** cartes. Sans conséquence directe sur le barème, mais ça change
  ce qui reste en main.
- **Le barème dépend de la boîte.** *Mélanger les mains* et *à personnaliser*,
  40 points chacune, sont des cartes de l'édition 112 cartes de 2019. Sur un
  **Uno 108 cartes**, ces deux lignes n'existent pas et la notice à lire est
  <https://service.mattel.com/instruction_sheets/uno%20basic%20is.pdf>
  (anglais et espagnol seulement). **Le décompte de base et le seuil de 500 sont
  identiques**, donc la configuration du catalogue ne bouge pas : c'est ce digest
  seul qui change.
- **La notice est en français canadien.** « Piger » vaut piocher, « brasser »
  mélanger, le « TALON » est la défausse. Le vocabulaire de l'app suit le
  français de France ; ne pas recopier celui de la notice.
