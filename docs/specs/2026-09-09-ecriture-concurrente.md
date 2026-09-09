# Écriture concurrente : ce qui est refusé, et ce que voit le perdant

- **Statut** : acceptée
- **Date** : 2026-09-09
- **Ticket** : [Écriture concurrente sur la même case : politique de conflit](https://github.com/Bryan21B/scoring-sheets/issues/12), sous la carte [Carte — feuille de score multi-appareils pour 6 qui prend, Uno et Dnup](https://github.com/Bryan21B/scoring-sheets/issues/1)

## Contexte

Deux contraintes venues d'ailleurs bornent entièrement ce document.

Le **transport** ([Transport temps réel sur Vercel + Turso](https://github.com/Bryan21B/scoring-sheets/issues/4),
`docs/research/2026-08-31-transport-temps-reel.md`) est un polling client à trois
secondes : rien n'est poussé, **il n'y a aucune présence**, et aucun client ne
sait qui d'autre est connecté ni qui saisit. Un verrou d'édition et un
avertissement « Léa modifie cette manche » sont donc **irréalisables**, pas
seulement écartés. La politique se joue **côté serveur, à l'écriture**, jamais
négociée entre clients.

La **passe avant** ([Qui pilote la passe avant](https://github.com/Bryan21B/scoring-sheets/issues/22)) a rendu la
concurrence ordinaire au lieu d'exotique : à 6 qui prend, l'entrée qu'on jouera
le plus, les cinq joueurs saisissent **chacun leur propre case** de la même
manche, en même temps et volontairement.

## La granularité, qui décide tout le reste

La recherche transport recommandait de conditionner l'écriture sur
l'**estampille de version de la partie**, celle que le poll lit déjà. La passe
avant a rendu cette granularité fausse : cinq saisies simultanées sur cinq cases
distinctes feraient échouer quatre écritures parfaitement légitimes, qui ne se
marchent pas dessus.

Deux situations, donc, et une seule est un conflit :

| | Conflit ? | Résultat |
|---|---|---|
| Deux écritures sur des **cases différentes** | non | les deux passent |
| Deux écritures sur la **même case** | oui | une passe, l'autre est refusée |

**L'estampille de version de la partie reste ce qu'elle est** : un compteur qui
rend le poll bon marché, une ligne lue au lieu de la partie entière. Elle n'est
**jamais** un jeton d'écriture.

## La condition

> Une case ne s'écrit qu'à condition de porter encore **la valeur qui a été
> montrée** à celui qui écrit.

Le **vide est une valeur** comme une autre, ce qui donne les deux régimes sans
les distinguer :

- **Saisir** une case qu'on croyait vide échoue si quelqu'un a devancé — on
  n'avait aucune intention d'écraser.
- **Corriger** un 8 en 12 échoue si le 8 est devenu autre chose — la décision
  reposait sur ce 8.

### Ce que cela ne refuse pas

**L'écrasement informé passe toujours.** Le ticket 8 avait posé qu'un appui
distrait réécrit un score acquis et que c'est le journal qui rattrape, pas
l'interface. Cela tient : quelqu'un qui voit la valeur courante et écrit par
dessus obtient ce qu'il demande, et le journal en garde la ligne.

Les deux règles se composent au lieu de se contredire. **L'interface arrête ce
qui repose sur une information périmée ; le journal garde ce qui repose sur une
information vraie.**

**Une écriture sans effet réussit en silence.** Si la valeur qu'on veut poser est
déjà celle de la case, la condition ne se vérifie pas : rien n'a bougé, rien ne
bouge, aucun écran. Le cas est réel — deux joueurs font le même constat à trois
secondes d'intervalle et corrigent vers la même valeur — et il serait absurde
d'annoncer un conflit dont le résultat est celui qu'on voulait.

## Ce que voit le perdant

L'affichage optimiste lui a déjà montré son 12. Le serveur refuse, le 12 doit
reculer, et **ce recul doit être compris** : un retour silencieux à 8 est
exactement le scénario que ce ticket existe pour éviter.

**Un écran arrête le geste.** Il montre la valeur arrivée, et garde la valeur
tapée sous la main pour la réappliquer d'un appui. Pas un bandeau : à la
trentième manche d'une soirée, un bandeau se rate.

**L'auteur n'est pas nommé.** « La case porte maintenant 8 » suffit à comprendre
et à décider. Nommer Léa demanderait au chemin d'écriture d'aller lire le journal
pour composer son message, alors que le journal est une trace qu'on consulte,
jamais une pièce du flux. Il est à un appui de là pour qui veut savoir qui.

## Deux conflits qui ne sont pas des conflits de case

### Ajouter deux fois la même manche

Le conflit le plus cher et le plus facile à provoquer, rendu plus probable encore
par la passe avant : deux personnes appuient sur « saisir la manche suivante » en
même temps, chacune démarrant sa séquence sur elle-même.

**Une manche est unique par partie et par numéro.** La seconde création ne crée
rien : elle **rejoint la manche que l'autre vient d'ouvrir**, et on y saisit sa
propre valeur. Ce n'est pas une erreur montrée à quelqu'un, c'est le résultat que
les deux voulaient. Aucune clé d'idempotence à fabriquer côté client : le numéro
de manche existe déjà, puisque les manches sont ordonnées.

### Clore deux fois

La clôture est une déclaration explicite depuis le ticket 22. Deux personnes
peuvent donc appuyer sur « clore la manche » à trois secondes d'intervalle, chacune
ignorant l'autre.

**Clore est idempotent.** Clore une manche déjà close ne fait rien et n'affiche
aucune erreur : le second voit l'écran de manche close, celui qu'il voulait. La
fin de partie s'en déduit **une seule fois**, puisqu'une seule clôture a
réellement écrit.

## Rien ne bouge sous les doigts

La question « ma valeur est-elle remplacée pendant que je tape » se dissout : la
passe avant **ne montre aucun total et aucune alerte**, donc elle n'a rien à
rafraîchir et **elle ne poll pas**. Le poll reprend au récapitulatif, où il y a
enfin quelque chose à voir bouger.

On apprend donc l'état du monde **à la validation**, et l'écran de refus le rend
lisible.

## Ce qui n'est pas journalisé

**Une écriture refusée n'entre pas au journal.** Il garde ce qui a bougé, pas ce
qui a failli bouger. Y verser les tentatives le rendrait bruyant précisément le
soir où on le consulte, alors qu'il n'est déjà pas la source de vérité.

## Ce que ça impose au schéma

À porter dans [Modèle de domaine et schéma Drizzle](https://github.com/Bryan21B/scoring-sheets/issues/15) :

- **Unicité sur le couple partie et numéro de manche.**
- **L'estampille de version par partie**, déjà exigée par la recherche transport,
  et dont ce document confirme qu'elle sert **au poll seulement**.
- Rien de plus pour la condition d'écriture : **la valeur de la case est son
  propre jeton**, il n'y a pas de colonne de version par case à ajouter.

## Ce qui n'est pas décidé ici

- **Supprimer une manche pendant que quelqu'un y écrit.** La suppression est un
  geste du cycle de vie → [Cycle de vie d'une partie](https://github.com/Bryan21B/scoring-sheets/issues/13).
- **Corriger après clôture de la partie**, et ce qu'une réouverture fait aux
  écritures en vol → même ticket.
- **Deux appareils qui réclament le même participant**, et les mouvements de
  participants concurrents → [Identité, lien de partage et arrivée](https://github.com/Bryan21B/scoring-sheets/issues/3) pour le
  vocabulaire, [Cycle de vie d'une partie](https://github.com/Bryan21B/scoring-sheets/issues/13) pour les gestes.
- **La forme exacte de l'écran de refus** → à trancher en le dessinant, comme le
  récapitulatif du ticket 8.
