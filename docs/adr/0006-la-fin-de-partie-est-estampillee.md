# 0006 — La fin d'une partie est estampillée, seule exception à « rien de calculé n'est stocké »

- **Statut** : acceptée
- **Date** : 2026-09-09
- **Specs** : `docs/specs/2026-09-09-schema.md`, `docs/specs/2026-09-09-cycle-de-vie.md`

## Contexte

Tout le modèle repose sur un principe tenu avec discipline : **rien de ce que le
moteur calcule n'est stocké**. Les totaux, le gagnant d'une manche, le classement,
la complétude, le gel de la liste des participants, les manches jouées et gagnées
— tout se recalcule à chaque lecture, et rien ne peut donc se désynchroniser.

Le cycle de vie a d'abord appliqué le principe jusqu'au bout : une partie est
« terminée » quand le moteur dit `fini`, et seul l'abandon, qui est une action, se
stocke.

**Le prix n'est apparu qu'en dessinant les index.** Savoir si une partie est
terminée demande de faire tourner le moteur, donc de charger toutes ses manches et
toutes ses saisies. L'historique et le palmarès cessent alors d'être des requêtes
SQL : ce sont des **replis applicatifs sur l'intégralité de la base**, qu'aucun
index n'accélère, par construction. Et la date de fin qui ordonne l'historique est
elle-même un maximum sur les clôtures de manches.

À dix joueurs, c'est sans douleur. C'est le genre de coût qui va bien jusqu'au
jour où il ne va plus, et la réparation d'alors est une migration.

## Décision

**Estampiller la fin d'une partie dans la transaction qui la provoque.**

`partie` porte `fin_le`, `fin_cause` — `terminee` ou `abandonnee` — et `fin_par`,
les trois absents ou présents ensemble, garantis par un `CHECK`, et effacés
ensemble par la **reprise**.

Deux arguments, et le second est le vrai.

1. **L'écriture qui clôt la manche calcule déjà `fini`**, puisqu'il lui faut
   décider si elle montre l'écran de fin. L'estampiller là n'ajoute aucun calcul.
2. **Ce n'est pas stocker un état continu, c'est enregistrer un événement
   ponctuel** — exactement ce que la clôture d'une manche fait déjà. La distinction
   est celle-là, et pas « dérivé contre stocké ».

## Pourquoi elle ne peut pas diverger

Une partie terminée est **scellée** : aucune saisie, aucune correction, aucune
suppression de manche, aucun mouvement de participant, définitivement. Les manches
ne bougeant plus, `fini` ne peut plus changer, donc la valeur stockée reste égale
au calcul pour toujours.

C'est le scellement qui rend l'exception sûre. **Si un jour le scellement tombe,
cette décision tombe avec lui** et doit être reprise.

## Conséquences

- **L'index partiel `partie(fin_le DESC) WHERE fin_le IS NOT NULL` devient
  possible**, et c'est lui qui rend l'historique et le palmarès ordinaires.
- **Le classement multijoueur y trouve directement son ordre de rejeu**, dont la
  recherche a montré qu'il est load-bearing : deux historiques rejoués dans un
  ordre différent donnent des notes différentes. L'identifiant entier monotone de
  la partie départage les dates à égalité.
- **Estampiller n'est pas journaliser.** La fin n'est pas un geste du journal :
  personne ne l'a *faite*, elle est la conséquence de la clôture d'une manche.
  L'abandon, lui, en est un.
- **C'est la seule exception, et elle est écrite comme telle** dans le spec du
  schéma. Un lecteur futur trouvera une colonne dérivable au milieu d'un modèle qui
  n'en a aucune ; ce document existe pour qu'il ne la « nettoie » pas.
