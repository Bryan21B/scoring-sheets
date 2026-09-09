# Cycle de vie d'une partie : abandon, reprise, correction, fin

- **Statut** : acceptée
- **Date** : 2026-09-09
- **Ticket** : [Cycle de vie d'une partie : abandon, reprise, correction, fin](https://github.com/Bryan21B/scoring-sheets/issues/13), sous la carte [Carte — feuille de score multi-appareils pour 6 qui prend, Uno et Dnup](https://github.com/Bryan21B/scoring-sheets/issues/1)

## Contexte

Une soirée de cartes n'est pas propre : on s'arrête au milieu, on se trompe d'une
manche, quelqu'un rentre chez lui, on ne finit jamais. Ce document dit quels
états une partie traverse et quels gestes chacun autorise.

Deux décisions récentes le contraignent plus que le cadrage d'origine. Le ticket
22 a fait de la **clôture d'une manche un acte déclaré**, là où le spec de
configuration la confondait avec la complétude. Le ticket 9 a fait de
**l'accueil la partie en cours**, ce qui donne à une partie morte le pouvoir de
squatter l'écran principal.

## Les trois états

Une partie porte une **fin**, absente ou présente. Il n'y a pas de colonne de
statut à trois valeurs.

| État | Comment il se lit | Ce qu'on peut y faire |
|---|---|---|
| **En cours** | pas de fin | tout |
| **Terminée** | `fini` est devenu vrai, et la fin a été **estampillée** | rien, elle est **scellée** |
| **Abandonnée** | un abandon **déclaré** — stocké | la **reprise**, et rien d'autre |

**Les deux causes s'écrivent, chacune pour sa raison.** L'abandon est une action :
rien ne le déduit. La fin régulière, elle, est **estampillée par l'écriture qui la
provoque** — celle qui clôt la manche, et qui calcule déjà `fini` pour savoir si
elle montre l'écran de fin.

Ce document posait d'abord « terminée est dérivée ». Le schéma a montré le prix :
sans estampille, l'historique et le palmarès cessent d'être des requêtes SQL. Voir
« Corrigé après coup ».

Une partie ouverte trois semaines et jamais finie est simplement **une partie
sans fin**. Ni terminée, ni abandonnée, jusqu'à ce que quelqu'un tranche.

## Ce que le moteur lit

Le ticket 22 a séparé deux mots que le spec de configuration confondait, et le
moteur doit choisir lequel il lit.

- **Les totaux lisent tout**, y compris une manche en cours de saisie. Trois
  joueurs sur cinq ont saisi, les compteurs bougent déjà.
- **`fini`, `manchesJouees` et `manchesGagnees` lisent les manches closes**, et
  elles seules.

« Totaux vivants, fin figée » survit intact, avec une frontière plus nette
qu'avant : on voit le seuil arriver, et la partie ne ferme qu'à un acte humain.

**Clore la manche est donc la confirmation de fin de partie.** Il n'y a pas de
second écran « voulez-vous terminer » : quelqu'un vient déjà d'agir, et lui en
demander deux fois serait le punir d'avoir compté. La fin en nombre de manches
fixe — la variante cartes spéciales et ses deux manches exactement — passe par la
même porte, sans rien de spécial.

**Conséquence sur le contrat du moteur** : `evaluer(regles, manches)` doit
recevoir la clôture de chaque manche. C'est une entrée de plus, pas un état de
plus.

## Corriger, et ce qu'on renonce à corriger

**Une partie terminée est scellée.** Aucune saisie, aucune correction, aucune
suppression de manche, aucun mouvement de participant. Définitivement.

Le prix est réel et assumé : **une erreur découverte le lendemain sur une partie
terminée y reste pour toujours**, et le palmarès la portera. On l'accepte parce
que l'alternative — rouvrir une partie qui alimente déjà un palmarès et un
classement — coûte plus cher que l'erreur qu'elle répare, à dix joueurs entre
amis.

Le seul recours contre une valeur fausse est de la corriger **avant** de clore la
manche qui termine la partie. C'est précisément ce que le récapitulatif du ticket
8 rend possible, et pourquoi la clôture y est un geste séparé.

**« Scellée » n'est pas « gelée ».** Le *gel* ferme la liste des participants à la
première manche ; le *scellement* ferme la partie entière à sa fin. Deux mots,
deux portées.

## Abandonner, et reprendre

**L'abandon existe**, et remplit la place que le journal lui avait réservée. Il
termine une partie sans vainqueur.

Sans lui, une partie morte depuis trois semaines squatte l'écran d'accueil, et la
seule sortie serait la suppression, qui détruirait le journal. **L'abandon est le
balai.**

- **N'importe quel participant abandonne**, comme pour tout le reste.
- **Depuis le tiroir `⋯`**, celui qui porte déjà le journal : ce n'est pas un
  geste de tous les soirs.
- **Une confirmation**, une seule. C'est le seul geste de la partie qui agit sur
  ce que les quatre autres voient sans qu'ils l'aient demandé.

**La reprise efface l'abandon** et rend la partie en cours. Elle n'existe **que**
pour une partie abandonnée : une partie régulièrement terminée ne se rouvre pas.
Vouloir continuer au-delà du seuil, c'est vouloir changer le seuil, et
l'instantané de règles est figé à la création exprès.

Le **gel des participants survit à la reprise** : il se déduit de l'existence
d'une manche, que l'abandon n'a pas effacée.

### Deux gestes de plus au journal

`abandon` et `reprise` entrent au journal, en paire. Ils ne portent pas de case,
mais `participantAjoute` et `participantRetire` n'en portent pas non plus : la
forme existe déjà.

Ce sont les deux seuls gestes qui changent **ce que les quatre autres ont le
droit de faire**, et c'est exactement ce qu'on vient lire dans un journal. Sans
eux, il montrerait une partie qui recommence à bouger sans dire pourquoi elle
avait cessé.

## Annuler une manche

Le journal a déjà tout dit sur la trace : **une** ligne, qui emporte toutes les
valeurs effacées. Le ticket 12 a posé qu'une manche est unique par partie et par
numéro. Reste la numérotation.

**Un trou reste, les numéros ne se réutilisent jamais.** Supprimer la manche 2 sur
cinq laisse 1, 3, 4, 5. Renuméroter réécrirait des références que le journal a
figées, et le trou est lui-même une information : il s'est passé quelque chose.
La manche suivante est le plus grand numéro plus un.

**Les totaux n'ont rien à faire de spécial** : rien n'est stocké, tout se
recalcule à la lecture suivante.

Supprimer la **manche 1** dégèle la liste des participants — le détour imposé par
la spec d'identité quand on a oublié quelqu'un — et c'est pour ce trou que le
journal enregistre les mouvements de participants dès qu'il est non vide.

## Le joueur qui s'en va

Paul rentre chez lui à la manche 4 sur 10. **Le retirer est permis après le gel**,
ce que le journal anticipait déjà avec `participantRetire`.

- **Ses valeurs déjà saisies restent.** Le journal les a vues ; l'histoire est
  vraie et ne se réécrit pas.
- **Il cesse de compter dans la complétude** des manches suivantes, donc la table
  peut finir sans lui.
- **Il ne figure pas au classement final.** Il n'a pas fini la partie.

Ce dernier point ferme un trou qu'on ne voit qu'en y regardant : le laisser au
classement avec des zéros le ferait **gagner à 6 qui prend en partant tôt**,
puisque le plus bas gagne.

## Supprimer une partie

**Une partie se supprime tant que son journal est vide, jamais après.**

Le journal est append-only et jamais purgé, tenu par des déclencheurs : c'est le
seul invariant dur du modèle, et une suppression qui emporterait ses lignes y
ferait un trou. Mais une partie créée par erreur, encore en salle d'attente et
sans une seule manche, n'a rien à protéger — son journal est vide **par
construction**, puisqu'on ne journalise pas les mouvements de participants tant
qu'il l'est.

Passé la première manche, la sortie est l'abandon. L'invariant reste entier sans
qu'on ait eu à inventer une suppression douce.

## Les ex æquo à la fin : déjà répondu ailleurs

Le ticket posait « deux joueurs franchissent 66 sur la même manche, qui gagne ».
La question se dissout sur deux décisions antérieures.

**Le seuil se franchit toujours par le total le plus haut**, quel que soit le sens
du classement. Deux joueurs qui passent 66 ensemble à 6 qui prend ne sont donc pas
à égalité : c'est le plus bas des deux qui gagne, et `direction` a fait son
travail.

**Une vraie égalité en tête ne se départage jamais** : rangs en groupes, même
marche de podium, rang suivant sauté. Il n'y a aucune règle de départage par jeu
à concevoir, ni ici ni ailleurs.

Reste ce qu'une victoire partagée fait au palmarès →
[Historique et palmarès](https://github.com/Bryan21B/scoring-sheets/issues/14).

## Ce que ça impose au schéma

À porter dans [Modèle de domaine et schéma Drizzle](https://github.com/Bryan21B/scoring-sheets/issues/15) :

- **Une fin par partie** : date, cause (`terminee` ou `abandonnee`) et auteur,
  les trois absents ou présents ensemble, et effacés ensemble par la reprise.
- **Une date sur la clôture d'une manche**, pas seulement un booléen : c'est elle
  qui date la fin de la partie pour le classement.
- **Un retrait par participant**, qui le sort de la complétude et du classement
  final sans effacer ses valeurs.
- Deux gestes de plus au journal : `abandon`, `reprise`.

## Ce qui n'est pas décidé ici

- **Si les parties abandonnées comptent au palmarès** → [Historique et palmarès](https://github.com/Bryan21B/scoring-sheets/issues/14).
- **Ce qu'une victoire partagée fait au palmarès** → même ticket.
- **La forme des écrans** d'abandon et de reprise → à trancher en les dessinant.

## Corrigé après coup

- **2026-09-09** — « terminée » ne se dérive plus, elle est **estampillée** dans
  la transaction qui clôt la dernière manche. Motif découvert en dessinant les
  index : dérivée, elle obligeait l'historique et le palmarès à faire tourner le
  moteur sur toute la base à chaque affichage, ce qu'aucun index n'accélère.
  L'écriture qui clôt la manche calculant déjà `fini`, l'estampiller n'ajoute
  aucun calcul, et le **scellement** garantit que la valeur stockée ne peut jamais
  diverger. Tranché par [Modèle de domaine et schéma Drizzle](https://github.com/Bryan21B/scoring-sheets/issues/15),
  détaillé dans `docs/specs/2026-09-09-schema.md`.
