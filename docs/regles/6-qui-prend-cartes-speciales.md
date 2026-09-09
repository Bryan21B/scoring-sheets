# 6 qui prend — variante avec les cartes spéciales

- **Entrée du catalogue** : `6-qui-prend-cartes-speciales`
- **Livret** : le même que le jeu de base — *Six qui Surprend*, Gigamic / AMIGO,
  édition 03-2019. La variante est une **section** de ce livret, pas un produit :
  elle n'a pas d'URL éditeur à elle, et c'est ce fichier qui la distingue.
- **Source** : <https://www.gigamic.com/plus-de-cinq-joueurs/517-six-qui-surprend-3421272418824.html>
  (`sha256 de6906ab…3854e`)
- **Base commune** : [`6-qui-prend`](6-qui-prend.md). Tout ce qui suit s'ajoute,
  rien ne se retire.

## But du jeu

Identique au jeu de base — le moins de têtes de bœuf gagne — mais la partie tient
en **deux manches**, et sept cartes spéciales permettent d'échapper à une série
qu'on aurait dû ramasser.

## Déroulement d'une manche

**2 à 8 joueurs.** Cartes Numéro et cartes spéciales mélangées séparément :
**12 cartes Numéro et 3 cartes spéciales** par joueur, 4 cartes Numéro au centre
pour les 4 séries, le reste des Numéro retourne dans la boîte. Les cartes
spéciales non distribuées forment une pioche.

Le tour se joue comme au jeu de base. Une carte spéciale se joue **avant** de
poser sa carte Numéro révélée, puis se défausse face visible.

| Carte spéciale | Effet |
|---|---|
| 5ᵉ série | ouvre une 5ᵉ série avec votre carte Numéro ; impossible s'il y en a déjà 5 |
| 7 qui prend | la série accepte une 6ᵉ carte ; c'est la 7ᵉ qui la fait ramasser |
| Insérer | placez votre carte au milieu d'une série, dans l'ordre croissant |
| Remplacer | reprenez votre carte révélée en main et posez-en une autre |
| Glisser | déplacez une carte Numéro vers une autre série avant de poser la vôtre |
| Stop | bloque une série : plus personne n'y ajoute, n'en retire, ni ne la ramasse |
| Négatif = Positif | en ramassant, annule des têtes de bœuf de votre total |

Quatre exemplaires de chaque. En ramassant une série, on peut échanger une carte
spéciale contre une de la pioche.

## Décompte

Le barème des têtes de bœuf est **celui du jeu de base**, sans changement :
55 vaut 7, un doublet 5, un multiple de 10 vaut 3, un multiple de 5 vaut 2, tout
le reste 1.

Une seule carte touche au score, **Négatif = Positif** : en ramassant une série,
elle transforme les têtes de bœuf d'une carte de cette série en points positifs.
On annule de son total autant de têtes de bœuf que la carte choisie en affiche,
en retirant des cartes de sa pile — de la série en cours ou d'une série ramassée
plus tôt.

**L'excédent est perdu** quand on n'a pas assez de têtes de bœuf à annuler. Une
manche ne descend donc jamais sous zéro : la borne basse `0` de la saisie est une
règle du jeu, pas une précaution d'interface.

## Fin de partie

**Exactement deux manches**, jamais un seuil. La première s'arrête quand tous ont
joué leurs cartes Numéro ; on redistribue 12 Numéro et 3 cartes spéciales de
plus — en gardant celles qui restent en main, et en en donnant moins à tout le
monde s'il n'y en a pas assez — puis on joue la seconde.

Le total des deux manches désigne le vainqueur, le plus bas. **Le livret prévoit
explicitement plusieurs vainqueurs en cas d'égalité** : les ex æquo ne se
départagent pas.

## Pièges

- **La fourchette de joueurs n'est pas celle du jeu de base.** Le livret imprime
  « pour 2 à 8 joueurs » sur la variante. Le catalogue porte 2–10, hérité du jeu
  de base par spread : **à corriger en 2–8**.
- **Deux manches, pas un seuil de 66.** C'est la seule des quatre entrées dont la
  fin ne se lit pas sur un total, et l'erreur naturelle est de la faire durer.
- **Le score d'une manche peut baisser en cours de manche**, par Négatif =
  Positif, sans jamais passer sous zéro. Une saisie qui se contenterait de
  cumuler des ramassages donnerait un total trop haut.
- **Stop est limité à deux sur la table**, et les cartes Stop se retirent dès
  qu'un joueur ramasse une série.
- **Le livret se contredit sur un nom.** La liste du contenu annonce une carte
  « Échange » ; la règle et la carte l'appellent **Glisser**. Même carte.
