# CONTEXT.md

Glossaire du vocabulaire métier. Un terme n'entre ici qu'une fois **décidé** :
un mot qui flotte dans le code et un mot qui flotte ici coûtent le même prix.

Le vocabulaire est tranché et le modèle est en base (cf. `AGENTS.md`, « Project
overview », et `docs/specs/2026-09-09-schema.md`). Ce fichier porte ce qui est
acquis, et rien de plus : le détail de chaque décision vit dans son spec.

## Acquis

### Le jeu et sa configuration

Tranché par [Configuration déclarative d'un jeu : les champs qui couvrent les quatre entrées](https://github.com/Bryan21B/scoring-sheets/issues/2), détaillé
dans `docs/specs/2026-08-31-configuration-de-jeu.md`.

- **Catalogue** — les quatre entrées jouables, déclarées dans une constante
  TypeScript : *6 qui prend*, sa variante *cartes spéciales*, *Uno*, *Dnup*. Un
  `id` de catalogue ne se supprime ni ne se renomme jamais.
- **Jeu** — une entrée du catalogue : une identité, une présentation, et des
  **règles**. Pas une étiquette posée sur la partie, pas une stratégie codée à
  part.
- **Famille** — le lien entre deux entrées qui sont le même jeu à une variante
  près (*6 qui prend* et sa variante *cartes spéciales*). Déclaré par la
  configuration, interprété par le palmarès.
- **Règles** — le bloc de configuration que le moteur reçoit, et le seul :
  direction du classement, mode de saisie, condition de fin, bornes de joueurs.
  Ce qui n'y est pas ne peut pas influencer un calcul.
- **Unité** — le mot qui nomme les points d'un jeu, au singulier et au pluriel :
  tête(s) de bœuf, point(s), jeton(s). De la présentation, jamais des règles.
- **Variante selon l'effectif** — ce qu'une taille de table change aux règles
  d'une entrée : la saisie, la fin, ou les deux, déclarées d'un bloc. Elle vit au
  catalogue, s'applique à la résolution, et n'entre jamais dans l'instantané.
  Dnup à deux joueurs en est le seul cas : **aucun jeton n'existe** et la partie
  se gagne à deux manches. Tranché par
  [Dnup à deux joueurs fige des jetons qui n'existent pas](https://github.com/Bryan21B/scoring-sheets/issues/42),
  détaillé dans `docs/adr/0009-la-variante-selon-l-effectif.md`.

### Ce que les règles décrivent

- **Mode de saisie** — la forme d'une manche, et la transformation de ce qui est
  entré vers ce qui est marqué. Trois modes : `entierParJoueur` (un entier par
  joueur), `sommeAuGagnant` (un gagnant désigné et **un total unique** crédité à
  lui, jamais une valeur par perdant), `podium` (des désignations ordonnées, qui
  distribuent des jetons fixes).
- **Condition de fin** — ce qui clôt la partie : un `seuil` de points atteint, un
  nombre de manches fixe, ou un nombre de manches gagnées. Le seuil se franchit
  toujours par le **total le plus haut**, quel que soit le sens du classement.
- **Direction** — le sens du classement, `haut` ou `bas`. Elle décide qui gagne,
  jamais quand la partie s'arrête.

### La partie en cours

- **Partie** — une session de jeu entre plusieurs joueurs, du début à la fin du
  décompte. C'est l'unité qu'on ouvre, qu'on remplit, puis qu'on clôt.
- **Feuille de score** — la représentation d'une partie : qui joue, ce qui a été
  marqué, où en sont les totaux. Le nom du produit vient de là.
- **Joueur** — une personne du roster, persistante entre parties. Le nom est
  son seul identifiant humain, et il est modifiable.
- **Manche** — un tour de jeu à l'issue duquel des points sont attribués. Elle
  porte un **numéro**, unique dans sa partie : deux téléphones qui ouvrent « la
  manche suivante » en même temps rejoignent la même, ils n'en créent pas deux.
  Un numéro ne se réutilise jamais — supprimer une manche laisse un **trou**.
- **Instantané de règles** — les règles du jeu **résolues et figées** à
  l'ouverture de la partie : nombre de joueurs appliqué, seuil surchargé
  appliqué. Une partie se relit toujours sous les règles qui l'ont ouverte, même
  si le catalogue change ensuite.
- **Manche complète** — une manche dont toutes les saisies attendues sont
  arrivées ; la définition dépend du mode de saisie. Une manche incomplète fait
  bouger les totaux mais ne peut jamais terminer la partie.
- **Gagnant de manche** — dérivé du mode de saisie, jamais saisi. Une égalité sur
  une manche ne fait aucun gagnant.

### La saisie d'une manche

Tranché par [Qui pilote la passe avant, quand chacun compte pour soi](https://github.com/Bryan21B/scoring-sheets/issues/22).

- **Désignation** — nommer un joueur : « qui est sorti ? » à Uno, « premier ? »
  et « deuxième ? » à Dnup. L'information est publique, toute la table l'a vue,
  et une seule personne la pose.
- **Valeur** — un nombre compté devant soi, que la case concerne. Les têtes de
  bœuf à 6 qui prend en sont le seul cas : c'est le seul mode qui en porte
  plusieurs par manche.
- **Passe avant** — le parcours de saisie d'une manche, un écran à la fois.
  Elle enchaîne les désignations d'abord, puis les valeurs. Elle **démarre sur
  soi** et s'arrête là : elle ne pousse jamais vers l'écran d'un autre joueur.
  Sans appareil rattaché à un participant de la partie, elle démarre sur la
  première case manquante.
- **Pavé** — le clavier numérique **maison** de la passe avant : dix touches
  toujours ouvertes, jamais le clavier système. Un chiffre qui ferait sortir des
  bornes du mode ne prend **pas** — refus sec, sans boîte de dialogue, et sans
  rien détruire de ce qui était tapé.
- **Récapitulatif** — l'écran qui suit la passe avant. Il porte les totaux, les
  cases encore vides **nommées** par le joueur qu'elles concernent, et la
  correction. C'est de là qu'on saisit pour quelqu'un d'autre, y compris pour un
  participant sans appareil.
- **Clôture de manche** — la déclaration qu'une manche est finie. Elle se
  **déclare**, elle ne se déduit pas de la complétude, et n'importe quel
  participant la fait. Une manche incomplète ne se clôt pas : elle se répare.
  Elle est **idempotente** : clore une manche déjà close ne fait rien. Ce n'est
  pas un **Geste** au sens du journal, qui n'en garde aucune trace.

Qui saisit quoi ne se déclare nulle part : cela se **dérive de la forme des
saisies**. Aucune case n'a d'auteur attendu — elle nomme le joueur qu'elle
*concerne*, jamais celui qui doit la taper. L'ordre de la passe avant est une
suggestion, pas une permission : n'importe quel participant écrit n'importe
quelle case.

### L'écriture concurrente

Tranché par [Écriture concurrente sur la même case : politique de conflit](https://github.com/Bryan21B/scoring-sheets/issues/12), détaillé dans
`docs/specs/2026-09-09-ecriture-concurrente.md`.

- **Écriture conditionnelle** — une case ne s'écrit qu'à condition de porter
  encore **la valeur qui a été montrée** à celui qui écrit. Le **vide est une
  valeur**, ce qui couvre saisir et corriger sans les distinguer. Deux écritures
  sur des cases différentes ne sont pas un conflit et passent toutes les deux.
- **Écrasement informé** — écrire par dessus une valeur qu'on voit. Il **passe**,
  et le journal en garde la ligne. À distinguer de l'**écrasement périmé**, fondé
  sur une valeur qui a changé depuis, seul cas que l'écriture conditionnelle
  refuse. L'interface arrête ce qui repose sur une information fausse, le journal
  garde ce qui repose sur une information vraie.
- **Écriture sans effet** — poser sur une case la valeur qu'elle porte déjà.
  Réussit en silence : rien n'a bougé, rien ne bouge, aucun conflit à annoncer.

Aucune **présence** n'existe : le transport ne pousse rien, donc personne ne sait
qui est connecté ni qui saisit. Un verrou d'édition est irréalisable, pas écarté,
et un conflit se tranche **au serveur, à l'écriture**.

### Le décompte

- **Moteur de décompte** — la fonction pure et unique qui, depuis des règles et
  des manches, produit l'**état**. Rien de ce qu'elle calcule n'est stocké.
- **État** — totaux courants, manches gagnées, classement, nombre de manches
  jouées, et si la partie est finie. Les **totaux lisent tout**, y compris une
  manche en cours de saisie ; **`fini`, les manches jouées et les manches
  gagnées ne lisent que les manches closes**.
- **Classement** — un ordre en **groupes de rang** : deux joueurs à égalité sont
  dans le même groupe. L'égalité n'est jamais départagée, et le classement se lit
  à tout moment, même partie non terminée. Il ne sort **jamais d'une partie** — à
  ne pas confondre avec la **Note**, ni avec le **Palmarès**.
- **Rang au podium** — ce qu'une case porte en mode `podium` : le **rang**, `1`
  pour le premier et `2` pour le deuxième, comme le fixe
  `docs/specs/2026-09-09-schema.md`. On y désigne des joueurs ; les jetons sont un
  résultat, jamais une saisie, et c'est le barème `jetons` qui dit ce que le rang
  rapporte — le décalage entre un rang qui compte depuis un et un barème indexé
  depuis zéro ne s'écrit qu'au moteur.
- **Effectif courant** — les joueurs qu'une partie attend encore. Le moteur le lit
  comme l'**intersection** des attendus de ses manches, la liste des participants
  ne faisant que rétrécir une fois la partie gelée. Un participant retiré en
  sort : il n'entre ni au classement ni dans le franchissement du seuil, et garde
  pourtant son total — la soirée des autres ne s'arrête pas sur le score de
  quelqu'un qui est rentré.

### Le cycle de vie d'une partie

Tranché par [Cycle de vie d'une partie : abandon, reprise, correction, fin](https://github.com/Bryan21B/scoring-sheets/issues/13), détaillé dans
`docs/specs/2026-09-09-cycle-de-vie.md`.

- **Fin de partie** — absente ou présente ; il n'y a pas de statut à trois
  valeurs. Présente, elle porte une date, une cause — **terminée** ou
  **abandonnée** — et son auteur. Elle est **écrite** dans les deux cas :
  l'abandon parce que rien ne le déduit, la fin régulière parce que l'écriture qui
  clôt la dernière manche calcule déjà `fini`. C'est la seule exception à « rien
  de ce qui se recalcule n'est stocké », et le **Scellement** garantit qu'elle ne
  peut pas diverger.
- **Scellement** — l'état d'une partie terminée : lecture seule, définitivement.
  Aucune saisie, aucune correction, aucune suppression, aucun mouvement de
  participant. Une erreur découverte le lendemain y reste. À ne pas confondre
  avec le **Gel**, qui ne ferme que la liste des participants.
- **Abandon** — terminer une partie sans vainqueur, par un acte explicite de
  n'importe quel participant. Il vide l'écran d'accueil, que le ticket 9 a fait
  porter par la partie en cours ; sans lui, la seule sortie serait la
  suppression, qui détruirait le journal.
- **Reprise** — effacer l'abandon et rendre la partie en cours. Elle n'existe que
  pour une partie abandonnée : une partie terminée ne se rouvre pas. Le **Gel**
  survit à la reprise, puisqu'il se déduit de l'existence d'une manche.
- **Retrait d'un participant** — permis après le gel, pour le joueur qui s'en va.
  Ses valeurs déjà saisies **restent**, il cesse de compter dans la **complétude**
  des manches suivantes, et il **ne figure pas au classement final** — sans quoi
  partir tôt ferait gagner à 6 qui prend, où le plus bas l'emporte.

Une partie se **supprime** tant que son journal est vide, jamais après : le
journal n'est jamais purgé, et passé la première manche la sortie est l'abandon.

### L'historique et le palmarès

Tranché par [Historique et palmarès : les pages et leurs agrégats](https://github.com/Bryan21B/scoring-sheets/issues/14), détaillé dans
`docs/specs/2026-09-09-historique-et-palmares.md`.

Trois mots qui se marchaient dessus, et leurs portées : le **Classement** est
l'ordre à l'intérieur d'**une** partie, la **Note** est l'estimation globale d'un
joueur sur **toutes** les siennes, le **Palmarès** est la page qui les range.

- **Historique** — la liste des parties, la plus récente d'abord par date de fin,
  filtrable par jeu. Une partie **abandonnée** y figure, marquée et sans
  vainqueur.
- **Palmarès** — la liste des joueurs, ordonnée par **taux de victoires
  normalisé**, avec le nombre de parties à côté de chaque ligne.
- **Taux de victoires normalisé** — pour une partie,
  `(battus + 0,5 × ex æquo) / (n − 1)`, moyenné sur les parties **terminées** du
  joueur. Il normalise la taille de la tablée : gagner à six vaut plus que gagner
  à deux.
- **Hors classement** — l'état d'un joueur sous le plancher de parties : présent
  en bas du palmarès, sans rang, parce qu'un taux sur trois parties ne veut rien
  dire.
- **Compteur** — un **fait** par couple joueur et entrée du catalogue : parties
  jouées, victoires, dernière partie. Jamais une estimation, donc insensible au
  découpage, et défini même pour une entrée **sans score** comme Dnup. Les
  compteurs se groupent sous leur **Famille**, qui les sous-totalise sans les
  fusionner.
- **Note** — l'estimation globale d'un joueur, une seule pour toutes les entrées,
  recalculée à la volée et **postérieure à la v1**. Elle n'entre jamais dans une
  partie.

**Les parties abandonnées ne pèsent sur aucun agrégat.** Le palmarès et la note ne
lisent que les parties terminées.

### L'identité et l'arrivée

Tranché par [Identité, lien de partage et arrivée dans une partie](https://github.com/Bryan21B/scoring-sheets/issues/3), détaillé dans
`docs/specs/2026-08-31-identite-et-arrivee.md`.

- **Appareil** — le navigateur d'une personne, reconnu par un cookie serveur. Il
  pointe vers **un** joueur, **globalement** et non par partie. Plusieurs
  appareils peuvent pointer le même joueur ; aucun ne délie les autres.
- **Lien appareil → joueur** — un pointeur **au présent**, modifiable **vers
  l'avant seulement** : le changer ne relit pas le passé. C'est une
  **déclaration, pas une preuve**.
- **Roster** — la liste globale des joueurs, partagée par toutes les parties. Les
  noms n'y sont pas uniques ; un doublon se désambiguïse à la création, dans
  l'interface, jamais par un suffixe automatique.
- **Participant** — un joueur inscrit dans une partie donnée. Il peut n'avoir
  **aucun appareil** : le créateur a le droit d'ajouter des joueurs pour eux.
- **Code de partie** — l'identifiant de partage, six caractères en Crockford
  Base32, fait pour être **dicté à voix haute**. Il vit dans le lien et se tape à
  la main. Jamais recyclé. Il donne la **lecture** ; l'**écriture** demande d'être
  participant.
- **Réclamer** — lier son appareil à un participant **déjà présent**. N'ajoute
  personne, donc reste autorisé sur une partie figée.
- **Rejoindre** — **ajouter** un participant. Interdit dès que la partie est figée.
- **Salle d'attente** — l'état d'une partie tant qu'aucune manche n'est saisie :
  on ajoute, on retire, on se choisit.
- **Gel** — la fermeture de la liste des participants, à la **première manche
  saisie**. Il se déduit de l'existence d'une manche, il ne se stocke pas.
- **Spectateur** — quiconque a le code sans être participant. Lecture seule, avec
  un bandeau qui dit pourquoi. Ce n'est pas une option offerte, c'est la
  conséquence du gel.

### Le journal

Tranché par [Journal d'audit : ce qu'une ligne contient et quand elle s'écrit](https://github.com/Bryan21B/scoring-sheets/issues/11), détaillé dans
`docs/specs/2026-09-09-journal.md`.

- **Case** — la valeur d'un joueur dans une manche. C'est l'unité qu'on saisit,
  qu'on corrige, et que le journal désigne.
- **Journal** — l'écrit d'une partie : append-only, jamais modifié, jamais purgé.
  Il n'est **jamais lu par le moteur**, qui ne connaît que les manches ; ce n'est
  pas une source de vérité, c'est une trace. « Audit » dit pourquoi il existe,
  pas ce qu'il est.
- **Ligne de journal** — l'unité du journal : un **geste** sur une case, le
  joueur agissant **figé à l'écriture**, l'appareil d'où c'est parti, et
  l'horloge du serveur. Le joueur est figé parce que repointer un appareil ne
  relit jamais le passé.
- **Geste** — ce qu'une ligne enregistre : `saisie`, `correction`,
  `suppressionDeManche`, `participantAjoute`, `participantRetire`, `abandon`,
  `reprise`. Les deux derniers ne portent pas de case : ce sont les seuls gestes
  qui changent **ce que les autres ont le droit de faire**. Ni la clôture d'une
  manche ni la fin d'une partie n'en sont : la première ne déplace aucune valeur,
  la seconde se dérive.

### La tablée

Tranché par [Créer une partie et obtenir son code](https://github.com/Bryan21B/scoring-sheets/issues/27), détaillé dans
`docs/adr/0008-la-tablee-se-declare-a-la-creation.md`.

- **Tablée** — l'**effectif déclaré** à la création : combien vous serez. Il fige
  l'instantané de règles, et il n'inscrit personne — les autres arrivent par le
  code. C'est un nombre, jamais une liste, et c'est une **déclaration**, comme
  l'identité : annoncer cinq et jouer à quatre fige les règles de cinq.
- **Seuil** — la valeur de la **condition de fin**, montrée pré-remplie à la
  valeur imprimée pour cette tablée et surchargeable par un entier ≥ 1. C'est le
  seul champ des règles qu'une partie ouvre à la table.

## À trancher

Les cinq questions ouvertes ici à l'origine sont tranchées : deux par
[Configuration déclarative d'un jeu : les champs qui couvrent les quatre entrées](https://github.com/Bryan21B/scoring-sheets/issues/2) — le jeu est une
entité portant ses règles, et la direction du classement dépend du jeu — les
trois autres au cadrage de la carte
([Carte — feuille de score multi-appareils pour 6 qui prend, Uno et Dnup](https://github.com/Bryan21B/scoring-sheets/issues/1)) : le joueur est
persistant entre parties, le score se saisit manche par manche, et il n'y a
aucune authentification — un lien de partage par partie, non devinable.

**Plus rien n'attend d'être nommé.** Tous les tickets de décision de la carte
sont fermés, et le design consolidé est dans
`docs/specs/2026-09-09-feuille-de-score.md`. Ce qui reste est de la mise en forme
d'écran, à trancher en dessinant.

Un terme n'entre toujours ici qu'une fois **décidé**. Ce fichier reste un
glossaire : le détail de chaque décision vit dans son spec, jamais ici.
