# Le design system Memphis

Statut : retenu, implémenté.
Source : projet claude.ai/design « Game scoring sheet system »,
fichier `Memphis - Kit UI.dc.html`.

## Le problème

L'app porte aujourd'hui le thème shadcn par défaut — `baseColor: neutral`,
`style: radix-nova` — c'est-à-dire du gris sur du blanc, des bordures d'un
pixel, des coins à 10 px. C'est le thème qu'on n'a pas choisi : il est arrivé
avec `bunx shadcn init` et personne ne l'a jamais regardé.

Or l'écran n'est pas tenu à trente centimètres par une personne assise : il est
**posé au milieu d'une table encombrée**, et cinq personnes le consultent de
loin, de biais, en tendant le bras entre deux verres. Un séparateur d'un pixel
et un `text-muted-foreground` gris à 55 % de clarté ne survivent pas à cette
distance. Le chiffre non plus : `text-lg` sur un total, c'est 18 px pour la
seule information que la soirée vient chercher trente fois.

Le kit Memphis répond à ça, et il répond à ça **en connaissant le domaine** — il
est dessiné pour cette app, pas adapté d'un thème générique. Ses trois décisions
structurantes :

- **Le trait de 3 px partout.** Une bordure épaisse se voit à un mètre, un
  hairline non. C'est ce qui remplace l'ombre douce comme moyen de détacher une
  surface.
- **Le chiffre est le héros.** Azeret Mono tabulaire, 22 px dans une case, 30 px
  sur un total, 68 px sur le pavé. La typographie d'interface (Work Sans)
  descend à 13 px et pas plus bas — « l'écran est à 60 cm ».
- **L'encre sur l'aplat, jamais le blanc.** Le texte posé sur framboise, lagon,
  mandarine ou raisin est toujours `#17141F`. C'est ce qui tient 5:1 sur les
  quatre couleurs d'un coup, au lieu de devoir vérifier chaque paire.

## Ce que le kit fixe

Les valeurs sont dans `Memphis - Kit UI.dc.html`, neuf sections. Le résumé qui
compte pour l'implémentation :

| Rôle | Clair | Sombre |
| --- | --- | --- |
| Papier (fond) | `#FAF5EA` | `#151220` |
| Carte | `#FFFDF6` | `#201B2E` |
| Encre (texte, trait) | `#17141F` | `#F7F2E8` |
| Trait | `#17141F` | `#3A3350` |
| Second texte | `#5B5568` | `#A29CB4` |
| Framboise (geste) | `#F2337F` | `#FF5A9B` |
| Lagon (info, focus) | `#14BFD1` | `#2FD9E8` |
| Mandarine (attente) | `#FF8A1F` | `#FFA24D` |
| Raisin (fin) | `#7A4CE0` | `#A184FF` |
| Surface d'appoint | `#FFF0D9` | `#2C2540` |

Typographie : Darker Grotesque 900 pour les titres (48–104 px, jamais deux
niveaux sur un écran), Work Sans pour l'interface, Azeret Mono tabulaire pour
tous les nombres.

Formes : rayon 14 px sur une carte, 999 px sur un bouton, ombre dure
`4px 4px 0` qui s'enfonce à l'appui (`translate(4px, 4px)`, ombre à zéro).
**L'ombre dure disparaît en mode sombre** — c'est le liseré `#3A3350` qui
détache, une ombre noire sur fond noir ne détachant rien.

Six pastilles de joueur, « puis on recycle » : framboise, lagon, mandarine,
raisin, `#9BE016`, `#6C8CFF`. La couleur suit le joueur partout — colonne de la
grille, ligne de la tablée, marche du podium — **et l'initiale reste**, pour qui
ne distingue pas les teintes.

## Trois façons de l'implémenter

### A — Rebrancher les jetons, et rien d'autre

Réécrire les variables de `globals.css` avec la palette Memphis et s'arrêter là.
Les 27 composants ne bougent pas : `bg-muted` et `text-muted-foreground`
pointent sur de nouvelles couleurs, et l'app change de teinte sans qu'on touche
un seul `className`.

