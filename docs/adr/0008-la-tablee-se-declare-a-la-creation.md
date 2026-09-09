# 0008 — La tablée se déclare à la création

- **Statut** : acceptée
- **Date** : 2026-09-09
- **Spec** : `docs/specs/2026-08-31-configuration-de-jeu.md`, `docs/specs/2026-08-31-identite-et-arrivee.md`
- **Ticket** : [Créer une partie et obtenir son code](https://github.com/Bryan21B/scoring-sheets/issues/27)

## Contexte

Deux décisions déjà prises se rencontrent au moment d'écrire l'écran de création,
et elles ne se rencontrent pas bien.

- **La partie fige un instantané complet des règles résolues** à son ouverture
  (ADR `0005`). Cet instantané est le seul rempart contre une édition
  rétroactive du barème, et `partie.regles` est `NOT NULL` : il n'y a pas de
  partie sans instantané.
- **Résoudre les règles demande un effectif.** `resoudreRegles` refuse hors de
  `[joueursMin, joueursMax]`, et applique `varianteSelonJoueurs` (nommé
  `finSelonJoueurs` à la date de cet ADR, élargi à la saisie par l'ADR `0009`) —
  à Dnup, deux joueurs se passent de jetons et jouent en manches gagnées.

Or **créer une partie, c'est y être**, et rien d'autre : le créateur est seul
participant à l'ouverture, les autres arrivent par le code. Un effectif déduit du
nombre de participants vaudrait donc toujours 1, c'est-à-dire toujours hors des
bornes de tous les jeux du catalogue.

Le ticket demande par ailleurs que la création soit **une suite de pages, une
question par écran**, et que le seuil soit **montré et pré-rempli à la valeur
imprimée, ni caché ni promu en étape**.

## Approches comparées

### A — Résoudre les règles au gel de la liste

L'instantané ne s'écrirait qu'à la première manche, quand l'effectif est connu
pour de bon.

Écartée. Elle rouvre l'invariant le plus cher du modèle : entre la création et la
première manche, la partie n'aurait pas de règles, donc pas de bornes de saisie,
pas de condition de fin, et `partie.regles` devrait devenir nullable. Le rempart
contre l'édition rétroactive du barème ne tiendrait plus sur « à l'ouverture »
mais sur « à un moment plus tard », ce qui est précisément la formulation qu'il
existe pour interdire.

### B — Déduire l'effectif du nombre de participants

Zéro question de plus à l'écran, et l'effectif se lit de la table `participant`.

Écartée : il vaut 1 à la création, et 1 est hors bornes partout. Il faudrait
alors ne pas vérifier les bornes à la création — c'est-à-dire supprimer un
critère d'acceptation plutôt que le tenir.

### C — Demander l'effectif, montrer le seuil à côté *(retenue)*

Le troisième écran demande **« vous êtes combien ? »**, et affiche le seuil
en dessous, **pré-rempli** à la valeur imprimée pour cet effectif.

## Décision

**Le troisième écran de la création est la tablée : le nombre de joueurs, et le
seuil pré-rempli à côté.**

Une question par écran est tenue : la question de l'écran est l'effectif. Le
seuil n'est **pas promu en étape** — il est montré, déjà rempli, et se surcharge
d'un entier ≥ 1 pour qui veut.

Le seuil **suit l'effectif tant que personne n'y a touché**, et se tait dès
qu'on l'a tapé. C'est la seule raison pour laquelle cet écran est un composant
client : sans ça, ouvrir Dnup à deux joueurs afficherait « 4 jetons », une règle
qui ne sera jamais appliquée.

**L'effectif déclaré n'est pas une liste de participants.** Il dit combien vous
serez, il fige les règles, et il ne crée personne : les autres joueurs arrivent
par le code, en salle d'attente. C'est un nombre, pas un roster.

## Conséquences

- **La création est refusée hors des bornes du jeu**, ce qui est le critère
  demandé, et le refus est **sec** : la phrase de `resoudreRegles` s'affiche
  au-dessus du formulaire, et rien n'est écrit.
- **Le seuil imprimé est juste dès le premier affichage**, `varianteSelonJoueurs`
  compris.
- **Prix assumé : l'effectif déclaré peut mentir.** Annoncer cinq et jouer à
  quatre fige les règles de cinq. C'est cohérent avec « le nombre de joueurs est
  lu une fois à l'ouverture » — un joueur qui arrive ou s'en va ne fait pas
  basculer la condition de fin en plein jeu — mais cela veut dire que l'effectif
  est une **déclaration**, comme l'identité. Si le réel montre qu'on se trompe
  souvent, c'est ici qu'il faudra revenir, pas dans le moteur.
- **`finImprimee` est le seul endroit qui relit `varianteSelonJoueurs` pour
  l'affichage**, et il passe par `resoudreRegles` : deux lectures de la même
  surcharge divergeraient le jour où l'une est corrigée seule.
