# 0005 — Une configuration déclarative de jeu, pas une stratégie par jeu

- **Statut** : acceptée
- **Date** : 2026-09-09
- **Spec** : `docs/specs/2026-08-31-configuration-de-jeu.md`

## Contexte

Le catalogue porte quatre entrées jouables : *6 qui prend*, sa variante *cartes
spéciales*, *Uno*, *Dnup*. Elles diffèrent sur quatre axes seulement — le sens du
classement, la forme d'une saisie, la condition de fin, les bornes de joueurs — et
s'accordent sur tout le reste.

Trois approches se présentaient.

**A — Une stratégie en code par jeu.** Une interface, quatre implémentations.
C'est le réflexe orienté objet, et il se paie : le cinquième jeu se code en
copiant le plus proche, et la logique de « quand la partie s'arrête » finit écrite
quatre fois. Quatre endroits où corriger le même bug.

**B — Une configuration déclarative paramétrée.** Un objet par entrée, où les
quatre axes variables deviennent des champs et le reste vit dans un moteur unique.
Chaque champ est une **union discriminée close et paramétrée** : les formes sont
connues et limitées, mais chacune porte ses valeurs.

**C — Un DSL générique de règles.** Une description compositionnelle capable
d'exprimer un jeu jamais vu. C'est un langage de règles pour un catalogue de
quatre entrées et une dizaine d'utilisateurs : du coût sans client, et un langage
qu'il faudrait documenter, tester et déboguer en plus des jeux eux-mêmes.

## Décision

**B.** Un **jeu est une entité portant une configuration déclarative**, lue par un
**moteur de décompte unique** — pas une étiquette, pas une stratégie en code.

`evaluer(regles, manches)` est **pure** : elle ne reçoit que des données et ne
touche à rien. Ce qui n'est pas dans `regles` ne peut pas influencer un calcul.

**Pas de table `jeux`.** Le catalogue vit dans une constante TypeScript, éditable
sans migration. La partie stocke un **instantané complet des règles résolues** —
surcharge de seuil et variation par nombre de joueurs déjà appliquées.

## Conséquences

- **Ajouter un jeu est une entrée dans une constante et zéro migration.** Ajuster
  un barème aussi : c'est ce que la table `jeux` aurait coûté.
- **Une partie se relit toujours sous les règles qui l'ont ouverte.** L'instantané
  est le seul rempart contre une édition rétroactive : sans lui, corriger un
  barème réécrirait des parties passées.
- **Le moteur est testable sans base.** Les quatre entrées du catalogue en sont
  les quatre jeux d'essai.
- **`jeuId` n'a aucune intégrité référentielle au niveau SQLite.** Une écriture
  directe en base pourrait y mettre n'importe quoi. Relâchement assumé à dix
  utilisateurs sans accès à la base, et Zod valide à l'écriture.
- **Le cinquième jeu est l'épreuve de vérité.** S'il réclame une stratégie en
  code, c'est que les axes ont été mal choisis, et il faudra le dire plutôt que
  d'ajouter un champ de plus.
- **Le mode de saisie porte plus que la forme des données.** Il gouverne la
  complétude d'une manche, le gagnant d'une manche, et la lecture de la colonne
  `valeur` en base. Lui confier ces trois lectures n'a coûté aucun concept
  supplémentaire, mais cela le rend load-bearing : le changer, c'est changer trois
  choses.
