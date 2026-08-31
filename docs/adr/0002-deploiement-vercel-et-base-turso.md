# 0002 — Déploiement sur Vercel, base sur Turso

- **Statut** : acceptée
- **Date** : 2026-08-31

## Contexte

Le template `bryan-cookie-starter` ne tranche pas la cible de déploiement : il
livre de quoi partir sur Vercel ou sur un VPS (Podman + Quadlet, image publiée
sur GHCR, digest épinglé par une PR chez un repo infra), et demande au
scaffolding d'en matérialiser **une seule**.

`scoring-sheets` est une app de loisir, à faible trafic, sans contrainte de
souveraineté sur les données. La branche VPS suppose un repo infra existant, un
jeton `VPS_SETUP_TOKEN`, une revue humaine de la PR de digest et un converge
Ansible : une chaîne solide, mais dont le coût fixe n'est pas justifié ici.

## Décision

**Vercel**, avec la base sur **Turso**.

Concrètement, au scaffolding :

- Suppression de `Containerfile`, `.dockerignore`, `docs/deployment.md` et des
  scripts `docker:*`.
- Suppression des jobs `container` et `publish` de `.github/workflows/ci.yml` ;
  `release` ne dépend plus que de `check` et `e2e`.
- Ajout d'un job `deploy` dans **ce même fichier**, avec le même
  `needs: [check, e2e]`. Un workflow séparé tournerait en parallèle des checks
  et pourrait mettre en ligne un commit rouge.
- `deploy` ne dépend pas de `release` : un `chore:` ne produit aucune version
  mais doit partir en prod.
- Retrait de `output: standalone` et de sa condition `BUILD_STANDALONE` de
  `next.config.ts` — plus aucune image ne les consomme.

Et pour la base : le système de fichiers de Vercel est **éphémère**. Un fichier
SQLite y disparaît au redéploiement suivant. `DATABASE_PATH` doit donc pointer
sur une URL `libsql://` servie par Turso, et `TURSO_AUTH_TOKEN` porte le jeton si
la base est protégée. Grâce à l'ADR `0001`, cela ne change **aucune ligne**
d'appelant : le driver est déjà libSQL.

## Conséquences

- Secrets à créer côté repo GitHub : `VERCEL_TOKEN`, `VERCEL_ORG_ID`,
  `VERCEL_PROJECT_ID`.
- `TURSO_AUTH_TOKEN` entre dans `src/lib/env.ts` et `.env.example`. Il est
  optionnel et accepte la chaîne vide, pour que `.env.example` reste copiable tel
  quel en dev où la base est un fichier local.
- `PRAGMA journal_mode = WAL` n'est plus posé que sur un fichier local : une base
  Turso gère son propre journal et refuse le pragma. Les pragmas passent par un
  `.catch`, faute de quoi un rejet non géré tuerait le process Node.
- **La CI n'a plus aucun artefact à publier.** Elle ne pousse plus d'image, ne se
  connecte à aucune machine, n'ouvre plus de PR ailleurs.
- Le job `release` reste : le tag, le CHANGELOG et la release GitHub gardent leur
  utilité même sans image.
- Réversible sans drame si le projet devait migrer sur le VPS — le
  `Containerfile` est dans l'historique Git, et `SETUP.md` (supprimé au
  scaffolding, lui aussi dans l'historique) porte la recette complète de la
  branche B.
