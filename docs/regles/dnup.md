# Dnup

- **Entrée du catalogue** : `dnup`
- **Livret** : *dnup RULES*, Asmodee Group SAS, © 2026. Auteurs Kei Kajino et
  Gilles-Romain Fontenay. 40 cartes, 5 cartes d'aide, **16 jetons lettre**.
- **Source** : <https://www.dnup.game/fr/> — le livret local est la version
  anglaise, `rules/rules_en.pdf` (`sha256 b64b58e0…02db`), non commité.
- **PDF sans couche texte** : deux pages d'images, lues visuellement.

## But du jeu

Se débarrasser le premier de ses cartes à chaque manche. Le score ne se compte
pas en points mais en **jetons lettre**, et il en faut 4 pour gagner.
**Le plus haut gagne.**

La particularité du jeu : chaque carte porte **deux valeurs**, une active et une
inactive, tête-bêche. Toute carte reprise en main se **retourne à 180°** — sa
valeur inactive devient active. C'est la règle d'or, et c'est de là que vient le
nom.

## Déroulement d'une manche

On retire des cartes selon le nombre de joueurs — rien à 5, un symbole à 4, deux
à 3 — et on distribue **tout le paquet**. Les cartes gardent l'orientation qu'on
leur a trouvée : on peut réordonner sa main, jamais la retourner.

Un **set** est une ou plusieurs cartes de même valeur active. Sa *valeur* est
cette valeur ; sa *taille* est le nombre de cartes. Le joueur qui tient la carte
1/5 marquée d'une étoile ouvre la manche, puis on tourne dans le sens horaire.

À son tour : **défausser** ce qu'on avait posé au tour précédent, puis faire
**exactement une** de ces quatre actions.

| Action | Effet |
|---|---|
| Poser un set devant soi | face à un set de **même taille** déjà sur la table, il faut une **valeur supérieure** ; le battu reprend son set en main, en le retournant |
| Ajouter 1 carte au set d'un adversaire | la carte doit **égaler la valeur** du set ; si le set agrandi égale la taille d'un autre, il doit le dépasser en valeur, sinon le plus faible est repris |
| Prendre le set d'un adversaire | il rejoint votre main, cartes retournées |
| Retourner toute sa main | les valeurs actives et inactives s'échangent |

Un set d'une taille encore absente de la table se pose **quelle que soit sa
valeur**. Poser un set n'oblige pas à y mettre toutes ses cartes de cette valeur.

## Décompte

Il n'y a **pas de points**. Une manche distribue des jetons lettre, et rien
d'autre :

| Rang à la sortie | Jetons lettre |
|---|---|
| 1ᵉʳ à poser sa dernière carte | **2** |
| 2ᵉ | **1** |
| tous les autres | 0 |

Le premier sorti ne joue plus de la manche, mais **ses cartes restent devant lui
un tour de table** avant d'être défaussées : un set de valeur supérieure peut
encore les battre pendant ce temps, et elles sont alors simplement défaussées.
Dès qu'un deuxième joueur se débarrasse de sa dernière carte, **la manche
s'arrête immédiatement** — les suivants ne sortent pas.

La saisie d'une manche n'est donc **pas un nombre** : on désigne un premier et un
deuxième, et les jetons sont un résultat. L'ensemble `{0, 1, 2}` n'est jamais une
saisie valide.

## Fin de partie

**Le premier à 4 jetons lettre** gagne, immédiatement.

**Sauf à 2 joueurs, où les jetons n'existent pas.** Le jeu à deux est une variante
à part : on retire les cartes de trois symboles, chaque joueur pose deux cartes
d'aide de la même couleur pour se faire **deux zones de jeu**, et joue **deux
tours consécutifs** par tour de table, un par zone. Ses propres sets peuvent donc
entrer en conflit entre eux comme avec ceux de l'adversaire. Le joueur à l'étoile
n'a **qu'un seul tour** au premier tour de table. Poser sa dernière carte gagne
la manche sur-le-champ, et **le premier à 2 manches gagnées** gagne la partie.

C'est la seule entrée du catalogue dont les **règles changent avec le nombre de
joueurs**, ce que porte le champ `varianteSelonJoueurs` : à deux, la fin devient
`manchesGagnees 2` **et** le barème tombe à `[0]` — on désigne toujours celui qui
sort, puisque c'est lui qui gagne la manche, mais sa sortie ne rapporte aucun
jeton.

## Pièges

- **Compter en points.** Il n'y en a pas. Le seul nombre d'une manche est un
  rang, et deux rangs seulement sont payants.
- **Le deuxième sorti arrête tout.** Les joueurs restants ne finissent pas la
  manche, il n'y a ni troisième ni dernier — donc rien à saisir pour eux.
- **Les cartes du premier sorti restent battables un tour.** Elles ne quittent la
  table qu'au tour suivant, et une manche peut encore bouger après sa sortie.
- **À deux, il n'y a pas de jetons du tout.** Une feuille qui compterait des
  jetons à deux joueurs compterait une partie qui n'existe pas.
- **La règle d'or vaut à chaque reprise en main**, sans exception : set battu,
  set pris, carte reprise. Oublier de retourner change la valeur d'une carte, et
  personne ne peut le vérifier après coup.
