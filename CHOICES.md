# Tech Stack — Template perso

Stack par défaut pour projets solo, optimisé pour dev assisté par Claude Code.

## Stack de base

| Couche | Choix |
|---|---|
| Framework | Next.js (App Router) + TypeScript strict |
| DB | SQLite |
| ORM | Drizzle |
| Validation runtime | Zod |
| Déploiement | Pas de défaut fixe — Vercel si perso/proto rapide, VPS (tonka-bean) si besoin de contrôle ou déjà connecté à ton infra |
| Lint/format | Biome |
| Tests | Vitest |
| Runtime / package manager | Bun (pnpm en fallback) |
| Conteneurisation (dev local) | Docker / docker-compose |
| Conteneurisation (déploiement VPS) | Podman + Quadlet |
| UI | Tailwind + shadcn/ui |
| Monorepo (si le projet éclate en plusieurs packages) | Turborepo — config minimale, marche avec pnpm/Bun workspaces, cache distant gratuit sur Vercel. Bascule vers Nx seulement au-delà de ~50 packages ou si besoin de règles de boundaries entre modules. |

## CI/CD & déploiement

1. **Pipeline unique sur GitHub Actions** — un seul `ci.yml` : lint (Biome) + typecheck + `bun test` + e2e Playwright + build d'image en parallèle, puis les jobs de release et de déploiement en aval avec un `needs` sur les trois. Pas de PR : on pousse sur `main`, et c'est le `needs` qui garantit que rien ne se release depuis un commit rouge.
2. **Semver dérivé des conventional commits** — semantic-release, lancé depuis le pipeline, pas installé en devDependency (l'action l'installe côté runner, `bun.lock` reste intact). Il tague, écrit le CHANGELOG, bump `package.json` et crée la release GitHub. release-please et Changesets sont écartés : les deux passent par une PR de release, or il n'y a plus de PR. Corollaire : le préfixe de commit devient load-bearing, plus rien ne le relit avant qu'il fasse une version.
3. **Déploiement via GitHub Actions** — pas de déploiement manuel depuis le poste local. Le workflow build + push l'image + déploie (Vercel via leur action, ou SSH/Podman sur le VPS selon la cible).
4. **Si servi sur le VPS : Caddy en reverse proxy public par défaut**
   - Caddy expose directement les domaines publics (TLS auto), les conteneurs ne publient leurs ports que sur `127.0.0.1`.
   - Tailscale (ou tunnel SSH) réservé aux surfaces sensibles — dashboards d'admin, interfaces qui exposent des données internes — pas un défaut universel pour tout ce qui tourne sur le VPS.

## Scaffolding d'un nouveau projet

- **GitHub template repository** (natif) comme mécanisme de base — bouton "Use this template", historique Git propre, zéro outil supplémentaire à maintenir.
- **Le LLM fait la substitution** — pas de cookiecutter/copier par défaut. Demander à l'agent de renommer le projet, virer les sections qui ne s'appliquent pas (Turborepo si pas de monorepo, `docs/deployment.md` si pas self-hosted) au moment du scaffold. Ça remplace la logique conditionnelle d'un moteur de template par du langage naturel.
- **Cookiecutter / Copier seulement si scaffolding fréquent** — utile si tu génères plusieurs projets par mois avec de vraies variations pénibles à redemander à chaque fois en prompt. Copier a l'avantage sur cookiecutter de pouvoir pousser des mises à jour du template vers un repo déjà généré. Les deux ajoutent une dépendance Python dans un stack TS/Bun — à peser.

## Prérequis repo pour déploiement VPS

Ce qui doit exister dès la création du repo si le projet est destiné à tourner sur le VPS un jour — le reste (Ansible, Restic, Quadlet de prod, Caddyfile) vit dans le repo infra séparé, pas ici.

- **Dockerfile/Containerfile** présent dès le départ, même si le déploiement réel arrive plus tard.
- **`.env.example`** avec toutes les variables nécessaires listées (pas de valeurs réelles) — ou `.env.tpl` avec des références `op://` si 1Password est déjà en place pour ce projet.
- **Aucun secret réel commité**, jamais.
- **Images taguées en semver** dans le pipeline de release (`v0.1.0`), jamais `:latest` comme référence de prod.
- **Le repo documente** : le port interne exposé, les variables d'environnement requises, le chemin de données persistantes attendu (le service doit pouvoir recevoir un chemin externe, pas un chemin hardcodé), la commande ou l'endpoint de health check, la procédure de migration si le projet a une DB.
- **Endpoint `/health`** si le service est un serveur HTTP.
- **Logs qui ne remplissent pas le disque indéfiniment** — rotation ou niveau configurable dès le départ, pas à ajouter après coup.
- **Le Quadlet de prod ne vit pas dans ce repo** — il vit dans le repo infra. Le repo applicatif documente juste ce dont le Quadlet aura besoin (port, volume, env vars).

## Workflow / gestion de projet

