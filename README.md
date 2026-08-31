# scoring-sheets

Suivre les scores des parties de cartes entre amis : une feuille par partie, les
manches saisies au fil de l'eau, les totaux qui se tiennent à jour tout seuls.

Next.js (App Router) · TypeScript strict · Drizzle sur libSQL (SQLite en dev,
Turso en prod) · Zod · Tailwind + shadcn/ui · Biome · winston · bun test ·
Playwright · Bun · Vercel.

## Démarrer

```bash
bun install
cp .env.example .env.local   # aucune valeur secrète pour l'instant
bun dev                      # http://localhost:3000
```

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

## État

Le squelette tourne — page d'accueil, sonde `/health`, chaîne de migrations, CI
et déploiement. **Le domaine n'est pas encore modélisé** : `src/db/schema.ts` ne
déclare aucune table et `drizzle/` ne porte aucune migration. Les parties, les
joueurs, les manches et les points passent par un design doc dans `docs/specs/`
avant d'avoir des tables — voir la boucle de travail dans `CLAUDE.md`.

## Déploiement

**Vercel**, depuis `.github/workflows/ci.yml` — il n'y a pas d'autre fichier de
CI/CD. Chaque push vert sur `main` part en prod, indépendamment de la release :
une correction en `chore:` ne produit aucune version mais doit être en ligne.
Le job `deploy` dépend de `check` et `e2e`, donc un commit rouge n'atteint jamais
la prod.

**La base doit être Turso en prod.** Le système de fichiers de Vercel est
éphémère : un fichier SQLite y disparaît au redéploiement suivant. Le driver est
déjà libSQL, donc il n'y a rien à réécrire — créer une base Turso, pointer
`DATABASE_PATH` sur son URL `libsql://` et poser `TURSO_AUTH_TOKEN` si elle est
protégée.

Secrets à créer côté repo GitHub : `VERCEL_TOKEN`, `VERCEL_ORG_ID`,
`VERCEL_PROJECT_ID`.

## Fichiers de référence

| Fichier | Contenu |
|---|---|
| `AGENTS.md` | Conventions, commandes, standards — **fichier de vérité** |
| `CLAUDE.md` | Spécifique Claude Code : hooks, permissions, boucle de travail |
| `CONTEXT.md` | Glossaire du vocabulaire métier |
| `docs/adr/` | Décisions d'architecture |
| `docs/specs/` | Design docs, avant les features non-triviales |
