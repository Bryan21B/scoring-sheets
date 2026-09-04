# CLAUDE.md

Conventions, commandes et standards de code : voir `AGENTS.md`. Rien de ce
contenu n'est dupliqué ici. Ce fichier ne porte que le spécifique Claude Code.

## Ce qui est automatisé, ne pas le refaire à la main

- **Formatage** — `.claude/hooks/format-after-edit.sh` passe Biome sur chaque
  fichier écrit, immédiatement. Ne pas lancer `bun run format` après une édition.
- **Garde-fous shell** — `.claude/hooks/block-dangerous-bash.sh` refuse `rm -rf`
  trop large, force-push sans lease, `git clean -fd`, lecture/écriture d'un `.env`.
  Un refus est une décision, pas un obstacle à contourner.
- **Permissions** — `.claude/settings.json` : lecture, lint, tests et build passent
  sans demander ; commit, push, tag, migration, ajout de dépendance et conteneurs
  demandent confirmation ; `.env`, `drizzle/` et `bun.lock` sont interdits à
  l'édition, et la création ou le merge d'une PR est refusé — le flux n'en a pas.

## Boucle de travail

Research → Design → Plan → TDD → Review → Ship.

- Explorer le code existant avant de proposer.
- Feature non-triviale : design doc dans `docs/specs/YYYY-MM-DD-sujet.md`, avec
  2-3 approches comparées, avant d'écrire du code. Pour de l'archi ou du flow,
  produire un diagramme plutôt que de la prose — ça fait sortir les suppositions.
- Découper en tâches de 2-5 min, chacune avec chemin de fichier exact et critère
  de vérification.
- Implémenter en RED → GREEN → REFACTOR.
- Décision d'archi prise : ADR dans `docs/adr/`.

## Worktree quand deux chantiers se croisent

Le défaut est simple : un seul dossier, sur `main`, on commit et on pousse. Pas
de branche par feature, pas de PR.

Le worktree reste l'outil quand deux chantiers tournent vraiment en parallèle —
typiquement deux agents. Git refusant de checkouter `main` dans deux worktrees,
la branche du worktree est un **brouillon local** : elle ne part jamais sur le
remote, elle n'ouvre pas de PR. Quand le chantier est vert, retour sur `main`,
`git rebase` ou `git merge --ff-only`, puis push. La branche a servi à isoler un
espace de travail, pas à créer une unité de review.

## Debug

Reproduire → minimiser → hypothèse → instrumenter → fix → test de non-régression.
Ne pas déclarer « corrigé » sans avoir montré la cause racine.

## Agent skills

Les skills engineering de [`mattpocock/skills`](https://github.com/mattpocock/skills)
sont vendorés dans `.claude/skills/` — 18 skills (`/tdd`, `/code-review`, `/implement`,
`/to-spec`, `/to-tickets`, `/triage`, `/diagnosing-bugs`, `/domain-modeling`…), copiés
depuis l'amont et éditables ici. Provenance et procédure de mise à jour :
`.claude/skills/README.md`.

### Issue tracker

Issues live as GitHub issues on `Bryan21B/scoring-sheets`, driven via the `gh` CLI;
PRs are not a request surface. See `docs/agents/issue-tracker.md`.

### Triage labels

The five canonical roles, each label named after itself: `needs-triage`, `needs-info`,
`ready-for-agent`, `ready-for-human`, `wontfix`. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: `CONTEXT.md` and `docs/adr/` at the repo root, design docs in
`docs/specs/`. See `docs/agents/domain.md`.
