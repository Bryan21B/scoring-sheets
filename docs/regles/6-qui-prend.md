# 6 qui prend — jeu de base

- **Entrée du catalogue** : `6-qui-prend`
- **Livret** : *Six qui Surprend*, Gigamic / AMIGO, édition 03-2019, 104 cartes
  Numéro + 28 cartes spéciales. Auteur Wolfgang Kramer.
- **Source** : <https://www.gigamic.com/plus-de-cinq-joueurs/517-six-qui-surprend-3421272418824.html>
  (le PDF de la fiche, `sha256 de6906ab…3854e`, non commité — voir
  [`docs/research/2026-08-31-urls-regles-officielles.md`](../research/2026-08-31-urls-regles-officielles.md))
- **Les 28 cartes spéciales ne servent pas ici.** Elles se mettent de côté pour
  le jeu de base ; leur règle est [`6-qui-prend-cartes-speciales`](6-qui-prend-cartes-speciales.md).

## But du jeu

Récolter le **moins** de têtes de bœuf possible. Chaque carte porte une valeur
numérique de 1 à 104, qui dit où elle se range, et de 1 à 7 têtes de bœuf, qui
sont des points de pénalité. **Le plus bas gagne.**

## Déroulement d'une manche

10 cartes par joueur, et 4 cartes retournées au centre pour amorcer 4 séries.
Tout le monde choisit une carte face cachée, puis on révèle : la plus faible se
pose en premier, la plus forte en dernier.

Une carte ne peut aller que dans **une seule** série : la suite croissante
(règle 1), et parmi les séries possibles, celle où l'écart avec la dernière
carte est le plus faible (règle 2). Une série qui atteint 5 cartes est terminée :
qui doit y déposer la 6ᵉ ramasse les 5 (règle 3). Qui joue une carte trop faible
pour aller nulle part ramasse la série de son choix (règle 4). Les cartes
ramassées vont dans une pile devant soi, jamais dans la main.

La manche s'arrête quand les 10 cartes sont jouées.

## Décompte

Le score d'une manche est le **nombre de têtes de bœuf ramassées**, par joueur.
Une seule règle de barème, lue sur le numéro de la carte :

| La carte | Têtes de bœuf |
|---|---|
| 55 | 7 |
| un doublet — 11, 22, 33, 44, 66, 77, 88, 99 | 5 |
| finit par 0 — 10, 20, 30… | 3 |
| finit par 5 — 5, 15, 25… | 2 |
| toutes les autres | 1 |

**55 est à la fois un doublet et un multiple de 5**, d'où ses 7 têtes : c'est la
seule carte du jeu qui cumule, et la valeur maximale. Un doublet finissant par 0
n'existe pas, donc les deux lignes du milieu ne se croisent jamais ailleurs.

## Fin de partie

Dès qu'un joueur **dépasse 66 têtes de bœuf** au cumul, la partie s'arrête à la
fin de la manche en cours. Le vainqueur est celui qui en a le moins.

Le livret autorise explicitement de **convenir d'un autre total avant de
commencer**, ou d'un nombre de manches maximum — c'est ce qui fonde la surcharge
de seuil par partie.

## Pièges

- **La règle du plus petit écart n'est pas un choix.** On croit poser où on veut
  parmi les séries croissantes ; la série est imposée. Se tromper de série fait
  ramasser une série entière au tour d'après, et personne ne le voit sur le coup.
- **La carte trop faible ne coûte rien par elle-même** — c'est la série ramassée
  qui coûte. On choisit donc la série la moins chère en têtes de bœuf, pas la
  plus courte.
- **Une série peut se vider avant votre tour.** Vous posez la 6ᵉ carte d'une
  série qu'un autre a déjà ramassée entre-temps : votre carte se retrouve
  ailleurs, souvent au pire endroit. Les cartes se révèlent toutes ensemble mais
  se posent dans l'ordre croissant, et cet intervalle est là où les manches se
  perdent.
- **Le livret ne réimprime pas la fourchette de joueurs** dans la section du jeu
  de base ; seule la variante affiche la sienne. Le catalogue porte 2–10, ce que
  le livret ne contredit pas mais ne confirme pas non plus — la boîte tranche.
