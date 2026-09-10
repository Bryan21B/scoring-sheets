# 0010 — La limite de débit ne compte que les échecs

- **Statut** : acceptée
- **Date** : 2026-09-09
- **Spec** : `docs/specs/2026-08-31-identite-et-arrivee.md`
- **Ticket** : [Rejoindre une partie par son code, en salle d'attente](https://github.com/Bryan21B/scoring-sheets/issues/28)

## Contexte

La spec d'identité demande une **limite de débit sur la recherche par code** :
2³⁰ combinaisons pour quelques centaines de parties font une chance sur un
million par tirage aveugle — négligeable en enjeu, mais un script en tire un
million sans transpirer.

Deux contraintes se rencontrent, et elles tirent en sens inverse.

- **Le code est l'unique porte d'entrée d'une partie.** Le lien reçu et le code
  retapé passent tous les deux par `/p/<code>`, et une action d'écriture doit y
  passer aussi, sans quoi elle serait un deuxième chemin non limité pour
  découvrir une partie.
- **La même porte est franchie en boucle par ceux qui jouent.** `docs/adr/0003`
  a tranché le **sondage** plutôt que le push : six téléphones autour d'une table
  reliront la même partie toute la soirée, à intervalle court.

Un compteur posé sur *toutes* les recherches enfermerait donc exactement ceux
qu'il n'y a rien à protéger contre, et il casserait le sondage le jour où il
arrivera.

## Approches comparées

### A — Compter toutes les recherches, avec un plafond large

Un seul compteur par origine, incrémenté à chaque lecture.

Écartée. Le plafond devrait couvrir le sondage d'une tablée entière derrière une
même adresse — plusieurs centaines de requêtes par minute — et à ce niveau il
n'arrête plus l'énumération qu'il existe pour arrêter. La limite deviendrait
décorative.

### B — Ne compter que les recherches infructueuses *(retenue)*

Le compteur ne bouge que lorsqu'un code **ne désigne aucune partie**.

Un script qui énumère ne produit que des échecs : il consomme son quota en
quelques tirages. Une table qui joue ne produit que des succès : elle ne touche
jamais le compteur, quel que soit le rythme du sondage.

### C — Un compteur persistant, en base

Écartée. Une énumération qui traverse plusieurs instances se paie déjà en
latence réseau ; y ajouter une **écriture par tentative** donnerait au script la
charge qu'il cherche précisément à provoquer. La mémoire du processus suffit
pour un déploiement dont l'enjeu est nul.

## Décision

**La recherche par code est limitée sur ses échecs, par fenêtre fixe, en mémoire
du processus.**

- **Dix échecs par minute et par origine.** Se tromper d'une lettre en retapant
  un code dicté arrive, et plusieurs fois de suite ; tirer 2³⁰ combinaisons à ce
  rythme prendrait deux mille ans.
- **Une fois fermée, la limite refuse aussi le bon code.** Sinon elle se
  contournerait en glissant un code connu entre deux tirages aveugles.
- **L'origine est l'adresse que la plateforme a résolue, à défaut l'appareil.**
  Un script n'accepte pas les cookies ; une clé qui ne serait que le cookie lui
  donnerait un compteur neuf à chaque tentative. Les deux espaces sont préfixés,
  faute de quoi un cookie forgé à la forme d'une adresse userait le compteur de
  quelqu'un d'autre.
- **Le dernier maillon de `x-forwarded-for`, jamais le premier.** L'en-tête
  s'allonge à chaque relais et c'est le **client** qui en écrit la gauche : lire
  à gauche rendrait la limite contournable en changeant une chaîne à chaque
  requête, ce qui est exactement l'attaque qu'elle existe pour arrêter. Le
  maillon de droite est le seul que notre propre mandataire a constaté, et
  `x-real-ip` — que la plateforme écrase — passe avant lui.
- **L'horloge et le limiteur sont des paramètres**, jamais `Date.now()` ni un
  singleton importé : la fenêtre se vérifie sans attendre une minute, et deux
  tests ne partagent aucun état.

## Conséquences

- **`chercherPartieParCode` est la seule porte.** Les actions d'écriture de la
  salle d'attente y passent aussi ; une lecture directe par `lirePartieParCode`
  depuis une route annulerait la limite.
- **Le sondage de `docs/adr/0003` n'a rien à négocier avec elle.** Il relit une
  partie qui existe, donc il ne compte pas — c'est ce que cette décision achète,
  et c'est la raison de la préférer à un plafond large.
- **La limite ne survit pas à un redémarrage ni ne se partage entre instances.**
  Assumé : elle borne un débit, elle ne tient pas un quota, et l'enjeu derrière
  le code est la lecture d'une feuille de score entre amis.
- **Une tablée derrière une même adresse partage un compteur.** Sans
  conséquence, précisément parce que seuls les échecs s'y comptent.
- **L'écran « trop d'essais » est distinct de « code inconnu ».** Les confondre
  ferait retaper indéfiniment quelqu'un dont chaque essai est refusé d'avance.
