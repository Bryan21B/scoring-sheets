# Changelog

## [0.12.0](https://github.com/Bryan21B/scoring-sheets/compare/v0.11.0...v0.12.0) (2026-09-11)

### Fonctionnalités

* **manche:** Écrire une désignation, et distinguer une case touchée d'une absente ([c977d9f](https://github.com/Bryan21B/scoring-sheets/commit/c977d9f2c4cc1818905b7d1d955f023d5e2f4fa1)), closes [#33](https://github.com/Bryan21B/scoring-sheets/issues/33)
* **manche:** Enchaîner les désignations plutôt que de repasser par le récapitulatif ([24f52f6](https://github.com/Bryan21B/scoring-sheets/commit/24f52f67a83bd45a0461a91969d0174a85e101fe)), closes [#33](https://github.com/Bryan21B/scoring-sheets/issues/33)
* **manche:** Faire dériver la passe avant du mode, et lui donner l'écran de désignation ([e6a4c80](https://github.com/Bryan21B/scoring-sheets/commit/e6a4c8095605367e3a878ef256f1fc507bc8d102)), closes [#33](https://github.com/Bryan21B/scoring-sheets/issues/33)

### Refactoring

* **manche:** Refermer ce que la revue a trouvé, et dire vrai dans les JSDoc ([0d60098](https://github.com/Bryan21B/scoring-sheets/commit/0d6009885ceef21536b68cff95be6c227f06f298)), closes [#33](https://github.com/Bryan21B/scoring-sheets/issues/33)

## [0.11.0](https://github.com/Bryan21B/scoring-sheets/compare/v0.10.0...v0.11.0) (2026-09-11)

### Fonctionnalités

* **partie:** Abandonner une partie, et le dire au journal ([80a16d2](https://github.com/Bryan21B/scoring-sheets/commit/80a16d278f4f6c81a211f343ff0659b7503c7703)), closes [#38](https://github.com/Bryan21B/scoring-sheets/issues/38)
* **partie:** Reprendre une partie abandonnée, et fermer le scellement ([5094056](https://github.com/Bryan21B/scoring-sheets/commit/5094056ba22cc84c12152a84c80f20feba92eaf4)), closes [#38](https://github.com/Bryan21B/scoring-sheets/issues/38)
* **partie:** Supprimer une partie tant que son journal est vide ([eeb8190](https://github.com/Bryan21B/scoring-sheets/commit/eeb8190130291580245b54638bd3fef5a7016905)), closes [#38](https://github.com/Bryan21B/scoring-sheets/issues/38)
* **tiroir:** Offrir l'abandon, la reprise et la suppression sous le ⋯ ([2817184](https://github.com/Bryan21B/scoring-sheets/commit/2817184b93a9a5632385bea441f112fc0310d391)), closes [#38](https://github.com/Bryan21B/scoring-sheets/issues/38)

### Corrections

* **partie:** Sonder la fiche d'une partie abandonnée, et resserrer la revue ([f3d0b15](https://github.com/Bryan21B/scoring-sheets/commit/f3d0b154f2307da3b6681b5fcc2abe5bf97da1b6)), closes [#38](https://github.com/Bryan21B/scoring-sheets/issues/38)

## [0.10.0](https://github.com/Bryan21B/scoring-sheets/compare/v0.9.0...v0.10.0) (2026-09-11)

### Fonctionnalités

* **accueil:** Ouvrir l'historique depuis l'accueil, dans ses deux états ([8f78bcf](https://github.com/Bryan21B/scoring-sheets/commit/8f78bcfc7c0aba25c4c325408c35539a1f4b8ef6)), closes [#40](https://github.com/Bryan21B/scoring-sheets/issues/40)
* **historique:** Filtrer par jeu, et par rien d'autre ([df72272](https://github.com/Bryan21B/scoring-sheets/commit/df72272bb4ae1e25a40c7c98e8101631a3efa1c6)), closes [#40](https://github.com/Bryan21B/scoring-sheets/issues/40)
* **historique:** Rendre une ligne, et ce qu'elle dit d'une partie finie ([8bb2fe0](https://github.com/Bryan21B/scoring-sheets/commit/8bb2fe07cbf91d5591e2bb4908b784a6d38cb791)), closes [#40](https://github.com/Bryan21B/scoring-sheets/issues/40)
* **historique:** Renvoyer au catalogue à vide, et dérouler d'une page ([e2fc679](https://github.com/Bryan21B/scoring-sheets/commit/e2fc67968ce107ed450c0396e3248aff14dbef98)), closes [#40](https://github.com/Bryan21B/scoring-sheets/issues/40)
* **historique:** Servir la liste à /historique, adresse comprise ([4e597bf](https://github.com/Bryan21B/scoring-sheets/commit/4e597bf0111e02fe23fd8d8adbe003f7a7101a50)), closes [#38](https://github.com/Bryan21B/scoring-sheets/issues/38) [#40](https://github.com/Bryan21B/scoring-sheets/issues/40)

### Corrections

* **historique:** Arrêter le « voir plus » au plafond, qu'il dépassait ([a644046](https://github.com/Bryan21B/scoring-sheets/commit/a64404671ef7b9ebd85aad62c4847f960636fb11)), closes [#40](https://github.com/Bryan21B/scoring-sheets/issues/40)

## [0.9.0](https://github.com/Bryan21B/scoring-sheets/compare/v0.8.0...v0.9.0) (2026-09-11)

### Fonctionnalités

* **cloture:** Offrir la clôture au récapitulatif et n'y annoncer la fin qu'à ce moment ([906816d](https://github.com/Bryan21B/scoring-sheets/commit/906816defe20c2501818aedb563cb9246120b51b)), closes [#31](https://github.com/Bryan21B/scoring-sheets/issues/31)
* **cloture:** Refuser la clôture à qui n'est pas de la tablée ([6a9e888](https://github.com/Bryan21B/scoring-sheets/commit/6a9e8885ad1820b0c8fbffd3bb711379a7f647bf)), closes [#31](https://github.com/Bryan21B/scoring-sheets/issues/31)
* **historique:** Lire les parties finies, la plus récente d'abord ([d9670de](https://github.com/Bryan21B/scoring-sheets/commit/d9670de13c7c024270d0780e56013e289ead28a1)), closes [#40](https://github.com/Bryan21B/scoring-sheets/issues/40)
* **historique:** Mener la liste à la fiche de partie, grille et journal compris ([944410f](https://github.com/Bryan21B/scoring-sheets/commit/944410f3e5f3416c14a094a6b0a98783f45f52ed)), closes [#40](https://github.com/Bryan21B/scoring-sheets/issues/40)
* **saisie:** Arrêter le geste par un écran quand quelqu'un est passé avant ([c381d95](https://github.com/Bryan21B/scoring-sheets/commit/c381d951abfdf649d03b048f65cce3e4e7f0e1d1)), closes [#30](https://github.com/Bryan21B/scoring-sheets/issues/30)
* **saisie:** Rendre le refus et la clôture lisibles jusqu'à l'écran ([749eb03](https://github.com/Bryan21B/scoring-sheets/commit/749eb0321b78ba7fceda5d08753e652fceadd2b4)), closes [#30](https://github.com/Bryan21B/scoring-sheets/issues/30) [#31](https://github.com/Bryan21B/scoring-sheets/issues/31)
* **saisie:** Rendre un refus lisible plutôt qu'un statut à interpréter ([829a530](https://github.com/Bryan21B/scoring-sheets/commit/829a53005ff7fa0dfec29e7b545844b1e20f497e)), closes [#30](https://github.com/Bryan21B/scoring-sheets/issues/30)

## [0.8.0](https://github.com/Bryan21B/scoring-sheets/compare/v0.7.0...v0.8.0) (2026-09-10)

### Fonctionnalités

* **spectateur:** Mettre en lecture seule qui a le code sans jouer ([cc944dc](https://github.com/Bryan21B/scoring-sheets/commit/cc944dc118d9fe460b5e7b21230e0faf3d267f7d)), closes [#34](https://github.com/Bryan21B/scoring-sheets/issues/34)

### Refactoring

* **tests:** Donner une seule Zoé aux écrans, et exiger le sondage ([944250b](https://github.com/Bryan21B/scoring-sheets/commit/944250beb5c78f50ea49edd6addb1a486492904c)), closes [#34](https://github.com/Bryan21B/scoring-sheets/issues/34)

## [0.7.0](https://github.com/Bryan21B/scoring-sheets/compare/v0.6.0...v0.7.0) (2026-09-10)

### Fonctionnalités

* **accueil:** Faire de l'accueil la partie en cours, grille et poll compris ([4cc6f88](https://github.com/Bryan21B/scoring-sheets/commit/4cc6f88f9e3c1e9a110196c3620f5e5d9772c663)), closes [#32](https://github.com/Bryan21B/scoring-sheets/issues/32)
* **accueil:** Lire la partie en cours, sa grille et son estampille ([d81b5be](https://github.com/Bryan21B/scoring-sheets/commit/d81b5bee2665b03528722d068a442c6e53c1d766)), closes [#32](https://github.com/Bryan21B/scoring-sheets/issues/32)

### Refactoring

* **accueil:** Sortir la coquille, l'action et la règle du tableau vide ([ae614cd](https://github.com/Bryan21B/scoring-sheets/commit/ae614cd6de21f8ca498df71a4bf70ca7ac9c98c2)), closes [#32](https://github.com/Bryan21B/scoring-sheets/issues/32)
* **sondage:** Donner un seul nom au sondage dans les identifiants ([29c468c](https://github.com/Bryan21B/scoring-sheets/commit/29c468cf95cfe4f1dfbb05ab4797a1d42aec2342)), closes [#32](https://github.com/Bryan21B/scoring-sheets/issues/32)

## [0.6.0](https://github.com/Bryan21B/scoring-sheets/compare/v0.5.0...v0.6.0) (2026-09-10)

### Fonctionnalités

* Ouvrir le journal d'une partie dans un tiroir discret ([ccf969f](https://github.com/Bryan21B/scoring-sheets/commit/ccf969f460863043e62d54639a566eb39480a236)), closes [#35](https://github.com/Bryan21B/scoring-sheets/issues/35)

## [0.5.0](https://github.com/Bryan21B/scoring-sheets/compare/v0.4.0...v0.5.0) (2026-09-10)

### Fonctionnalités

* **manche:** Clore une manche complète et estampiller la fin de partie ([901c7e1](https://github.com/Bryan21B/scoring-sheets/commit/901c7e1b9b5d15d670d8f9799b2fbafba5923ce2)), closes [#31](https://github.com/Bryan21B/scoring-sheets/issues/31)
* **partie:** Sceller une partie terminée contre toute écriture ([1204b3e](https://github.com/Bryan21B/scoring-sheets/commit/1204b3e8d93bd35a8fb49f5c10b854e715433170)), closes [#31](https://github.com/Bryan21B/scoring-sheets/issues/31)

## [0.4.0](https://github.com/Bryan21B/scoring-sheets/compare/v0.3.0...v0.4.0) (2026-09-10)

### Fonctionnalités

* **partie:** Rejoindre une partie par son code, en salle d'attente ([5f150c8](https://github.com/Bryan21B/scoring-sheets/commit/5f150c858b4b19a253f17468fe2d70d0f246e720)), closes [#28](https://github.com/Bryan21B/scoring-sheets/issues/28)

### Corrections

* **outils:** Nommer les chemins à linter, pour que Biome tourne aussi dans un worktree ([579eda5](https://github.com/Bryan21B/scoring-sheets/commit/579eda59fb242a858431d6a68d92a4858b1b6661))

## [0.3.0](https://github.com/Bryan21B/scoring-sheets/compare/v0.2.0...v0.3.0) (2026-09-10)

### Fonctionnalités

* **manche:** Saisir sa case sous condition, et l'écrire au journal ([95b7930](https://github.com/Bryan21B/scoring-sheets/commit/95b7930504aa89e28452db255534d5269021c9c3)), closes [#29](https://github.com/Bryan21B/scoring-sheets/issues/29)

### Corrections

* **jeux:** Surcharger la saisie autant que la fin selon l'effectif ([3fd1b89](https://github.com/Bryan21B/scoring-sheets/commit/3fd1b89e687500a9553961423e9573531432f04e)), closes [#42](https://github.com/Bryan21B/scoring-sheets/issues/42)

## [0.2.0](https://github.com/Bryan21B/scoring-sheets/compare/v0.1.0...v0.2.0) (2026-09-09)

### Fonctionnalités

* **jeux:** Évaluer une partie depuis ses règles et ses manches ([6c73f38](https://github.com/Bryan21B/scoring-sheets/commit/6c73f3846674d1ea3a98ca86a3c096956cf3398f)), closes [#26](https://github.com/Bryan21B/scoring-sheets/issues/26)
* **partie:** Créer une partie, poser le cookie d'appareil et rendre son code ([0da46f5](https://github.com/Bryan21B/scoring-sheets/commit/0da46f5cf47fe89859c410878a5c2383808233e8)), closes [#27](https://github.com/Bryan21B/scoring-sheets/issues/27)

## [0.1.0](https://github.com/Bryan21B/scoring-sheets/compare/v0.0.0...v0.1.0) (2026-09-09)

### Fonctionnalités

* **db:** Poser les sept tables, leurs contraintes et leurs déclencheurs ([042e48a](https://github.com/Bryan21B/scoring-sheets/commit/042e48a023f5f538e1d6ebc7604c6ca63b7ed118)), closes [#24](https://github.com/Bryan21B/scoring-sheets/issues/24)
* **jeux:** Déclarer le catalogue des quatre entrées et résoudre leurs règles ([3d94f22](https://github.com/Bryan21B/scoring-sheets/commit/3d94f2294b100187a687e445998b765736d34069)), closes [#25](https://github.com/Bryan21B/scoring-sheets/issues/25)
