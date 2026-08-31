# CONTEXT.md

Glossaire du vocabulaire métier. Un terme n'entre ici qu'une fois **décidé** :
un mot qui flotte dans le code et un mot qui flotte ici coûtent le même prix.

Le domaine n'est pas encore modélisé (cf. `AGENTS.md`, « Project overview »).
Ce fichier porte donc ce qui est acquis, et rien de plus.

## Acquis

- **Partie** — une session de jeu entre plusieurs joueurs, du début à la fin du
  décompte. C'est l'unité qu'on ouvre, qu'on remplit, puis qu'on clôt.
- **Feuille de score** — la représentation d'une partie : qui joue, ce qui a été
  marqué, où en sont les totaux. Le nom du produit vient de là.
- **Joueur** — un participant à une partie.
- **Manche** — un tour de jeu à l'issue duquel des points sont attribués. Le
  découpage exact dépend du jeu de cartes.

## À trancher

Ces questions décident du schéma. Les laisser ouvertes ici est plus honnête que
de les figer dans une table qu'on défera.

- Un **jeu** (belote, tarot, rami…) est-il une entité, avec ses règles de
  décompte, ou juste une étiquette posée sur la partie ?
- Un joueur est-il **persistant** entre parties, ou local à une feuille ?
- Le score se saisit-il **manche par manche**, ou seulement en total ?
- Qui a le droit d'écrire sur une feuille : authentification, lien de partage,
  ou rien du tout ?
- Un score peut-il être **négatif**, et le gagnant est-il celui qui a le plus ou
  le moins de points ? Cela varie d'un jeu à l'autre.

Trancher dans un design doc `docs/specs/YYYY-MM-DD-modele-de-domaine.md`, puis
remonter les termes retenus dans « Acquis ».
