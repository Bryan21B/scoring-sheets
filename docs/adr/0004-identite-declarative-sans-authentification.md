# 0004 — Une identité déclarative, sans authentification

- **Statut** : acceptée
- **Date** : 2026-09-09
- **Spec** : `docs/specs/2026-08-31-identite-et-arrivee.md`

## Contexte

L'application est une feuille de score partagée entre une dizaine d'amis. La
question « qui es-tu » se pose quand même : il faut savoir quel joueur saisit,
pour que le journal ait un auteur et que la passe avant démarre sur la bonne
personne.

La réponse réflexe est un compte et un mot de passe. Elle coûte cher pour ce
qu'elle apporte ici : un écran d'inscription entre des amis et une feuille de
score, un mot de passe oublié un vendredi soir, et une base de secrets à protéger
pour dix personnes qui se voient en vrai.

Deux contraintes du domaine ferment la porte à une autorisation fine, de toute
façon :

- **Les règles d'Uno et de Dnup imposent qu'une personne compte pour toute la
  table.** Il n'existe pas de découpage où chacun n'écrirait que « sa » case.
- **Un participant peut n'avoir aucun appareil.** Le créateur a le droit
  d'ajouter des joueurs pour eux, et il faut bien que quelqu'un saisisse à leur
  place.

## Décision

**Aucune authentification.**

- Un **lien de partage par partie**, portant un code de six caractères en
  Crockford Base32, fait pour être **dicté à voix haute** et jamais recyclé. Il
  donne la **lecture** ; l'**écriture** demande d'être participant.
- Une **identité par appareil**, portée par un cookie serveur `HttpOnly` de 400
  jours réémis à chaque requête. L'appareil pointe vers **un** joueur,
  **globalement** et non par partie. Plusieurs appareils peuvent pointer le même
  joueur.
- **Pas de fingerprinting** : Safari 26 plafonnerait le stockage qu'il devait
  secourir, et l'entropie iOS ne distingue pas deux iPhone identiques.
- **N'importe quel participant écrit n'importe quelle case.**

## Le lien appareil vers joueur est une déclaration, pas une preuve

**Cette phrase doit survivre à tout le reste du document.**

Le journal dit « cet appareil, se déclarant Marie, a changé cette case ». **Il ne
dit pas que Marie l'a fait, et il ne peut pas.** N'importe qui peut repointer son
appareil vers n'importe quel joueur, à tout moment, et rien ne l'en empêche.

Il en découle, sans exception :

- **Le journal d'audit n'est pas un contrôle de sécurité.** C'est une trace, pas
  une preuve, et « audit » dit pourquoi il existe, pas ce qu'il est. L'anomalie
  qu'on y cherche est une **erreur de frappe**, jamais une fraude.
- **Le code de partie n'est pas un secret.** Il est court exprès, pour être dicté.
  Quiconque l'a peut lire.
- **Aucune fonctionnalité future ne doit s'appuyer sur cette identité comme sur
  une autorisation.** Si un jour une donnée mérite une vraie protection, elle
  mérite une vraie authentification, et c'est une décision à reprendre à zéro —
  pas une couche à poser sur celle-ci.

Le lien est **modifiable vers l'avant seulement** : le changer ne relit jamais le
passé. C'est pour cela que le journal **fige le joueur agissant à l'écriture**.
Sans ce gel, repointer son téléphone réécrirait tout l'historique de ses lignes.

## Conséquences

- **Le journal devient le seul garde-fou** contre un score qui bouge tout seul, et
  il est assumé comme tel : discret, derrière un menu, append-only et jamais purgé.
- **Deux gestes d'arrivée, pas un.** *Réclamer* une place déjà présente reste
  permis après le gel de la liste ; *rejoindre*, qui ajoute un participant, ne
  l'est plus.
- **Le spectateur n'est pas une option offerte**, c'est la conséquence du gel :
  quiconque a le code sans être participant lit, avec un bandeau qui dit pourquoi.
- **Aucun secret nouveau à gérer**, donc rien n'entre dans la boucle des
  credentials tant que la base distante n'est pas réelle.
