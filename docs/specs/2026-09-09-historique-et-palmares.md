# Historique et palmarès : les pages et leurs agrégats

- **Statut** : acceptée
- **Date** : 2026-09-09
- **Ticket** : [Historique et palmarès : les pages et leurs agrégats](https://github.com/Bryan21B/scoring-sheets/issues/14), sous la carte [Carte — feuille de score multi-appareils pour 6 qui prend, Uno et Dnup](https://github.com/Bryan21B/scoring-sheets/issues/1)

## Contexte

Deux décisions antérieures contraignent ce document plus que son propre énoncé.

La **recherche classement** ([Classement multijoueur](https://github.com/Bryan21B/scoring-sheets/issues/5)) a fixé la granularité :
**une note globale par joueur, jamais par (joueur, jeu)**, parce que 7 à 9 parties
par joueur, par entrée et par an ne suffisent à rien. Ce qui va par jeu, ce sont
des **compteurs, pas des estimations** — et elle a explicitement renvoyé ici la
question de ce qu'ils remplissent.

Le **cadrage de la carte** a posé que la note **vient après la v1**. Le palmarès
décrit ici n'en contient donc aucune.

## Trois mots, trois portées

Le vocabulaire se marchait dessus, et c'est réglé avant tout le reste.

| Mot | Ce qu'il désigne | Portée |
|---|---|---|
| **Classement** | l'ordre en groupes de rang que le moteur produit | **une** partie |
| **Note** | l'estimation globale d'un joueur, `openskill`, après la v1 | toutes ses parties |
| **Palmarès** | la page qui liste les joueurs et les ordonne | toutes les parties |

Un classement ne sort jamais d'une partie ; une note n'entre jamais dans une
partie.

## Les quatre pages, qui sont deux paires

| Liste | Fiche |
|---|---|
| **Historique** — les parties | **Fiche de partie** |
| **Palmarès** — les joueurs | **Fiche de joueur** |

Une seule idée de navigation à apprendre : une liste mène à une fiche.

La fiche de joueur gagne sa place par un argument précis. Les **compteurs par
jeu** sont par couple joueur et entrée : à dix joueurs et quatre entrées, c'est
une grille de quarante cases, illisible sur un téléphone. Elle se coupe
naturellement par joueur, et c'est cette coupe qui *est* la fiche.

## Le palmarès

**Ordonné par taux de victoires normalisé**, avec le **nombre de parties** à côté
de chaque ligne.

Le taux de victoires normalisé est, pour une partie,
`(nb_battus + 0,5 × nb_ex_æquo) / (n − 1)`, moyenné sur les parties terminées du
joueur. Il normalise la taille de la tablée, ce qu'un simple compte de victoires
ne fait pas : gagner à six vaut plus que gagner à deux.

Le choix n'est pas un pis-aller en attendant la note. La recherche classement a
mesuré que sur un calendrier équilibré, **ce taux fait aussi bien que les trois
formules, et mieux à volume élevé** — c'est le résultat qu'elle qualifie de plus
utile de tout le document. Ce qui sauve la formule, c'est le calendrier
déséquilibré d'un vrai cercle d'amis, pas la statistique elle-même.

**Sous un plancher de parties, le joueur est hors classement** : il apparaît en
bas, sans rang, dans un groupe qui dit pourquoi. C'est le « seuil sous lequel on
n'affiche rien » que la recherche exige, appliqué au chiffre qu'on a — trois
parties donnent un taux qui ne veut rien dire.

**La note s'ajoutera comme une colonne**, sans rien déplacer, avec l'incertitude
que la recherche impose : un nombre de parties à côté, et pas de « 1er »
péremptoire quand deux joueurs sont à un écart-type.

## La fiche de joueur

Les **compteurs par entrée du catalogue**, groupés sous leur **famille**, avec un
sous-total de famille.

Un compteur est un **fait** : parties jouées, victoires, dernière partie. Fusionner
les deux 6 qui prend cacherait que sur douze parties, neuf étaient le jeu de base
et trois la variante. Les séparer garde le fait ; le sous-total garde la phrase
qu'un joueur dirait vraiment, « j'ai gagné cinq parties de 6 qui prend ».

C'est ainsi que la **famille** gagne sa déclaration dans le catalogue : elle
**groupe**, elle ne somme pas. Elle reste disponible si la note passe un jour par
famille plutôt que globale.

Les compteurs ne souffrent pas du découpage qui interdit une note par jeu : trois
parties donnent honnêtement « 3 parties, 1 victoire ». Et ils fonctionnent pour
une entrée **sans score du tout** — Dnup ne distribue que des jetons — parce
qu'ils ne comptent que des parties et des victoires.

## La fiche de partie

**La grille complète, manche par manche.** C'est littéralement la *feuille de
score*, le nom du produit, et elle ne coûte rien : rien n'est stocké, le moteur
recalcule depuis les manches.

**Pas de courbe.** Le ticket 10 avait écarté la courbe manche par manche de
l'écran de fin en la renvoyant ici « si elle y trouve sa place » : elle ne la
trouve pas. La grille montre déjà la progression, en chiffres, et elle défile
latéralement à cinq joueurs — le prix que la variante C payait déjà au ticket 8.
Empiler une courbe par dessus ajoute un objet pour une information qu'on a.

**Le journal reste accessible** depuis le même tiroir `⋯` que sur une partie
vivante. Une partie scellée n'est pas une partie muette.

## L'historique

**Une ligne porte le jeu, la date, le vainqueur et le nombre de joueurs.** La
tablée complète et les scores sont sur la fiche : cinq choses sur une ligne de
téléphone, c'est une de trop.

- **Ordre** : la plus récente d'abord, par **date de fin** — celle-là même dont le
  rejeu de la note a besoin.
- **Filtre** : par jeu, et rien d'autre. Le filtre par joueur, c'est la fiche de
  joueur.
- **Pagination** : aucune numérotation. Un « voir plus » si le volume l'exige un
  jour, ce qui n'arrivera pas à dix joueurs.

Une **partie abandonnée y figure, marquée**, sans vainqueur : elle a eu lieu.

## Les parties abandonnées ne comptent nulle part

Le palmarès et la future note ne lisent que les parties **terminées**.

Une partie abandonnée n'a pas de vainqueur. La compter dans « parties jouées »
sans jamais la compter dans « victoires » creuserait le taux de chacun d'un
montant qui dépend de **qui a quitté la table**. Et la recherche classement avait
prévenu qu'une partie abandonnée qui compterait réécrit rétroactivement tout le
palmarès.

Elle reste visible dans l'historique, et ne pèse sur aucun agrégat.

## Les états vides

Les deux listes disent la même chose de deux façons : rien n'a encore été
terminé, et le catalogue est à un appui. C'est déjà ce que le ticket 9 a fait de
l'écran d'accueil quand aucune partie ne tourne, donc il n'y a pas d'écran vide à
inventer, seulement un renvoi.

Un palmarès dont tous les joueurs sont sous le plancher n'est pas un état vide :
tout le monde est hors classement, et c'est honnête.

## Ce que la note trouvera ici quand elle arrivera

Le ticket demandait de vérifier que les données affichées suffiraient à
l'alimenter, sans la concevoir. Elles suffisent :

- **Le classement de chaque partie terminée** se dérive de sa grille par le
  moteur, en groupes de rang, ce que le modèle Plackett-Luce prend directement.
- **La date de fin** donne l'ordre total de rejeu, dont la recherche a montré
  qu'il est load-bearing.
- **Rien n'est stocké en incrémental**, donc changer la formule ne demande aucune
  migration.

Un point d'attention à ne pas perdre : un participant **retiré** en cours de
partie ne figure pas au classement final, donc le vecteur de rangs qu'on passe à
la formule doit l'exclure aussi. Sinon la note verrait une défaite que le palmarès
ne voit pas.

## Ce que ça impose au schéma

À porter dans [Modèle de domaine et schéma Drizzle](https://github.com/Bryan21B/scoring-sheets/issues/15) : **rien de nouveau**. Tous les
agrégats de ce document se dérivent des parties, des manches et des participants,
et la date de fin était déjà exigée par le cycle de vie.

Le schéma a toutefois changé une chose **pour** ces pages : la fin d'une partie
est **estampillée** au lieu d'être dérivée. Sans cela, l'historique et le palmarès
auraient été des replis applicatifs sur toute la base, qu'aucun index n'accélère ;
avec, ce sont des requêtes ordinaires sur un index partiel. Voir
`docs/specs/2026-09-09-schema.md`.

## Ce qui n'est pas décidé ici

- **Le tête-à-tête** : ce qu'une page qui compare deux joueurs montre à dix
  personnes qui se croisent peu → reste dans le brouillard de la carte.
- **Un meilleur score par entrée** sur la fiche de joueur : la place existe
  désormais, la question devient « à trancher en dessinant l'écran », en gardant
  que Dnup n'a pas de score.
- **La forme des écrans** → à trancher en les dessinant.