- **GitHub Issues** pour tracker le travail — une issue par feature/bug, référencée dans le message de commit (`fixes #12`), seul endroit où le lien peut vivre maintenant qu'il n'y a plus de PR. semantic-release commente l'issue quand la version qui la ferme sort. Ça donne aussi à l'agent un historique de contexte lisible via le GitHub MCP au lieu de devoir tout redériver du code.

## Pratiques agentic dev (Claude Code)

- **Hooks plutôt que prose pour les règles strictes** — `.claude/hooks/` exécute du code à des moments précis du cycle de vie de l'agent (avant/après un tool call). Formatage/lint automatique juste après un edit, blocage de commandes destructives (`rm -rf`, force-push), restriction d'édition hors d'un dossier. Plus fiable qu'une instruction CLAUDE.md que l'agent peut ignorer.
- **Husky ≠ hooks Claude Code, les deux se complètent** — Husky se déclenche sur les événements Git (pre-commit, pre-push), peu importe qui commit : toi, un collègue, ou l'agent. Les hooks Claude Code se déclenchent sur le cycle de vie de l'agent lui-même, avant même qu'une action arrive jusqu'à Git. Husky = filet de sécurité universel à la porte d'entrée Git ; hooks Claude Code = garde-fou en amont, en temps réel, spécifique à l'agent. Utiliser les deux : Husky + lint-staged pour le pre-commit classique, hooks Claude Code pour bloquer le dangereux et formatter à la volée pendant que l'agent bosse.
- **Secret-scanning au pre-push, pas juste au pre-commit** — un hook Husky supplémentaire qui bloque clés AWS, tokens, blocs PEM, JWT avant qu'ils quittent la machine. Complète le pre-commit, ne le remplace pas.
- **Permissions à 3 niveaux via `settings.json`** — définir ce que l'agent fait sans demander (lecture, tests), ce qui nécessite confirmation (push, migration DB), et ce qui est interdit (toucher `.env`, modifier la prod directement).
- **Worktree Git pour le travail parallèle, pas par feature** — le défaut est de bosser sur `main` dans un seul dossier. Le worktree sert quand deux chantiers tournent en même temps (deux agents) : sa branche est un brouillon local qui ne part jamais sur le remote, on rebase sur `main` et on pousse à la fin. Isoler un espace de travail, pas créer une unité de review.
- **Design doc avant code non-trivial** — pour une feature qui dépasse le trivial : proposer 2-3 approches, présenter le design par sections, sauvegarder en `docs/specs/YYYY-MM-DD-sujet.md`, se relire (placeholders, contradictions, ambiguïté), review avant de passer à l'implémentation. Pour du visuel (archi, flow), demander explicitement un diagramme plutôt que de la prose — ça force les suppositions cachées à sortir au clair.
- **Boucle Research → Design → Plan → TDD → Review → Ship** — explore le code existant, écrit un design doc si la feature est grosse, découpe en tâches de 2-5 min avec chemins de fichiers exacts et critère de vérification, implémente en RED → GREEN → REFACTOR (test qui échoue → code minimal qui le fait passer → refactor → commit), se vérifie (tests, diff contre main), puis ship.
- **`CONTEXT.md`** — glossaire vivant du vocabulaire métier du projet, mis à jour au fil de l'eau. Évite que l'agent réinvente ou mésutilise le jargon du domaine à chaque nouvelle session.
- **Boucle de debug disciplinée** — reproduire → minimiser → hypothèse → instrumenter → fix → test de non-régression. Pousse à vérifier la cause racine plutôt que déclarer "fixé" trop tôt.

## AGENTS.md — fichier de référence cross-tool

C'est le standard à privilégier comme fichier de conventions principal, pas un simple bonus. Ouvert, maintenu par l'Agentic AI Foundation (Linux Foundation), markdown pur sans champ obligatoire. Supporté par 30+ agents (Codex, Claude Code via import, Cursor, Copilot, Gemini CLI, Aider, Zed, Devin...) et utilisé par 60k+ repos publics. Contrairement au README qui s'adresse aux humains, AGENTS.md porte le détail que l'agent a besoin de savoir et qui alourdirait un README (commandes de build exactes, conventions de test, gotchas).

