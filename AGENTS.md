# AGENTS.md

Fichier de vérité pour les conventions, commandes et standards de ce repo.
Le plus proche du fichier édité gagne. Une consigne donnée en chat prime sur ce fichier.

## Project overview

Application Next.js (App Router) en TypeScript strict, base SQLite via Drizzle,
validation runtime avec Zod, UI Tailwind + shadcn/ui. Voir `CONTEXT.md` pour le
vocabulaire métier, `SETUP.md` pour la checklist de scaffolding d'un nouveau projet.

## Setup / Dev environment

- Install : `bun install`
- Dev server : `bun dev` (http://localhost:3000)
- Variables d'env : copier `.env.example` vers `.env.local`

## Build & test commands

- Build : `bun run build`
- Tests unitaires : `bun run test`
- Un seul test : `bun run test -t "<pattern>"`
- Tests e2e : `bun run test:e2e` (build de prod + navigateur, lent)
- Check rapide (lint + types + unit) : `bun run check`
- Check complet, ce que fait la CI : `bun run check:all`
- Migrations : `bun run db:generate` puis `bun run db:migrate`

## Testing instructions

- **Unitaires par défaut.** `tests/unit/**/*.test.ts`, `bun test` (runner intégré,
  API compatible Jest — importer depuis `bun:test`, pas `vitest`).
- **E2E à part.** `tests/e2e/**/*.spec.ts`, Playwright, contre un build de prod.
  Ne pas les mettre dans `bun run test` : la boucle locale doit rester rapide.
- **On ne re-teste jamais un package externe.** Pas de test sur le comportement de
  winston, Drizzle ou SQLite. On teste nos artefacts : schémas Zod, migrations
  générées, contrats d'API. Avant d'écrire un test, se demander « qu'est-ce qui
  casse ici si *notre* code change ? » — si la réponse est « rien », pas de test.
- Rien n'arrive sur `main` sans `bun run check` au vert en local ; la CI rejoue
  lint, types, unitaires, e2e et build d'image sur chaque push, et rien ne se
  release si l'un d'eux est rouge.

## Code style

Biome recommended, durci pour bloquer les anti-patterns ci-dessous. Le formatage
est appliqué par `.claude/hooks/format-after-edit.sh` après chaque édition et par
lint-staged au pre-commit — ne pas discuter de style en prose, laisser l'outil faire.

Anti-patterns bloqués par le linter, à ne jamais contourner :

- `any` → typer correctement
- Assertion non-null `!` → narrowing de type
- Promise flottante → `await` ou `void` explicite
- Bloc de contrôle sans accolades → toujours des accolades
- `console.*` → passer par `logger` (`src/lib/logger.ts`)

Non couverts par le linter, mais tout aussi fermes :

- **JSDoc sur tout export public** — fonction, type, constante. Le bloc dit le
  *pourquoi* et les invariants, jamais la reformulation de la signature.
- **Commentaire = pourquoi, pas quoi.** Le code dit déjà le quoi.
- **Pas de type ni de constante dupliqués entre modules** — exporter depuis le
  module propriétaire, importer ailleurs.
- **Jamais de template literal dans `exec`/`spawn`** — construire les arguments
  en tableau (`execFileSync("git", [...])`), sinon injection de commande (CWE-78).

## Architecture

- `src/app/` — routes App Router. `src/app/health/route.ts` est la sonde de santé.
- `src/db/` — `schema.ts` (Drizzle), `index.ts` (connexion libSQL), `url.ts` (pur,
  sans effet de bord). Migrations générées dans `drizzle/`, jamais éditées à la main.
- `src/lib/env.ts` — schéma Zod de l'environnement, parsé une fois au boot.
- `src/lib/logger.ts` — winston, server-only, sortie JSON sur stdout.
- `scripts/*.mjs` — outillage runtime en JS pur, exécutable sans toolchain TS
  (le conteneur de prod n'en a pas).

## Gotchas

- **Deux runtimes, par choix.** `bun test` fait tourner les tests sous Bun ;
  Next.js build et sert sous Node. libSQL est le seul driver SQLite qui marche
  sur les deux — ne pas le remplacer par `better-sqlite3` (panic N-API sous Bun)
  ni par `bun:sqlite` (indisponible sous Node). Voir `docs/adr/0001`.
- **`bun test` n'a pas de `resetModules`.** Un module qui doit être testé sous
  plusieurs environnements expose une fonction paramétrable — c'est pourquoi
  `src/lib/env.ts` exporte `parseEnv(source)` en plus de la constante `env`.
- **Un test ne doit jamais importer `@/db`** : le module ouvre une connexion à
  l'import. Importer `@/db/url` pour le pur, ou construire un client dédié.
- **`output: standalone` est derrière `BUILD_STANDALONE=1`**, sinon `next start`
  refuse de servir le build. Seul le `Containerfile` pose cette variable.
- **`.env.example` et `src/lib/env.ts` doivent rester synchrones** — le hook
  pre-commit refuse le commit sinon.
- **`main` distant prend un commit d'avance après chaque release.** semantic-release
  pousse `chore(release): x.y.z [skip ci]` (CHANGELOG + `package.json`). Le clone
  local est alors en retard et le push suivant est rejeté : `git pull --rebase`
  avant de repartir. Ce commit ne relance pas la CI — GitHub ne déclenche rien
  pour un push fait avec le `GITHUB_TOKEN`.

## Commit & push

- **Commit direct sur `main`, pas de PR.** Chaque push vert déclenche le tag, le
  CHANGELOG, la release GitHub et l'image. Le pipeline est dans
  `.github/workflows/ci.yml`, seul fichier de CI/CD.
- **Le préfixe du commit est du code, pas de la décoration.** semantic-release
  en dérive la version : `feat:` → mineur, `fix:` → patch, `BREAKING CHANGE:` →
  mineur tant qu'on est en `0.x` (règle explicite dans `.releaserc.json`, à
  retirer le jour de la 1.0). Il n'y a plus de review pour rattraper un préfixe
  faux — c'est une version fausse, publiée, définitive.
- Commits petits et single-purpose. Un prompt ≠ un commit, découper.
- Référencer l'issue dans le commit (`fixes #12`) : semantic-release commente
  l'issue à la sortie de la version.
- `bun run check` vert avant de pousser — le hook pre-push le lance. Lancer
  `bun run check:all` à la main dès que le changement touche l'UI ou une route :
  l'e2e ne tourne qu'en CI, donc un échec arrive quand le commit est déjà sur `main`.

## Security considerations

- Aucun secret réel commité, jamais. `.env.example` liste les noms, pas les valeurs.
- Le hook pre-push scanne les clés AWS/GitHub/Stripe, blocs PEM et JWT.
- Ne jamais lire un `.env` (bloqué par `.claude/hooks/block-dangerous-bash.sh`) :
  les valeurs réelles n'ont rien à faire dans le contexte de l'agent.
- Toute entrée externe passe par un schéma Zod avant d'atteindre la logique métier.
