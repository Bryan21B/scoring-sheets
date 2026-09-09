# 0009 — Une variante selon l'effectif, et non une surcharge de fin

- **Statut** : acceptée
- **Date** : 2026-09-09
- **Spec** : `docs/specs/2026-08-31-configuration-de-jeu.md`
- **ADR liés** : `0005` (configuration déclarative), `0008` (la tablée se déclare à la création)
- **Ticket** : [Dnup à deux joueurs fige des jetons qui n'existent pas](https://github.com/Bryan21B/scoring-sheets/issues/42)

## Contexte

Le catalogue portait `finSelonJoueurs`, une table qui remplaçait **la seule
`fin`** à certains effectifs. Elle a été écrite pour Dnup, dont le livret dit
qu'à deux joueurs la partie se gagne à deux manches et non à quatre jetons.

Le livret dit aussi autre chose, et personne ne l'avait porté en code : **à deux,
les jetons n'existent pas**. Dnup à deux est une variante à part — deux zones de
jeu, deux tours consécutifs, et poser sa dernière carte gagne la manche
sur-le-champ. Il n'y a ni deuxième sorti ni barème.

Résolu à deux joueurs, Dnup sortait donc avec la bonne fin et le mauvais barème :

```json
{"saisie":{"mode":"podium","jetons":[2,1]},"fin":{"type":"manchesGagnees","valeur":2}}
```

Passé au moteur sur deux manches gagnées par la même personne, `evaluer` rendait
des totaux de 4 et 2 — les jetons d'une variante qui n'en distribue aucun.

Ce qui rend le défaut urgent plutôt que cosmétique, c'est **l'instantané**. La
partie fige ses règles à la création (ADR `0005`), précisément pour qu'une
correction du catalogue ne réécrive jamais une partie passée. Une partie Dnup à
deux ouverte avec ce barème l'aurait porté **définitivement** : aucun correctif
ultérieur ne la rattrape.

Corriger dans le moteur est exclu par construction : sa signature ne reçoit pas
le nombre de joueurs, et c'est le seul dispositif qui protège « un moteur
unique » contre la première urgence.

## Approches comparées

### A — Ajouter `saisieSelonJoueurs` à côté de `finSelonJoueurs`

Une deuxième table, de même forme, indexée par le même effectif.

Écartée. Le fait déclaré est *un* : « à deux, Dnup est un autre jeu ». L'écrire
dans deux tables séparées, c'est laisser corriger l'une sans l'autre — exactement
le défaut qu'on est en train de réparer, rouvert pour le champ suivant. Et
`AGENTS.md` le dit déjà pour les types : deux déclarations de la même chose
divergent le jour où l'une est corrigée seule.

### B — Un objet de variante par effectif *(retenue)*

Une seule table, `varianteSelonJoueurs`, dont la valeur est **ce que cet effectif
change** : la saisie, la fin, ou les deux.

Un effectif nomme une variante, une variante se déclare d'un bloc, et la
résolution la lit d'un seul coup. Le champ suivant qui devrait varier s'ajoute
dans l'objet, pas dans une troisième table.

### C — Brancher sur le nombre de joueurs dans le moteur

Écartée par le cadrage du moteur (ticket 26) : sa signature ne reçoit que des
règles déjà résolues, et rien qui dépende encore de l'effectif.

## Décision

**Le catalogue déclare `varianteSelonJoueurs: Record<number, { saisie?, fin? }>`,
et `resoudreRegles` en applique chaque champ à la place du sien.**

- **Les champs surchargeables sont énumérés**, pas ouverts : la direction du
  classement et les bornes de joueurs ne dépendent d'aucun effectif, et une
  variante n'a pas à déplacer sous les pieds de la résolution les bornes qu'elle
  vient de vérifier.
- **La variante reste du côté catalogue.** `Regles` ne la connaît pas, son schéma
  est strict, et l'instantané ne peut donc pas l'emporter en base. C'est la même
  discipline que `finSelonJoueurs` tenait, et deux tests la gèlent :
  l'instantané n'a que ses cinq clés, et `parseRegles` refuse la table.
- **La surcharge de seuil s'applique après**, sans changer le type de fin : « on
  s'arrête à 3 » à deux joueurs vaut trois manches gagnées, pas trois jetons.

### Le barème à deux joueurs est `[0]`, et non `[]`

La saisie reste un `podium` : on **désigne** toujours quelqu'un — celui qui pose
sa dernière carte gagne la manche — et cette désignation est ce qui fait avancer
les manches gagnées. Ce qu'elle ne fait plus, c'est rapporter : un seul rang, qui
vaut zéro jeton.

Un barème vide dirait la même chose au décompte et une bêtise à la complétude :
`estComplete` dérive du barème, donc `[]` rendrait **toute** manche complète, y
compris une manche vide, et laisserait clore une manche que personne n'a gagnée.
`[0]` garde « une manche à deux attend une désignation, et rien d'autre ».

## Recensement des parties existantes

Le ticket demande que les parties déjà figées avec la mauvaise `saisie` soient
recensées. Elles l'ont été : **il n'y en a aucune, nulle part.**

- **Un seul chemin d'écriture.** `creerPartie` (`src/lib/partie/creation.ts`) est
  le seul endroit qui insère dans `partie`, et il est arrivé sur `main` le
  2026-09-09, quelques heures avant ce correctif.
- **Aucune base locale.** `DATABASE_PATH` vaut `./data/app.db` par défaut, `/data`
  est ignoré par Git, et le dossier n'existe dans aucun clone de travail : aucun
  fichier SQLite dans l'arbre. Les tests unitaires ouvrent une base jetable.
- **Aucun déploiement abouti.** Les seize déploiements enregistrés sur le dépôt
  finissent **tous en `failure`**, le dernier compris : l'écran de création n'a
  jamais été servi depuis `main`, donc aucune partie n'a pu y être ouverte. Si
  une instance existait hors de cette voie, c'est le paragraphe suivant qui
  s'applique.

**Décision : pas de migration, pas de script de correction.** Écrire une
migration pour zéro ligne, c'est ajouter du code à maintenir et une occasion de
réécrire des instantanés — ce que l'instantané existe pour empêcher.

**Si une telle partie apparaissait** — un environnement oublié, une base
restaurée — la réparation ne serait pas automatique. Une partie Dnup à deux dont
`regles.saisie.jetons` vaut `[2, 1]` se corrige à la main en `[0]` **si et
seulement si** elle n'est pas scellée : les totaux se recalculant à chaque
lecture, il n'y a rien d'autre à reprendre. Une partie scellée, elle, reste comme
elle est : son décompte a été lu et accepté par la table, et le réécrire après
coup serait la seule chose que le scellement interdit.

## Conséquences

- **Dnup à deux joueurs se fige juste** : `{ mode: "podium", jetons: [0] }` et
  `manchesGagnees 2`. À trois joueurs et plus, rien ne bouge : `[2, 1]` et le
  seuil de 4 jetons.
- **Le renommage est complet.** `finSelonJoueurs` n'existe plus : le champ, les
  tests, `AGENTS.md`, le digest Dnup, la spec `2026-08-31` et les mentions de
  l'ADR `0008` nomment tous `varianteSelonJoueurs`. Un id de catalogue ne se
  renomme jamais ; un champ de configuration, si — aucune partie n'en garde de
  trace, puisqu'il n'entre pas dans l'instantané.
- **`finImprimee` continue de passer par `resoudreRegles`** et reste juste sans
  rien savoir de la variante.
- **Le prix, inchangé : une correction de barème ne rattrape pas les parties
  ouvertes.** C'est ce qui rend ce genre de défaut urgent — il se répare avant la
  première vraie partie, ou plus du tout.