**Sections qui reviennent le plus souvent** (aucune n'est obligatoire, mais ce sont les choix qui marchent en pratique, vus chez Cloudflare workers-sdk entre autres) :

```
## Project overview
Une ou deux phrases sur ce que fait le projet et ses composants principaux.

## Setup / Dev environment
- Install: `bun install`
- Dev server: `bun dev`

## Build & test commands
- Build: `bun run build`
- Tests: `bun test`
- Un seul test: `bun test -t "<pattern>"`
- Check complet (lint + type + format) : `bun run check`

## Code style
Renvoyer vers la section "Standards de code" de ce doc, ou lister les règles directement.

## Testing instructions
Où sont les tests, comment les lancer, ce qui doit être vert avant de pousser.

## Commit & push
Format du message de commit, ce qui doit être vert avant de pousser.

## Security considerations
Ce qui touche aux secrets, à l'auth, aux appels shell (voir CWE-78 plus haut).
```

**Résolution de conflit** — si plusieurs `AGENTS.md` existent (monorepo), le plus proche du fichier édité gagne. Une instruction donnée directement dans le chat prend toujours le pas sur ce qui est écrit dans le fichier.

**Monorepo** — un `AGENTS.md` par package, l'agent remonte l'arborescence depuis le fichier édité jusqu'à en trouver un.

**Un seul fichier de vérité** — les conventions, commandes et standards de code vivent dans `AGENTS.md`. `CLAUDE.md` ne duplique pas ce contenu : il reste réservé à ce qui est spécifique à Claude Code (hooks, permissions, hiérarchie global/projet/local). Si tu veux que Claude Code lise `AGENTS.md`, une ligne dans `CLAUDE.md` du genre *"Voir AGENTS.md pour les conventions du projet"* suffit — pas besoin de tout recopier.

## Fichiers spécifiques à Claude Code


**Budget d'attention** — le fichier projet doit rester sous 80 lignes (HumanLayer vise 60). Au-delà, Claude commence à ignorer des bouts. Chaque ligne est en compétition pour l'attention du modèle.

**Module-specific CLAUDE.md** — pour les gros repos/monorepos, un `CLAUDE.md` par sous-dossier (`src/auth/CLAUDE.md`), chargé à la demande seulement quand l'agent travaille dedans. À utiliser quand le fichier racine dépasse 80 lignes ou que les conventions varient par module.


**Erreurs à éviter** :
- Instructions de personnalité ("be a senior engineer", "think step by step") — gaspillage de tokens, le system prompt de Claude Code gère déjà ça
- `@-mention` de docs — injecte le fichier entier en contexte à chaque session ; préférer orienter l'agent ("pour Stripe, voir docs/stripe-guide.md") plutôt que le forcer à tout charger
- Règles de formatage écrites en prose s'il existe déjà un linter/formatter — utiliser un hook, pas des lignes de AGENTS.md
- Dupliquer une règle entre `CLAUDE.md` et `AGENTS.md`, ou entre le fichier global et le fichier projet

**Mémoire auto** — Claude Code garde ses propres notes dans `~/.claude/projects/<project>/memory/` (commandes de build découvertes, patterns appris des corrections). Pas la peine de dupliquer ça dans CLAUDE.md, `/memory` affiche ce qui est chargé.

## Standards de code
- DEMANDE MOI QUEL STYLEGUIDE SUIVRE

Anti-patterns explicitement interdits :

- **`any`** → typer correctement, toujours
- **Assertion non-null (`!`)** → préférer le narrowing de type
- **Promise flottante** → `await` ou `void` explicite, jamais laissée en l'air
- **Bloc de contrôle sans accolades** → toujours des accolades, même pour un `if` d'une ligne
- **Commentaire qui reformule le code** → un commentaire explique le "pourquoi", pas le "quoi" (le code dit déjà le "quoi")
- **Types/constantes dupliqués entre modules** → exporter depuis le module propriétaire, importer ailleurs
- **`console.*` en code qui tourne en prod** → passer par un logger configuré
- **Template literal / concaténation de string dans un `exec`/`spawn`/`execFile`** → injection de commande (CWE-78) ; construire les arguments séparément, jamais interpoler une string dans la commande

**Git** — on commit et on pousse sur `main`, en solo comme le reste du temps. Pas de PR : la CI est la seule barrière, et elle tourne après coup. Donc `bun run check` vert avant chaque push (hook pre-push), et un préfixe de commit juste — c'est lui qui fait la version.

## Règles de dev assisté

1. **Type safety non-négociable** — `strict: true` dans tsconfig, toujours.
2. **Test avant ou avec le code généré** — pas de fonction sans test à côté, même minimal.
3. **Pre-commit hook** (Biome + tsc) — le style et les erreurs de type sont bloqués avant même d'arriver en review, pas laissés à la CI.
4. **Commits petits et single-purpose** — format conventional commits. Un prompt = pas forcément un commit ; découper.
5. **`.env.example` toujours synchronisé** — l'agent doit checker ce fichier avant d'inventer un nom de variable d'env.
6. **ADRs dans `/docs/adr/`** pour les décisions d'archi — donne à l'agent une source de vérité stable plutôt que de re-déduire depuis du code qui a bougé.

## MCP à connecter (Claude Code)

- Filesystem + Git (natifs)
- GitHub MCP — utile si l'agent doit lire le contexte de PR/issues passées
- Postgres/DB MCP — seulement si tu passes de SQLite à quelque chose de plus lourd sur un projet donné

## Structure de repo type

```
/
├── AGENTS.md          # conventions, commandes, standards — fichier de vérité
├── CLAUDE.md           # spécifique Claude Code, pointe vers AGENTS.md
├── CONTEXT.md          # glossaire vivant du vocabulaire métier
├── .env.example
├── docs/
│   ├── adr/
│   ├── specs/          # design docs avant les features non-triviales
│   └── deployment.md   # si self-hosted VPS : port, env vars, data path, health check
├── src/
│   ├── app/           # Next.js App Router
│   ├── db/            # schema Drizzle + migrations
│   └── lib/
└── tests/
```

---
*Dernière mise à jour : à toi de la garder à jour à chaque changement de stack par défaut.
