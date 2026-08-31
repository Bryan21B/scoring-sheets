# URLs officielles des règles des quatre entrées

- **Statut** : recherche, conclut par les quatre valeurs de `rulesUrl`
- **Date** : 2026-08-31 — toutes les URL citées ont été appelées ce jour, chaque
  résultat `curl` est reproduit en clair dans la section correspondante
- **Ticket** : [URLs officielles des règles des quatre entrées du catalogue](https://github.com/Bryan21B/scoring-sheets/issues/6), sous la carte [Carte — feuille de score multi-appareils pour 6 qui prend, Uno et Dnup](https://github.com/Bryan21B/scoring-sheets/issues/1)
- **Débloque** : [Design doc consolidé, CONTEXT.md et ADR](https://github.com/Bryan21B/scoring-sheets/issues/16)
- **Alimente** : le champ `rulesUrl` de `EntreeCatalogue`
  ([Configuration déclarative d'un jeu](../specs/2026-08-31-configuration-de-jeu.md)),
  et [Skill de condensation de règles](https://github.com/Bryan21B/scoring-sheets/issues/7)
  pour `rulesDigestPath`

## La question

Le catalogue porte quatre entrées — `6-qui-prend`, `6-qui-prend-cartes-speciales`,
`uno`, `dnup` — et chacune expose un lien « règles complètes » qui sort de l'app
vers l'éditeur. Il faut, pour chaque entrée, **une URL stable et hébergée par
l'éditeur**, vérifiée, avec sa langue.

Trois contraintes cadrent la réponse, et il vaut la peine de dire pourquoi :

1. **Source primaire uniquement.** BoardGameGeek, unorules.com, Trictrac ou
   Ultra Board Games servent à *pister* une page éditeur, jamais à être la
   réponse : ils republient des règles qu'ils ne maîtrisent pas et qui divergent
   des livrets imprimés — c'est exactement le piège d'Uno (§ 3).
2. **Page HTML plutôt que PDF direct, quand les deux existent.** Un PDF derrière
   un CDN volatil (hash de build, lien signé, `?v=1712345678`) casse au premier
   redéploiement de l'éditeur ; une page produit survit à une refonte de son
   propre contenu.
3. **Une entrée sans page éditeur est un résultat, pas un échec.** Elle renforce
   le digest court en repo comme source principale, et le lien externe devient
   décoratif.

## Résumé — les quatre valeurs de `rulesUrl`

| id catalogue | URL retenue | langue | vérification (2026-08-31) |
|---|---|---|---|
| `6-qui-prend` | `https://www.gigamic.com/plus-de-cinq-joueurs/517-six-qui-surprend-3421272418824.html` | fr | `200`, pas de redirection, `text/html` |
| `6-qui-prend-cartes-speciales` | **la même URL** — aucune page éditeur distincte n'existe pour la variante | fr | idem |
| `uno` | `https://service.mattel.com/instruction_sheets/GDJ85-FR.pdf` | en + es + fr | `200`, pas de redirection, `application/pdf` |
| `dnup` | `https://www.dnup.game/fr/` | fr (site en / fr, livret en 18 langues) | `200`, pas de redirection, `text/html` |

Les quatre sont hébergées par l'éditeur, aucune n'est un agrégateur. Trois sur
quatre sont des **pages HTML** ; la quatrième — Uno — est la seule où j'ai
**dérogé à la préférence « page HTML avant PDF »**. L'argument est en § 3, et
c'est la seule décision de ce document qui mérite un avis humain.

## Méthode : les deux PDF du repo se sont identifiés eux-mêmes

Le raccourci décisif n'est pas venu d'un moteur de recherche mais de `rules/`.

**`gigamic_six-qui-surprend_rules_03-2019_web.pdf`** ne porte aucune URL ni
aucun QR code : `strings` ne remonte que les espaces de noms XMP d'Adobe, et un
balayage Vision des 13 pages rendues à 300 dpi ne trouve aucun code-barres. En
revanche son **nom de fichier est celui de l'éditeur**, et la fiche produit
Gigamic embarque un blob JSON qui décrit ses pièces jointes — nom de fichier,
taille en octets, id. La correspondance est exacte, sans ambiguïté possible :

```json
{"id_product":"517","id_attachment":"200",
 "file_name":"gigamic_six-qui-surprend_rules_03-2019_web.pdf",
 "file_size":"1291169","mime":"application/pdf",
 "name":"Règles : 6 qui surprend !"}
```

`1291169` octets, c'est exactement la taille du fichier local. Téléchargement de
la pièce jointe et comparaison : `sha256 = de6906ab…3854e` des deux côtés. **Le
PDF du repo est, octet pour octet, celui que Gigamic sert aujourd'hui.**

**`rules_en.pdf` n'est pas Uno.** C'est le livret **Dnup en anglais** — le ticket
supposait Uno, la supposition est fausse et c'est le second résultat de cette
recherche. Deux pages, 368 × 1047 pts, produit par Ghostscript le 2026-03-23,
sans une ligne de texte extractible (`pdftotext` rend le vide : c'est un
assemblage d'images Photoshop). Le rendu en PNG lève le doute en une seconde :
logo `dnup`, « GOAL OF THE GAME », « © ASMODEE GROUP 2026 », et un QR code
« Video Rules » en haut à droite.

Faute de `zbarimg` ou de `pyzbar` sur la machine, le QR a été décodé par le
framework **Vision de macOS**, via un binaire Swift de vingt lignes compilé avec
le `swiftc` des Command Line Tools (`VNDetectBarcodesRequest` sur le PNG rendu à
400 dpi). Charge utile :

```
symbology=VNBarcodeSymbologyQR payload=https://account.asmodee.net/redirect/dnup_rules
```

Le nom `rules_en.pdf` s'explique alors tout seul : c'est le nom du fichier **tel
qu'Asmodee l'héberge**, `https://www.dnup.game/rules/rules_full/rules_en.pdf`.
Téléchargement et comparaison : `sha256 = b64b58e0…02db` des deux côtés. Même
conclusion que pour Gigamic — le fichier local est la copie exacte de l'original
en ligne.

Deux livrets sur deux, l'identification est certaine et ne repose sur aucune
inférence. **Il n'y a en revanche aucun livret Uno dans `rules/`** : l'entrée
`uno` est la seule des quatre dont le digest devra être écrit sans livret local
de référence.

## 1. `6-qui-prend` — Gigamic

### Ce qui a été cherché

Une page éditeur française portant les règles 03-2019 du livret local. Point de
départ : le nom de fichier, qui ressemble à un nom hébergé chez Gigamic.

### Ce qui a été trouvé

`gigamic.com` tourne sous **PrestaShop** (`robots.txt` le dit en en-tête). Le
`sitemap.xml` racine est en 404 ; le `Sitemap:` déclaré dans `robots.txt` pointe
sur `https://www.gigamic.com/2_index_sitemap.xml`, lequel ne référence qu'un seul
sitemap — celui de `en.gigamic.com`. **Le catalogue français n'est pas dans un
sitemap accessible** ; il a fallu passer par la recherche interne du site.

Deux fiches produit existent, et elles ne portent pas le même livret :

| fiche | id produit | pièce jointe « Règles » | fichier |
|---|---|---|---|
| **Six qui Surprend** | 517 | id 200 | `gigamic_six-qui-surprend_rules_03-2019_web.pdf` (1 291 169 o) |
| 6 qui prend ! | 58 | id 56 | `rules-6quiprend-05-2012.pdf` (1 855 284 o) |

### URL retenue, et pourquoi elle

```
https://www.gigamic.com/plus-de-cinq-joueurs/517-six-qui-surprend-3421272418824.html
```

C'est la fiche **Six qui Surprend**, dont l'onglet « Règles & liens utiles » sert
le livret 03-2019 — celui du repo, à l'octet près. Elle est retenue plutôt que la
fiche « 6 qui prend ! » pour une raison qui touche directement le catalogue :
**le livret 03-2019 contient les deux entrées**. Les pages 2 à 9 sont la règle du
jeu de base (fin de partie à plus de 66 têtes de bœuf, le plus bas gagne), les
pages 11 à 13 la « Variante avec les cartes spéciales » (deux manches, puis
total). Une seule URL couvre donc `6-qui-prend` **et**
`6-qui-prend-cartes-speciales`, et c'est celle de la boîte réellement possédée.

Le PDF direct, en second, si un jour on veut pointer le document lui-même :
`https://www.gigamic.com/index.php?controller=attachment&id_attachment=200`.

### Candidates écartées

- **`https://www.gigamic.com/plus-de-cinq-joueurs/58-6-qui-prend--3421272101337.html`**
  (fiche « 6 qui prend ! »). Page éditeur valide, `200`, mais elle sert le livret
  **05-2012**, une mise en page antérieure qui ne connaît pas les cartes
  spéciales. Vérification faite, ses règles de base sont identiques — même seuil
  de 66 têtes de bœuf, même vainqueur au plus bas total — donc rien n'y est faux ;
  elle est simplement moins bonne, parce qu'elle ne couvre qu'une des deux
  entrées. À garder en tête si la boîte de référence change un jour.
- **`en.gigamic.com`**. Le sitemap anglais ne contient aucune fiche 6 qui prend :
  le jeu est une licence AMIGO que Gigamic distribue en France, pas au catalogue
  international. **Il n'existe pas de page Gigamic anglaise** — la langue est
  `fr`, sans alternative.
- **didacto.com, bonhommedebois.com, regles-de-jeux.com, undecent.fr**. Revendeurs
  et agrégateurs, utiles pour retrouver l'id produit, jamais citables. Le PDF
  `GIGAMIC_6-QUI-PREND-JUBILEE-30-ANS_RULES_07-2023` trouvé chez `undecent.fr`
  est d'ailleurs un livret Gigamic authentique, mais **réhébergé sur le WordPress
  d'un tiers** : exactement le genre de lien qui casse.

### Vérification

```
$ curl -sSIL -o /dev/null -w '%{http_code} %{url_effective} %{content_type}\n' <url>
200 https://www.gigamic.com/plus-de-cinq-joueurs/517-six-qui-surprend-3421272418824.html text/html; charset=utf-8
200 https://www.gigamic.com/index.php?controller=attachment&id_attachment=200 application/pdf
```

La pièce jointe est servie en `content-disposition: inline; filename="gigamic_six-qui-surprend_rules_03-2019_web.pdf"`.

### Stabilité : bonne, et pour une raison mesurable

PrestaShop route sur l'**id numérique**, pas sur le slug ni sur la catégorie. Les
trois variantes suivantes renvoient toutes `200` et la même fiche :

```
https://www.gigamic.com/plus-de-cinq-joueurs/517-nimporte-quoi.html
https://www.gigamic.com/jeux-de-rapidite/517-six-qui-surprend-3421272418824.html
https://www.gigamic.com/517-six-qui-surprend.html
```

et toutes trois déclarent le même canonique, qui est exactement l'URL retenue.
Autrement dit : **une recatégorisation ou un renommage du produit ne casse pas le
lien**, seule la suppression de la fiche le ferait. Pas de CDN, pas de hash, pas
de paramètre de version.

L'URL de la pièce jointe est nettement plus fragile, et c'est ce qui justifie
l'ordre : si Gigamic remplace le livret par une édition plus récente, la pièce
jointe reçoit un **nouvel id** et `id_attachment=200` devient orphelin, alors que
la fiche 517 suit la mise à jour toute seule.

## 2. `6-qui-prend-cartes-speciales` — aucune page distincte

### Ce qui a été cherché

Une page éditeur propre à la variante « cartes spéciales », à préférer si elle
existe.

### Ce qui a été trouvé : rien, et c'est net

La variante n'est pas un produit. C'est une **section du livret 03-2019** de Six
qui Surprend, imprimée dans la même boîte, avec les 28 cartes spéciales que le
même livret demande de « mettre de côté pour jouer au jeu de base ». Aucune fiche
Gigamic, aucun onglet, aucune pièce jointe ne lui est propre : la recherche
interne du site sur « 6 qui prend » ne remonte que cinq fiches, toutes des
produits physiques distincts —

```
/plus-de-cinq-joueurs/58-6-qui-prend--3421272101337.html
/plus-de-cinq-joueurs/474-extension-6-qui-prend-3421272101320.html
/plus-de-cinq-joueurs/517-six-qui-surprend-3421272418824.html
/plus-de-cinq-joueurs/1126-6-qui-prend-anniversaire-3421272888115.html
/jeux-enfant/981-6-qui-prend-junior-3421272179213.html
```

— et le blob d'attachements de la fiche 517 ne contient que deux entrées : le
livret et une fiche pédagogique.

### URL retenue

**La même que `6-qui-prend`.** Les deux entrées du catalogue pointent sur la
fiche 517. Ce n'est pas un pis-aller : c'est fidèle à la réalité éditoriale, où
base et variante sont un seul document.

C'est aussi cohérent avec le modèle du spec, où les deux entrées partagent
`famille: "6-qui-prend"` et où la variante se déclare par spread de l'entrée de
base. Le lien de règles suit le même chemin que le reste de la configuration.

Ce que ça implique pour la suite : **c'est le digest qui devra distinguer les
deux**, pas l'URL. Deux digests différents, un seul lien externe.

## 3. `uno` — Mattel

### Ce qui a été cherché

La page correspondant au **décompte imprimé classique** : le gagnant de la manche
encaisse la somme des cartes restantes dans les mains des autres, premier à 500
points gagne. Et surtout : écarter les pages qui décrivent la règle alternative,
où chacun compte ses propres cartes restantes.

### Ce qui a été trouvé

`mattelgames.com` **n'existe plus comme site de contenu** : la racine comme
`/en-us/cards/uno` redirigent vers la boutique (`shopping.mattel.com`,
`shop.mattel.com`). `instructions.mattel.com` ne résout pas (NXDOMAIN). Le seul
dépôt de règles de Mattel est le portail de support historique
`service.mattel.com`, un ASP.NET dont l'index des notices
(`/us/instruction_sheets.aspx`) est un **formulaire de recherche**, pas une
arborescence : il n'existe pas d'URL de listing stable, seulement des fiches
produit par référence.

Trois fiches Uno pertinentes, et elles ne se valent pas :

| réf. | année | notices | contenu |
|---|---|---|---|
| **GDJ85** | 2019 | `-Eng`, **`-FR`**, `-SP` | 112 cartes, notice trilingue en/es/fr |
| 42003 | 1995 | `-Eng`, `42003 French`, `-SP`, `-Wild` | notice française **scannée**, sans couche texte |
| 41940 | 2010 | `-Eng`, `-Wild` | pas de notice française |
| W2087 | 2010 | *aucune* | fiche produit sans notice |

Le point qui tranche, et qui est le cœur du ticket : la notice **GDJ85-FR** porte
le décompte classique en français, et range explicitement l'autre en second.

> **But du jeu** — « Être le premier à se débarrasser de toutes ses cartes à
> chaque manche et marquer des points pour toutes les cartes que les adversaires
> ont encore en main. Les points s'accumulent d'une manche à l'autre et le
> premier joueur qui obtient 500 points gagne la partie. »
>
> **Pointage** — « Le premier joueur qui s'est débarrassé de toutes ses cartes se
> voit attribuer le nombre de points correspondant aux cartes que les autres
> joueurs ont encore en main. »
>
> **Le VAINQUEUR est le premier joueur à atteindre 500 points.**
>
> **Autre façon de calculer les points** — […]

C'est exactement `sommeAuGagnant` 0–500, direction haute, seuil 500. La règle
alternative existe bien dans le document, mais sous un titre qui la désigne comme
alternative — elle n'est jamais la règle par défaut chez Mattel.

### URL retenue, et pourquoi elle

```
https://service.mattel.com/instruction_sheets/GDJ85-FR.pdf
```

**C'est la seule des quatre entrées où je déroge à « page HTML avant PDF », et il
faut le dire franchement.** La page HTML existe :

```
https://service.mattel.com/us/productDetail.aspx?prodno=GDJ85&siteid=27
```

Elle répond `200`, elle est bien chez l'éditeur, et elle liste les trois notices.
Trois raisons de ne pas la retenir comme cible du lien « règles complètes » :

1. **Elle est en anglais uniquement**, sans variante française. Un joueur qui
   clique « règles complètes » atterrit sur « Instruction Sheets — Click on a link
   below to view the Adobe PDF Format Instruction Sheet », puis doit repérer
   « GDJ85 : UNO® - French ». Deux frictions pour un lien qui doit en avoir zéro.
2. **Ses liens vers les notices ne sont pas des `href`.** Ce sont des
   `Javascript:openpopup('/instruction_sheets/GDJ85-FR.pdf')` — donc des popups,
   que les navigateurs mobiles bloquent volontiers. Une page dont le contenu utile
   n'est pas atteignable au clic sur mobile n'est pas une meilleure destination
   qu'un PDF. *(La variante mobile `m.service.mattel.com/us/Technical/productDetail?prodno=GDJ85&siteid=27`
   sert bien des `href` en clair, mais ajoute un hôte `m.` et un chemin
   `Technical/` de plus à parier sur la durée.)*
3. **Le PDF est le moins volatil des deux.** Chemin statique, sans hash, sans
   requête, dérivé de la référence produit : `/instruction_sheets/<RÉF>-<LANGUE>.pdf`.
   Le même dépôt sert encore `uno basic is.pdf`, distillé en 2008 et modifié pour
   la dernière fois en 2011 — quinze ans de stabilité observable sur le même
   motif. La page, elle, dépend d'un portail ASP.NET que Mattel est visiblement en
   train de remplacer (`consumersupport.mattel.com`, Salesforce, déjà en place pour
   les réclamations et les rappels).

**Le lien HTML reste à citer en second** : c'est lui qui donne accès aux versions
anglaise et espagnole, et c'est lui qui prouve que le PDF est bien publié par
Mattel plutôt que déterré.

### Candidates écartées

- **`https://service.mattel.com/instruction_sheets/uno%20basic%20is.pdf`** — la
  notice de l'Uno **108 cartes**, le paquet sans carte « Mélanger les mains » ni
  cartes à personnaliser. Authentique, même décompte classique, même section
  « Alternative Scoring and Winning » clairement étiquetée comme alternative.
  Écartée pour deux raisons. D'abord **elle n'existe qu'en anglais et en espagnol
  LAAM** — elle serait le meilleur choix si le repo était en anglais. Ensuite,
  **aucune fiche produit ne la référence** : son bloc de specs interne annonce
  `Toy No.: 41940`, mais la fiche 41940 ne lie que `41940-Eng.pdf` et
  `41940-Wild.pdf`. C'est un fichier orphelin dans le dépôt de notices,
  atteignable seulement par son URL. Un lien vers un document que l'éditeur ne
  référence plus nulle part est un lien qu'on ne peut pas voir mourir.
- **`https://service.mattel.com/instruction_sheets/42003%20French.pdf`** — notice
  française de l'Uno 1995. Écartée parce que c'est un **scan sans couche texte**
  (`Adobe Acrobat 6.0 Image Conversion Plug-in`, 2007) : illisible pour un lecteur
  d'écran, non recherchable, et impossible à condenser automatiquement pour le
  digest.
- **`https://m.service.mattel.com/us/Technical/productDetail?prodno=W2087&siteid=27`**
  — fiche Uno 2010 sans aucune notice attachée. Un lien « règles complètes » qui
  ne mène à aucune règle.
- **`mattelgames.com`** — n'est plus qu'une redirection commerciale. Aucune page
  de règles n'y subsiste.
- **`unorules.com`** — **pas un site Mattel**, malgré son nom et son classement.
  Il présente d'ailleurs le seuil de 500 points comme négociable (« you can also
  choose whatever points number to win the game »), ce qui est une règle maison,
  pas la règle imprimée. C'est précisément le genre de source que la contrainte
  n° 1 exclut.
- **`regle.escaleajeux.fr/uno___rg.pdf`** — scan réhébergé par une association de
  collectionneurs. Même famille de problème.

### Vérification

```
200 https://service.mattel.com/instruction_sheets/GDJ85-FR.pdf  application/pdf
200 https://service.mattel.com/instruction_sheets/GDJ85-Eng.pdf application/pdf
200 https://service.mattel.com/us/productDetail.aspx?prodno=GDJ85&siteid=27 text/html; charset=utf-8
200 https://service.mattel.com/instruction_sheets/uno%20basic%20is.pdf application/pdf
```

Aucune redirection sur aucune des quatre.

### Stabilité : correcte sur le chemin, incertaine sur la plateforme

Le chemin est aussi propre qu'on peut l'espérer — pas de CDN tiers, pas de hash,
pas de signature, pas de paramètre de version — et le motif tient depuis quinze
ans. Le risque n'est pas le lien, **c'est le portail** : la migration visible vers
`consumersupport.mattel.com` peut emporter `service.mattel.com` en bloc, page
`.aspx` et notices ensemble. C'est le seul des quatre liens de ce document dont je
donnerais une espérance de vie inférieure à cinq ans, et la raison pour laquelle
le digest en repo compte plus ici que partout ailleurs.

Note secondaire : le français de GDJ85-FR est du **français canadien** (« piger
une carte », « le donneur brasse les cartes »). Compréhensible sans effort, mais
ce n'est pas le vocabulaire d'une boîte vendue en France.

## 4. `dnup` — Asmodee

### Ce qui a été cherché

L'URL derrière le QR code « Video Rules » du livret, et sa stabilité.

### Ce qui a été trouvé

Le QR — identique sur le livret anglais et sur le livret français, où il est
légendé « LES RÈGLES EN VIDÉO » — encode :

```
https://account.asmodee.net/redirect/dnup_rules
```

C'est un **redirecteur maison d'Asmodee**, pas un raccourcisseur tiers. Ni
`bit.ly`, ni `asmodee.link` : un chemin nommé (`dnup_rules`) sur un domaine
Asmodee. La chaîne complète :

```
302  https://account.asmodee.net/redirect/dnup_rules
  -> https://www.dnup.game/?utm_source=rulebook&utm_medium=qrcode&utm_campaign=dnup
302  -> /en/            (par défaut)
200     https://www.dnup.game/en/
```

Détail qui compte : la seconde redirection **négocie la langue**. Avec
`Accept-Language: fr-FR`, la même URL aboutit sur `https://www.dnup.game/fr/`.

`www.dnup.game` est un site dédié au jeu, statique (Astro), édité par Asmodee. Il
porte une section « règles » qui offre le livret complet **en 18 langues**
(`/rules/rules_full/rules_<code>.pdf`), une page « Apprends les règles »
(`/fr/how-to-play/`) avec une vidéo dont la langue se choisit parmi quinze, et une
FAQ qui répond à de vraies questions de règles (« Pourquoi je ne peux pas ajouter
1 carte à une série plus faible ? »).

**Le site lui-même n'est traduit qu'en deux langues**, `en` et `fr` — ce sont les
seuls `hreflang` déclarés, et la vérification le confirme : n'importe quel autre
chemin de locale répond `200` mais ne sert qu'une coquille SPA de 155 octets,
là où `/fr/` en fait 495 424 et `/en/` 229 639. Un `200` seul ne prouve rien sur
cet hôte ; il fallait comparer les corps.

### URL retenue, et pourquoi elle

```
https://www.dnup.game/fr/
```

C'est la page francophone de l'éditeur, et le point d'entrée vers tout le reste :
la vidéo de règles, la FAQ, et le PDF français. Elle est préférée au redirecteur
`account.asmodee.net` — qui fonctionne, mais ajoute deux sauts, des paramètres UTM
de campagne, et une négociation de langue dont l'issue dépend du navigateur du
joueur. Un lien en dur sur `/fr/` donne le français à coup sûr.

Le PDF direct, en second :
`https://www.dnup.game/rules/rules_full/rules_fr.pdf` (le livret complet
français, `200`, `application/pdf`).

### Candidates écartées

- **`https://account.asmodee.net/redirect/dnup_rules`** — le QR lui-même. Écarté
  comme cible : deux redirections, UTM de campagne, langue non déterministe.
  Utile à documenter, pas à citer.
- **`https://www.dnup.game/fr/how-to-play/`** — bonne page, mais c'est la page
  *vidéo* : elle ne porte pas les PDF. Pour un lien « règles complètes », `/fr/`
  couvre plus.
- **`asmodee.com`** — redirige vers `corporate.asmodee.com`, un site institutionnel
  sans fiche produit ni règles.
- **`spacecowboys.fr`** — redirige vers `spacecowboys-games.com`, où aucune page
  Dnup n'existe (`/dnup` et `/en/games/dnup/` sont en 404), alors même que des
  revendeurs classent le jeu sous ce studio.
- **`boardgamearena.com/gamepanel?game=dnup`** — implémentation officielle, liée
  depuis le site, mais c'est une plateforme de jeu, pas la règle de l'éditeur.

### Vérification

```
200 https://www.dnup.game/fr/                              text/html
200 https://www.dnup.game/fr/how-to-play/                   text/html
200 https://www.dnup.game/rules/rules_full/rules_fr.pdf     application/pdf
200 https://www.dnup.game/rules/rules_full/rules_en.pdf     application/pdf
200 https://account.asmodee.net/redirect/dnup_rules  ->  https://www.dnup.game/en/  text/html
```

### Stabilité : la meilleure des quatre, avec une réserve de fond

Un signal fort, visible dans le HTML : le site **hash tous ses assets de build**
(`/_astro/box-isometric.DXtjJvPq_zgYNj.webp`) **sauf les règles**, servies sur un
chemin nu et parlant, `/rules/rules_full/rules_fr.pdf`. Ce n'est pas un hasard :
ce sont les URL sur lesquelles pointent le QR imprimé et les supports marketing,
donc celles qu'Asmodee s'est engagé à ne pas bouger. C'est exactement l'inverse du
PDF derrière CDN volatil que le ticket demandait d'éviter.

La réserve n'est pas technique, elle est éditoriale : `dnup.game` est un **site de
campagne pour un jeu sorti en 2026**. Les microsites par produit sont
généralement les premiers retirés quand la campagne s'arrête. Le lien est solide
tant que le site vit ; sa durée de vie dépend d'une décision marketing, pas d'une
propriété d'URL. À revoir dans deux ou trois ans.

## Ce qui reste incertain ou fragile

Par ordre décroissant de ce qui mérite qu'on y revienne.

1. **Uno est la seule entrée sans livret dans `rules/`, et la seule où on ne sait
   pas quelle boîte est sur la table.** GDJ85 est l'Uno 112 cartes de 2019, avec
   une carte « Mélanger les mains » (40 points) et trois cartes à personnaliser
   (40 points) que l'Uno 108 cartes n'a pas. Le décompte de base est identique et
   le seuil de 500 aussi — la configuration du catalogue ne bouge pas d'un
   champ — mais le **barème détaillé du digest** dépend de l'édition. Si la boîte
   réelle est un Uno 108 cartes, `uno basic is.pdf` (§ 3) décrit le bon barème,
   en anglais seulement. Trancher demande de regarder la boîte.
2. **Le portail `service.mattel.com` est en fin de vie visible.** Migration en
   cours vers `consumersupport.mattel.com`. C'est le seul des quatre liens dont
   j'anticipe la rupture, et rien dans la façon de le citer ne protège contre ça.
   Le digest en repo est le vrai filet.
3. **`dnup.game` est un microsite de campagne.** Solide aujourd'hui, dépendant
   d'un arbitrage marketing demain.
4. **Le français canadien de GDJ85-FR.** Correct, officiel, mais dépaysant pour
   un joueur français. Aucune notice Uno en français de France n'a été trouvée
   chez Mattel.
5. **Le catalogue français de Gigamic n'est pas dans un sitemap accessible.** Les
   fiches se retrouvent par la recherche interne du site. Sans conséquence sur le
   lien retenu — dont on a vérifié qu'il résiste au renommage et à la
   recatégorisation — mais ça rend une redécouverte future plus laborieuse si
   l'id 517 disparaissait.
6. **Une seule URL pour deux entrées du catalogue.** `6-qui-prend` et
   `6-qui-prend-cartes-speciales` partagent `rulesUrl`. C'est le bon reflet de la
   réalité, mais ça veut dire que **rien dans le lien ne distingue les deux
   règles** : la distinction repose entièrement sur `rulesDigestPath`. À garder en
   tête au moment d'écrire les digests
   ([#7](https://github.com/Bryan21B/scoring-sheets/issues/7)).
7. **Hors périmètre, mais trouvé en chemin : les deux livrets sont commités, et
   le repo est public.** Le ticket pose que « les PDF de `/rules` restent
   locaux : le repo est public et ils sont sous copyright » — mais `git ls-files
   rules/` les liste tous les deux, `.gitignore` ne mentionne ni `rules/` ni
   `*.pdf`, et `gh repo view` confirme `PUBLIC`. Deux livrets sous copyright
   (AMIGO / Gigamic, Asmodee Group) sont donc redistribués depuis un dépôt
   public, et ils sont dans l'historique — les retirer de `HEAD` ne suffira pas.
   Ce n'est pas le sujet de cette recherche ; ça mérite son propre ticket.

   Une fois qu'ils auront quitté l'arbre, ce document conserve leurs empreintes
   (`sha256 de6906ab…3854e` pour Gigamic, `b64b58e0…02db` pour Dnup) : elles
   suffisent à vérifier, plus tard, qu'un livret retéléchargé chez l'éditeur est
   toujours le même, ou à détecter qu'il a changé d'édition. C'est d'ailleurs le
   seul rôle que ces fichiers doivent jouer dans le repo — une référence de
   comparaison, pas une copie distribuée.