Le diff tient en un fichier, et c'est tout ce qu'on peut en dire de bien.
Memphis **n'est pas une palette** : le trait de 3 px, l'ombre dure, la pilule,
le chiffre à 30 px et le titre à 52 px sont la moitié du kit, et aucun de ces
cinq ne sort d'une variable de couleur. Le résultat serait une app beige aux
bordures d'un pixel — reconnaissablement ni l'un ni l'autre.

### B — Jetons, primitives partagées, puis adoption écran par écran

Trois couches, de la plus partagée à la plus locale :

1. `globals.css` porte les jetons — les couleurs sous leurs noms sémantiques
   existants, plus ce que shadcn n'a pas : les quatre aplats, les six couleurs
   de joueur, l'ombre dure, le trait.
2. `champs.ts` — le module dont la raison d'être est déjà « ce que plusieurs
   écrans partagent, écrit une seule fois » — gagne les formes qui se répètent
   mot pour mot : la carte, la liste, les trois champs, la touche.
3. Les écrans n'écrivent plus que ce qui leur est propre.

C'est la couche 2 qui fait la différence avec A : les trois champs de saisie
sont aujourd'hui **trois constantes quasi identiques dans trois fichiers**
(`CHAMP_NOM` dans `champs.ts`, `CHAMP_CODE` dans `rejoindre-par-code.tsx`,
`CHAMP_NOMBRE` dans `tablee-formulaire.tsx`) — exactement la duplication que
`AGENTS.md` interdit, et exactement ce qui diverge quand on retouche un focus.

### C — Redessiner les écrans à partir des maquettes

Le kit porte une section « les écrans en situation » : accueil, feuille de
score, saisie. On pourrait les reprendre comme cible et réécrire le balisage.

À refuser. Ces maquettes sont **des vignettes de démonstration** — trois `div`
de 400 px de large, sans état, sans les cas que les écrans réels portent : le
joueur parti, le refus d'écriture, la salle d'attente, le hors-classement. Le
balisage actuel encode ces cas-là, et chacun est documenté par un JSDoc qui dit
pourquoi il est là. Le réécrire d'après une vignette, c'est perdre la raison en
gardant la forme.

## Retenu : B

Parce que c'est la seule des trois qui traite le kit pour ce qu'il est — un
vocabulaire de formes, pas une palette (A) ni un jeu de maquettes (C) — et
parce que la couche 2 supprime en passant une duplication qui existait déjà.

Ce qu'on assume :

- **Le diff touche presque tous les composants.** Il le faut : le titre passe en
  Darker Grotesque, les nombres en Azeret Mono, les surfaces prennent le trait.
  Un écran oublié se verrait immédiatement, ce qui est une bonne propriété.
- **Les noms sémantiques de shadcn sont conservés** (`--primary`, `--muted`,
  `--accent`…) plutôt que remplacés par `--framboise` et consorts. `ui/button.tsx`
  est un fichier shadcn, régénérable par `bunx shadcn add` : le couper de ses
  jetons rendrait chaque régénération conflictuelle. Les noms Memphis s'ajoutent
  **à côté**, pour les quatre aplats et les six pastilles, qui n'ont pas
  d'équivalent sémantique.

## Décisions de détail

**Les deux couleurs de joueur que le kit ne donne pas en sombre.** Il fixe les
six pastilles en clair et ne donne que quatre équivalents sombres — ceux des
aplats. `#9BE016` et `#6C8CFF` sont donc extrapolés dans le même geste que les
quatre autres (monter en clarté, garder la teinte) : `#B6F04A` et `#93A9FF`.
C'est écrit dans `globals.css` à l'endroit où ça se lit.

**La couleur suit l'index, pas l'identité.** `couleurDeJoueur(index)` est pure et
module 6. Elle ne prend pas de `JoueurId` : une couleur stable par joueur à
travers toutes les parties demanderait de la stocker, donc une colonne, donc une
migration — et n'apporterait rien, puisque deux parties ne se lisent jamais côte
à côte. Ce qui compte est que **dans une partie donnée**, la colonne de Paul et
la marche de Paul soient de la même couleur.

