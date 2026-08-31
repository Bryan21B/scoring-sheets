# AGENTS.md

Fichier de vérité pour les conventions, commandes et standards de ce repo.
Le plus proche du fichier édité gagne. Une consigne donnée en chat prime sur ce fichier.

## Project overview

Feuilles de score pour parties de cartes entre amis. Une partie réunit des
joueurs autour d'un jeu, se déroule en manches, et chaque manche attribue des
points ; l'app tient les totaux et l'historique à la place du carnet et du stylo.

**Le domaine n'est pas encore modélisé.** `src/db/schema.ts` ne déclare aucune
table et `drizzle/` ne porte aucune migration — c'est un état voulu, pas un
oubli. Poser le modèle passe par un design doc dans `docs/specs/` (boucle de
travail dans `CLAUDE.md`), pas par une table écrite au fil de l'eau. Le
vocabulaire se fixe dans `CONTEXT.md` au fur et à mesure qu'il se décide.

## Setup / Dev environment

- Install : `bun install`
- Dev server : `bun dev` (http://localhost:3000)
- Variables d'env : `cp .env.example .env.local`. Aucune des variables actuelles
  n'est un secret, donc 1Password n'est pas dans la boucle locale aujourd'hui.
- **Au premier secret réel** — `TURSO_AUTH_TOKEN` en tête, dès que la base de
  prod est protégée — basculer sur 1Password au lieu de coller la valeur :

  ```bash
  op item create --category="Secure Note" --vault=Infra --title="scoring-sheets dev"
  op item create --category="Secure Note" --vault=Infra --title="scoring-sheets prod"
  ```

  Puis créer `.env.tpl` à la racine (commité, valeurs = références
  `op://Infra/scoring-sheets dev/<VAR>`) et rendre le fichier local :

  ```bash
  op signin                            # une fois par session de travail
  op inject -i .env.tpl -o .env.local  # après un clone, ou après une rotation
  ```

  `.gitignore` porte déjà l'exception pour `.env.tpl`. Pas de `op run` dans la
  boucle locale : il faudrait préfixer chaque commande, et les sous-processus
  (Playwright, Drizzle Kit) n'héritent pas toujours de l'env.

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
  lint, types, unitaires et e2e sur chaque push, et ni la release ni le
  déploiement ne partent si l'un d'eux est rouge.

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

- `src/app/` — routes App Router. `page.tsx` est la page d'accueil (placeholder
  tant que le domaine n'existe pas), `health/route.ts` la sonde de santé, qui
  touche la base à dessein.
- `src/components/ui/` — primitives shadcn/ui. Les ajouter avec
  `bunx shadcn@latest add <composant>`, ne pas les écrire à la main.
- `src/db/` — `schema.ts` (Drizzle, vide pour l'instant), `index.ts` (connexion
  libSQL, pragmas, singleton de dev), `url.ts` (pur, sans effet de bord).
  Migrations générées dans `drizzle/`, jamais éditées à la main.
- `src/lib/env.ts` — schéma Zod de l'environnement, parsé une fois au boot.
- `src/lib/logger.ts` — winston, server-only, sortie JSON sur stdout.
- `scripts/*.mjs` — outillage runtime en JS pur, exécutable sans toolchain TS :
  `migrate.mjs` (lancé avant de servir, y compris par Playwright),
  `check-env-sync.mjs` et `scan-secrets.mjs` (hooks Git).

## Gotchas

- **Deux runtimes, par choix.** `bun test` fait tourner les tests sous Bun ;
  Next.js build et sert sous Node. libSQL est le seul driver SQLite qui marche
  sur les deux — ne pas le remplacer par `better-sqlite3` (panic N-API sous Bun)
  ni par `bun:sqlite` (indisponible sous Node). Voir `docs/adr/0001`.
- **Le fichier SQLite ne survit pas en prod.** Vercel a un système de fichiers
  éphémère : la base doit être Turso, `DATABASE_PATH` pointant sur une URL
  `libsql://`. Le driver est le même, il n'y a rien à réécrire. Voir
  `docs/adr/0002`.
- **`TURSO_AUTH_TOKEN` vide vaut absent.** Le schéma Zod l'accepte vide pour que
  `.env.example` reste copiable tel quel vers `.env.local` ; c'est
  `src/db/index.ts` qui retraduit la chaîne vide en « pas de jeton ». Ne pas y
  remettre un `.min(1)` sans traiter les deux bouts.
- **Les pragmas sont fire-and-forget, mais jamais sans `.catch`.** Une promesse
  rejetée non gérée tue le process Node, et un endpoint Turso distant refuse
  bien plus volontiers un pragma qu'un fichier local. `journal_mode = WAL` n'est
  d'ailleurs posé que sur un fichier local — il n'a aucun sens à distance.
- **`bun test` n'a pas de `resetModules`.** Un module qui doit être testé sous
  plusieurs environnements expose une fonction paramétrable — c'est pourquoi
  `src/lib/env.ts` exporte `parseEnv(source)` en plus de la constante `env`.
- **Un test ne doit jamais importer `@/db`** : le module ouvre une connexion à
  l'import. Importer `@/db/url` pour le pur, ou construire un client dédié.
- **`drizzle/` ne porte qu'un journal vide, et doit rester chargeable.**
  `playwright.config.ts` lance `scripts/migrate.mjs` avant de servir : supprimer
  le dossier ferait échouer l'e2e sur un timeout obscur plutôt que sur l'erreur
  de migration réelle.
- **`.env.example` et `src/lib/env.ts` doivent rester synchrones** — le hook
  pre-commit refuse le commit sinon.
- **`main` distant prend un commit d'avance après chaque release.** semantic-release
  pousse `chore(release): x.y.z [skip ci]` (CHANGELOG + `package.json`). Le clone
  local est alors en retard et le push suivant est rejeté : `git pull --rebase`
  avant de repartir. Ce commit ne relance pas la CI — GitHub ne déclenche rien
  pour un push fait avec le `GITHUB_TOKEN`.

## Commit & push

- **Commit direct sur `main`, pas de PR.** Chaque push vert déclenche le tag, le
  CHANGELOG, la release GitHub et le déploiement sur Vercel. Le pipeline est dans
  `.github/workflows/ci.yml`, seul fichier de CI/CD.
- **`deploy` ne dépend pas de `release`.** Un `chore:` ou un `docs:` ne produit
  aucune version mais part quand même en prod — c'est voulu. Les deux jobs ont le
  même `needs: [check, e2e]` : c'est lui, et rien d'autre, qui empêche un commit
  rouge d'atteindre la prod.
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
- **Aucun secret applicatif aujourd'hui** : `NODE_ENV`, `DATABASE_PATH`,
  `LOG_LEVEL` et `PORT` n'en sont pas. `TURSO_AUTH_TOKEN` en sera un dès que la
  base de prod existera — à ce moment-là, 1Password devient la source de vérité
  (vault `Infra`, items `scoring-sheets dev` / `scoring-sheets prod`), suivant la
  procédure de « Setup / Dev environment ».
- Les secrets de déploiement (`VERCEL_TOKEN`, `VERCEL_ORG_ID`,
  `VERCEL_PROJECT_ID`) restent des secrets GitHub natifs. Les copier dans
  1Password comme filet de restauration, pas comme source.
- Le hook pre-push scanne les clés AWS/GitHub/Stripe, blocs PEM et JWT.
- Ne jamais lire un `.env` (bloqué par `.claude/hooks/block-dangerous-bash.sh`) :
  les valeurs réelles n'ont rien à faire dans le contexte de l'agent.
- Toute entrée externe passe par un schéma Zod avant d'atteindre la logique métier.
