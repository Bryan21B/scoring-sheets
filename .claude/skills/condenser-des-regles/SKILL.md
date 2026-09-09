---
name: condenser-des-regles
description: Condense un livret de règles de jeu de société en un digest court dont le cœur est le décompte des points. Utiliser quand une entrée du catalogue a besoin de son digest, quand un livret vient d'être retéléchargé chez l'éditeur, ou quand quelqu'un demande « ce qu'il faut retenir » d'une règle.
---

Un digest de règles n'est pas un résumé. C'est **la référence de décompte de
l'app**, plus le peu de contexte qui rend ce décompte lisible à quelqu'un qui a
la boîte ouverte devant lui. Tout ce qui ne sert ni à compter les points ni à
savoir quand la partie s'arrête est du remplissage.

Le digest alimente le champ `rulesDigestPath` d'une entrée du catalogue. Il vit
dans `docs/regles/<id>.md`, où `<id>` est l'identifiant de l'entrée.

## 1. Ouvrir le livret

Un PDF d'éditeur est de l'une de deux formes, et on ne sait pas laquelle avant
d'essayer :

```bash
pdftotext -layout livret.pdf sortie.txt && wc -c sortie.txt
```

- **Sortie substantielle** — il y a une couche texte, elle fait foi.
- **Sortie quasi vide** (quelques octets) — le PDF est une suite d'images sorties
  de Photoshop. Le lire alors **visuellement**, page par page, avec l'outil de
  lecture de PDF. Ne pas chercher d'OCR : la lecture visuelle est plus fiable sur
  des livrets illustrés, où le barème vit souvent dans une infographie.

Les notices multilingues sortent **en colonnes côte à côte** sous `-layout`.
Isoler la bonne langue en coupant les colonnes plutôt qu'en lisant en diagonale :

```bash
grep -n "DÉCOMPTE\|POINTAGE\|500" sortie.txt          # repérer la zone
sed -n '195,240p' sortie.txt | cut -c330-             # isoler la colonne
```

L'offset se trouve en tâtonnant sur deux ou trois lignes. Une coupe trop courte
tronque le début des phrases — c'est lisible, et c'est moins coûteux qu'une coupe
trop longue qui ramène la colonne voisine.

## 2. Écrire le digest

Cinq sections, dans cet ordre, et rien d'autre :

1. **But du jeu** — deux phrases. Ce qu'on cherche à faire, et dans quel sens va
   le score : le plus bas gagne, ou le plus haut.
2. **Déroulement d'une manche** — le minimum pour situer le décompte. Pas les
   fonctions de chaque carte, sauf quand elles portent des points.
3. **Décompte** — la section qui compte. Barème exhaustif, en tableau dès qu'il y
   a plus de trois lignes. C'est ce que l'app implémente : une valeur manquante
   ici est un bug en production.
4. **Fin de partie** — la condition exacte, et si elle change avec le nombre de
   joueurs.
5. **Pièges** — ce qu'on oublie systématiquement en jouant, et ce qui fausse le
   décompte quand on l'oublie. Un piège sans conséquence sur le score n'a pas sa
   place ici.

En-tête du fichier : l'entrée du catalogue, l'édition exacte du livret (référence
éditeur, année, nombre de cartes), la source et son empreinte si elle est locale.
Une règle lue dans la mauvaise édition est une règle fausse.

## 3. Confronter au catalogue

Le digest et la configuration déclarative de l'entrée décrivent la même chose de
deux façons. Les faire se répondre, champ par champ :

| Champ de `regles` | Ce que le livret doit confirmer |
|---|---|
| `classement.direction` | le sens du gagnant |
| `saisie` | ce qu'une manche produit comme nombre, et ses bornes |
| `fin` | seuil, nombre de manches fixe, ou manches gagnées |
| `joueursMin` / `joueursMax` | la fourchette imprimée |

**Un écart est un résultat, pas une coquille à corriger en silence.** Le livret
est la source ; la configuration est une hypothèse écrite avant de l'avoir lu.
Signaler l'écart là où la décision se prend — commentaire d'issue, section du
digest — et laisser la correction de la configuration à qui en a la charge.

## 4. Ce qu'on ne met pas dedans

- **Le texte du livret.** Il est sous copyright éditeur. Un digest reformule et
  cite un barème ; il ne recopie pas des paragraphes.
- **Le PDF lui-même.** Les livrets restent hors du dépôt (`rules/` est ignoré) ;
  seuls l'URL éditeur et l'empreinte sha256 sont commités, de quoi vérifier plus
  tard qu'un livret retéléchargé est bien le même.
- **Les variantes maison.** Le digest dit la règle imprimée. Ce que la table
  décide un soir donné est une surcharge de partie, pas une règle.