**L'initiale n'est pas décorative.** Elle est dans la pastille parce que la
couleur seule exclut 8 % des hommes. C'est la raison pour laquelle
`<Pastille>` prend un nom et pas une couleur : on ne peut pas l'appeler sans
avoir de quoi écrire l'initiale.

**Deux jetons que le kit implique sans les nommer.** `--trait-doux` sépare deux
manches d'une même feuille — le kit borde la première d'un trait plein et les
suivantes d'un `#E6DFCE` qu'il ne baptise pas ; sans ce jeton, dix manches
feraient une grille de barreaux. `--effacer` porte le rose pâle de la touche
d'effacement, seule touche colorée du pavé. Les deux ont leur équivalent sombre,
comme le reste.

**Le mode sombre suit le réglage de l'appareil**, et se laisse forcer.

La palette sombre du kit était d'abord restée derrière `.dark`, que rien ne
posait — un bloc inatteignable, comme dans le thème d'avant. Elle est désormais
branchée sur `prefers-color-scheme` : la table allumée à la bougie, c'est le
téléphone qui sait qu'il y est, pas l'app.

L'implémentation évite la duplication que la façon évidente impose. Écrire la
palette sombre sous `.dark` **et** sous `@media (prefers-color-scheme: dark)`
ferait trois listes de trente-cinq jetons — et trois listes divergent le jour où
l'une est corrigée seule, exactement ce que `AGENTS.md` interdit. À la place,
chaque jeton est déclaré **une fois, avec ses deux valeurs** :

```css
--background: light-dark(#faf5ea, #151220);
```

`light-dark()` lit le `color-scheme` de l'élément. `:root` porte
`color-scheme: light dark` — donc le réglage système — et les deux classes
d'échappement se réduisent chacune à une ligne :

```css
.light { color-scheme: light; }
.dark  { color-scheme: dark; }
```

Aucun jeton n'y est redéclaré. Lightning CSS, que Tailwind v4 embarque,
transpile `light-dark()` vers une bascule de variables plus un
`@media (prefers-color-scheme: dark)` — ce qui règle du même coup la question
des navigateurs antérieurs à Safari 17.5, où la fonction n'existe pas.

**Un jeton ne pouvait pas être dérivé de l'encre** : le voile sous le tiroir du
journal. `bg-foreground/35` assombrit en clair, mais l'encre devient crème en
sombre, et le voile y éclaircirait la page au lieu de l'enfoncer. `--voile`
porte donc ses deux valeurs, toutes deux sombres.

**`text-wrap: pretty` et l'anti-aliasing** viennent du kit et vont dans la
couche base, pas dans un composant.

## Vérification

- `bun run check` — lint, types, 40 fichiers de tests unitaires. Les tests
  rendent le balisage (`renderToStaticMarkup`) et assèrent sur le texte et la
  structure, presque jamais sur les classes : un changement de style ne doit
  donc rien casser. Si un test casse, c'est qu'il tenait à une classe, et c'est
  le test qu'il faut regarder.
- `couleurDeJoueur` est pure : elle se teste directement (recyclage au-delà de
  six, stabilité, bornes).
- `bun run build` — les trois polices Google passent par `next/font`, qui les
  auto-héberge au build ; une faute de nom s'y voit.
- **Les écrans ont été regardés**, clair et sombre, rendus en HTML statique avec
  la feuille de style produite par le build : un design system qu'on n'a pas vu
  n'est pas implémenté. C'est cette relecture qui a rattrapé la touche
  d'effacement, restée large d'une colonne et sans son aplat.
- Le mode sombre est vérifié **sans aucune classe dans le balisage**, en
  émulant `prefers-color-scheme` au navigateur : c'est le seul contrôle qui
  prouve que le réglage de l'appareil suffit.
