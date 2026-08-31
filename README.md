# bryan-cookie-starter

Template GitHub pour projets solo, pensé pour le dev assisté par agent.

Next.js (App Router) · TypeScript strict · SQLite + Drizzle · Zod · Tailwind +
shadcn/ui · Biome · winston · bun test · Playwright · Bun · Podman.

## Démarrer un projet

1. **Use this template** sur GitHub, puis cloner.
2. Ouvrir le repo avec Claude Code et lui demander de dérouler `SETUP.md`.
   Il pose les questions (nom, cible de déploiement, base, monorepo), applique
   les substitutions, retire ce qui ne s'applique pas, puis supprime `SETUP.md`.

Le template ne présume **pas** de la cible de déploiement : aucun workflow de
déploiement n'est livré, `SETUP.md` porte les recettes Vercel et VPS et l'agent
matérialise celle que tu choisis.

## Commandes

| Commande | Effet |
|---|---|
| `bun install` | Dépendances |
| `bun dev` | Serveur de dev sur http://localhost:3000 |
| `bun run build` | Build de production |
| `bun run check` | Lint + types + tests unitaires (boucle locale) |
| `bun run check:all` | Idem + e2e (ce que fait la CI) |
| `bun run test` | Tests unitaires (`bun test`) |
| `bun run test:e2e` | Tests e2e (Playwright, sur un build de prod) |
| `bun run db:generate` | Génère une migration depuis le schéma Drizzle |
| `bun run db:migrate` | Applique les migrations |
| `bun run db:studio` | Explorateur de base Drizzle |

## Ce qu'il y a dans la boîte

**Qualité.** Biome en lint + format, configuré pour refuser `any`, les assertions
non-null, les promises flottantes, les blocs sans accolades et `console.*`.
TypeScript en `strict` avec `noUncheckedIndexedAccess` et
`exactOptionalPropertyTypes`.

**Tests.** `bun test` pour l'unitaire, Playwright pour l'e2e, commandes séparées.
On ne teste jamais le comportement d'un package externe.

**Garde-fous.** Husky au pre-commit (lint-staged, typecheck, synchro
`.env.example` ↔ schéma d'env) et au pre-push (scan de secrets, puis lint, types
et tests unitaires — on pousse sur `main`, la dernière relecture est ici). Hooks
Claude Code pour formater après chaque édition et bloquer les commandes
destructives. Permissions à trois niveaux dans `.claude/settings.json`.

**Livraison.** Pas de PR : on pousse sur `main`, un pipeline unique fait tout.
Lint/types/unit, e2e et build d'image tournent en parallèle ; s'ils sont verts,
semantic-release dérive le semver et le CHANGELOG des conventional commits,
tague, crée la release et publie l'image sur GHCR. Rouge, rien ne sort.

**Prêt pour l'auto-hébergement.** `Containerfile` multi-étapes, non-root, endpoint
`/health`, chemin de données injectable, logs JSON sans écriture disque.
`docs/deployment.md` porte le contrat pour le repo infra.

## Fichiers de référence

| Fichier | Contenu |
|---|---|
| `AGENTS.md` | Conventions, commandes, standards — **fichier de vérité** |
| `CLAUDE.md` | Spécifique Claude Code : hooks, permissions, boucle de travail |
| `CONTEXT.md` | Glossaire du vocabulaire métier |
| `SETUP.md` | Checklist de scaffolding, supprimée après usage |
| `docs/adr/` | Décisions d'architecture |
| `docs/specs/` | Design docs, avant les features non-triviales |
| `docs/deployment.md` | Contrat de déploiement pour le repo infra |
