# CONTEXT.md

Glossaire du vocabulaire métier. Un terme n'entre ici qu'une fois **décidé** :
un mot qui flotte dans le code et un mot qui flotte ici coûtent le même prix.

Le domaine n'est pas encore entièrement modélisé (cf. `AGENTS.md`, « Project
overview »). Ce fichier porte donc ce qui est acquis, et rien de plus.

## Acquis

### Le jeu et sa configuration

Tranché par [#2](https://github.com/Bryan21B/scoring-sheets/issues/2), détaillé
dans `docs/specs/2026-08-31-configuration-de-jeu.md`.

- **Catalogue** — les quatre entrées jouables, déclarées dans une constante
  TypeScript : *6 qui prend*, sa variante *cartes spéciales*, *Uno*, *Dnup*. Un
  `id` de catalogue ne se supprime ni ne se renomme jamais.
- **Jeu** — une entrée du catalogue : une identité, une présentation, et des
  **règles**. Pas une étiquette posée sur la partie, pas une stratégie codée à
  part.
- **Famille** — le lien entre deux entrées qui sont le même jeu à une variante
  près (*6 qui prend* et sa variante *cartes spéciales*). Déclaré par la
  configuration, interprété par le palmarès.
- **Règles** — le bloc de configuration que le moteur reçoit, et le seul :
  direction du classement, mode de saisie, condition de fin, bornes de joueurs.
  Ce qui n'y est pas ne peut pas influencer un calcul.
- **Unité** — le mot qui nomme les points d'un jeu, au singulier et au pluriel :
  tête(s) de bœuf, point(s), jeton(s). De la présentation, jamais des règles.

### Ce que les règles décrivent

- **Mode de saisie** — la forme d'une manche, et la transformation de ce qui est
  entré vers ce qui est marqué. Trois modes : `entierParJoueur` (un entier par
  joueur), `sommeAuGagnant` (les cartes restantes de chaque perdant, dont la
  somme est créditée au gagnant), `podium` (des désignations ordonnées, qui
  distribuent des jetons fixes).
- **Condition de fin** — ce qui clôt la partie : un `seuil` de points atteint, un
  nombre de manches fixe, ou un nombre de manches gagnées. Le seuil se franchit
  toujours par le **total le plus haut**, quel que soit le sens du classement.
- **Direction** — le sens du classement, `haut` ou `bas`. Elle décide qui gagne,
  jamais quand la partie s'arrête.

### La partie en cours

- **Partie** — une session de jeu entre plusieurs joueurs, du début à la fin du
  décompte. C'est l'unité qu'on ouvre, qu'on remplit, puis qu'on clôt.
- **Feuille de score** — la représentation d'une partie : qui joue, ce qui a été
  marqué, où en sont les totaux. Le nom du produit vient de là.
- **Joueur** — un participant à une partie.
- **Manche** — un tour de jeu à l'issue duquel des points sont attribués.
- **Instantané de règles** — les règles du jeu **résolues et figées** à
  l'ouverture de la partie : nombre de joueurs appliqué, seuil surchargé
  appliqué. Une partie se relit toujours sous les règles qui l'ont ouverte, même
  si le catalogue change ensuite.
- **Manche complète** — une manche dont toutes les saisies attendues sont
  arrivées ; la définition dépend du mode de saisie. Une manche incomplète fait
  bouger les totaux mais ne peut jamais terminer la partie.
- **Gagnant de manche** — dérivé du mode de saisie, jamais saisi. Une égalité sur
  une manche ne fait aucun gagnant.

### Le décompte

- **Moteur de décompte** — la fonction pure et unique qui, depuis des règles et
  des manches, produit l'**état**. Rien de ce qu'elle calcule n'est stocké.
- **État** — totaux courants, manches gagnées, classement, nombre de manches
  jouées, et si la partie est finie.
- **Classement** — un ordre en **groupes de rang** : deux joueurs à égalité sont
  dans le même groupe. L'égalité n'est jamais départagée, et le classement se lit
  à tout moment, même partie non terminée.

## À trancher

Les cinq questions ouvertes ici à l'origine sont tranchées : deux par
[#2](https://github.com/Bryan21B/scoring-sheets/issues/2) — le jeu est une
entité portant ses règles, et la direction du classement dépend du jeu — les
trois autres au cadrage de la carte
([#1](https://github.com/Bryan21B/scoring-sheets/issues/1)) : le joueur est
persistant entre parties, le score se saisit manche par manche, et il n'y a
aucune authentification — un lien de partage par partie, non devinable.

Ce qui reste à nommer :

- Le vocabulaire de l'identité et de l'arrivée dans une partie — identité
  d'appareil, roster, lien de partage → [#3](https://github.com/Bryan21B/scoring-sheets/issues/3).
- Les états d'une partie et les gestes de son cycle de vie →
  [#13](https://github.com/Bryan21B/scoring-sheets/issues/13).
- Le vocabulaire de l'audit → [#11](https://github.com/Bryan21B/scoring-sheets/issues/11).

Les termes retenus remontent dans « Acquis » à la fermeture de chaque ticket ;
le schéma qui les porte se décide dans
[#15](https://github.com/Bryan21B/scoring-sheets/issues/15).
