# SETUP.md — checklist de scaffolding

**À l'agent qui lit ce fichier :** ce repo vient d'être créé depuis le template
`bryan-cookie-starter`. Déroule cette checklist, **en posant les questions de la
section 1 avant de toucher au code**. Quand tout est fait, supprime ce fichier —
il ne sert qu'une fois.

---
### 1.1 Identité du projet

- Nom du projet (kebab-case, servira de nom de paquet et d'image conteneur)
- Description en une phrase
- Le repo est-il public ou privé ?

### 1.2 Cible de déploiement

> Le template ne tranche pas : il est neutre et n'embarque aucun workflow de
> déploiement. Poser la question, puis appliquer **une seule** des branches
> ci-dessous.

**A — Vercel** (perso, proto rapide, pas de conteneur à gérer)

À faire :
- Supprimer `Containerfile`, `.dockerignore`, `docs/deployment.md`
- Supprimer les scripts `docker:*` de `package.json` (section 8)
- Supprimer les jobs `container` et `publish` de `.github/workflows/ci.yml`, et
  retirer `container` du `needs` du job `release`
- Garder le job `release` : le tag, le CHANGELOG et la release GitHub restent
  utiles même sans image à publier
- Retirer `output: standalone` et sa condition `BUILD_STANDALONE` de `next.config.ts`
- Ajouter ce job **dans `.github/workflows/ci.yml`**, pas dans un workflow séparé :
  il doit dépendre des checks, sinon il tourne en parallèle d'eux et peut mettre
  en ligne un commit rouge.

```yaml
  # Déploie chaque push vert sur `main`, indépendamment du job `release` : une
  # correction en `chore:` ne produit pas de version mais doit partir en prod.
  deploy:
    name: Deploy
    needs: [check, e2e]
    if: github.ref == 'refs/heads/main'
    runs-on: ubuntu-latest
    environment: production
    permissions:
      contents: read
      deployments: write
    steps:
      - uses: actions/checkout@v5
      - uses: oven-sh/setup-bun@v2
        with:
          bun-version-file: package.json
      - run: bun install --frozen-lockfile
      - uses: amondnet/vercel-action@v25
        with:
          vercel-token: ${{ secrets.VERCEL_TOKEN }}
          vercel-org-id: ${{ secrets.VERCEL_ORG_ID }}
          vercel-project-id: ${{ secrets.VERCEL_PROJECT_ID }}
          vercel-args: '--prod'
```

- Le commit `chore(release)` poussé par semantic-release ne redéclenche rien
  (voir section 6) : il ne contient que `CHANGELOG.md` et `package.json`, donc la
  prod ne rate rien. Le déploiement porte le commit que tu as poussé.
- Prévenir que **le fichier SQLite ne survit pas sur Vercel** : le système de
  fichiers est éphémère. Bonne nouvelle, le driver est déjà libSQL : il suffit de
  créer une base Turso et de pointer `DATABASE_PATH` sur son URL `libsql://`,
  sans toucher à `src/db/index.ts`. Ajouter le token Turso au schéma d'env
  (`TURSO_AUTH_TOKEN`) et le passer à `createClient` si la base est protégée.
- Secrets à créer côté repo : `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID`

**B — VPS (Podman + Quadlet, Caddy en reverse proxy)**

À faire :

- Garder `Containerfile`, `.dockerignore`, `docs/deployment.md`, les jobs
  `container` et `publish`
- Ne **pas** créer de workflow de déploiement SSH. Ce dépôt ne se connecte à
  aucune machine : il publie une image, et c'est un commit chez le repo infra qui
  décide de ce qui tourne. Donc aucune clé SSH de prod en secret GitHub, et une
  clé de moins à tourner. Le raisonnement complet est dans `docs/deployment.md`.
- Poser `id: build` sur le `docker/build-push-action` du job `publish` — celui qui
  porte `push: true`, **pas** celui du job `container` qui construit à blanc et
  dont aucun digest ne sort — puis exposer le digest du job :

```yaml
  publish:
    outputs:
      digest: ${{ steps.build.outputs.digest }}
    steps:
      - id: build
        uses: docker/build-push-action@v6
        with:
          push: true
          # …le reste inchangé
```

- Ajouter le job `bump` en bout de chaîne dans `.github/workflows/ci.yml`. C'est
  lui qui ouvre, chez le repo infra, la PR qui déplace le digest épinglé :

```yaml
  bump:
    name: Bump the pinned digest on <REPO-INFRA>
    needs: [release, publish]
    if: needs.release.outputs.released == 'true' && inputs.dry_run != true
    runs-on: ubuntu-latest
    steps:
      - name: Checkout <REPO-INFRA>
        uses: actions/checkout@v5
        with:
          repository: <OWNER>/<REPO-INFRA>
          token: ${{ secrets.VPS_SETUP_TOKEN }}
          path: infra

      # Un digest vide produirait un sed qui ne remplace rien, puis une PR vide.
      - name: The digest actually came out of the build
        env:
          DIGEST: ${{ needs.publish.outputs.digest }}
        run: |
          case "$DIGEST" in
            sha256:*) echo "digest: $DIGEST" ;;
            *) echo "::error::pas de digest en sortie de build (\"$DIGEST\")"; exit 1 ;;
          esac

      # `github.repository` porte la casse du dépôt et GHCR normalise en
      # minuscules : un sed sensible à la casse ne remplacerait rien, et le job
      # ouvrirait une PR vide. Le sed est global sur host_vars/ — un service en
      # plusieurs conteneurs y figure plusieurs fois pour UNE image.
      - name: Rewrite the pinned digest
        id: rewrite
        env:
          DIGEST: ${{ needs.publish.outputs.digest }}
        run: |
          set -euo pipefail
          image=$(printf '%s' "ghcr.io/${{ github.repository }}" | tr '[:upper:]' '[:lower:]')
          sha=${DIGEST#sha256:}

          cd infra
          before=$(grep -rc "image: ${image}@sha256:" ansible/host_vars/ | awk -F: '{s+=$2} END {print s+0}')
          if [ "$before" -eq 0 ]; then
            echo "::error::aucune ligne \"image: ${image}@sha256:\" dans ansible/host_vars/"
            exit 1
          fi

          grep -rlE "image: ${image}@sha256:[0-9a-f]{64}" ansible/host_vars/ |
            xargs sed -i -E "s|(image: ${image}@sha256:)[0-9a-f]{64}|\1${sha}|g"

          if git diff --quiet; then
            echo "changed=false" >> "$GITHUB_OUTPUT"
            echo "Le digest épinglé est déjà celui-ci. Rien à ouvrir."
            exit 0
          fi

          # Le patch ne doit toucher QUE des lignes `image:`. La garde du repo
          # infra refuse le reste, donc une PR qui déborde ne fusionnera pas :
          # autant s'arrêter ici, avec la raison sous les yeux.
          other=$(git diff -U0 | grep -cE '^[-+][^-+]' || true)
          if [ "$other" -ne $((before * 2)) ]; then
            echo "::error::le patch touche $other lignes, attendu $((before * 2))"
            git diff
            exit 1
          fi

          echo "changed=true" >> "$GITHUB_OUTPUT"

      - name: Open the pull request
        if: steps.rewrite.outputs.changed == 'true'
        env:
          GH_TOKEN: ${{ secrets.VPS_SETUP_TOKEN }}
          VERSION: ${{ needs.release.outputs.version }}
          DIGEST: ${{ needs.publish.outputs.digest }}
        run: |
          set -euo pipefail
          cd infra
          branch="digest-bump/<NOM>-${VERSION}"
          git config user.name "<NOM> CI"
          git config user.email "noreply@github.com"
          git checkout -b "$branch"
          git commit -am "Pin <NOM> ${VERSION}"
          git push --force-with-lease origin "$branch"

          gh pr create \
            --repo <OWNER>/<REPO-INFRA> \
            --base main \
            --head "$branch" \
            --title "Pin <NOM> ${VERSION}" \
            --body "<NOM> ${VERSION} est publiée. Cette PR déplace le digest épinglé vers ${DIGEST}."
```

- On déploie donc **un digest, jamais un tag ni un commit** : un tag est un
  pointeur qui bouge, un digest est l'image. Un push en `chore:` ou `docs:` ne
  produit aucune version et n'ouvre aucune PR — c'est voulu. Conséquence à
  connaître : une PR purement CI ne peut pas s'auto-tester, seuls `feat`, `fix`,
  `perf`, `revert` et une rupture exercent la chaîne.
- La PR ouverte là-bas **ne déploie encore rien**. Un humain la relit et la
  fusionne, puis le converge Ansible tire le nouveau digest.
- Secret à créer : `VPS_SETUP_TOKEN` — un jeton d'accès personnel *fine-grained*,
  portée `contents: write` et `pull requests: write`, sur le repo infra
  **uniquement**. `GITHUB_TOKEN` ne convient pas, et la seconde raison est un
  piège silencieux : il est limité à ce dépôt, **et** une PR ouverte avec lui ne
  déclenche pas les workflows du dépôt cible — les gardes du repo infra ne
  tourneraient donc jamais.
- Rappeler que le **Quadlet de prod et le Caddyfile vivent dans le repo infra**,
  pas ici. Ce repo ne fait que documenter ce dont ils ont besoin
  (`docs/deployment.md`).
- Le conteneur ne publie son port que sur `127.0.0.1` ; Caddy expose le domaine
  public et gère le TLS. Tailscale n'est à réserver qu'aux surfaces sensibles
  (dashboards d'admin), ce n'est pas le défaut.

**C — Rien pour l'instant** : ne créer aucun `deploy.yml`. Garder le
`Containerfile` (il coûte peu et évite d'avoir à tout remonter plus tard), et
noter dans le README que la cible reste à décider.

### 1.3 Base de données

- SQLite convient-elle ? (défaut du template, parfait en solo et sur VPS)
- Si non → adapter `src/db/index.ts`, `drizzle.config.ts` et les dépendances.
  Postgres : `bun add postgres` + `drizzle-orm/postgres-js`. Turso :
  `bun add @libsql/client` + `drizzle-orm/libsql`.

### 1.4 Secrets

- Quel vault 1Password ? (défaut : `Infra`, un item par environnement —
  `<NOM> dev`, `<NOM> prod`)
- Le **build** a-t-il besoin d'un secret applicatif, ou seulement le runtime ?
  C'est ce qui décide de créer un service account 1Password pour le CI, ou pas.

Les mécaniques sont en section 5 — poser la question ici, appliquer là-bas.

### 1.5 Monorepo

Turborepo n'est **pas** dans le template. Ne l'ajouter que si le projet éclate
réellement en plusieurs packages — pas « au cas où ». Si oui : workspaces Bun +
`turbo.json` minimal, un `AGENTS.md` par package. Nx seulement au-delà de ~50
packages ou si des règles de boundaries entre modules sont nécessaires.

---

## 2. Substitutions à faire partout

Remplacer `bryan-cookie-starter` par le nom du projet dans :

- `package.json` → `name`
- `package.json` → `version`, remis à `0.0.0` (voir le tag graine en section 8)
- `src/app/layout.tsx` → `metadata.title` et `metadata.description`
- `src/app/page.tsx` → remplacer entièrement la page d'accueil du template
- `README.md` → titre, description, section déploiement
- `AGENTS.md` → section « Project overview »
- `docs/deployment.md` → nom du service, du volume, du domaine

## 3. Nettoyage

- Supprimer la table d'exemple `notes` de `src/db/schema.ts`, régénérer les
  migrations (`rm -rf drizzle && bun run db:generate`) et adapter
  `tests/unit/db.test.ts` au vrai schéma.
- Supprimer `src/components/ui/button.tsx` s'il n'est pas utilisé, ou ajouter les
  composants nécessaires avec `bunx shadcn@latest add <composant>`.
- Supprimer ce fichier (`SETUP.md`).

## 4. Générer le `AGENTS.md` du projet

`AGENTS.md` est le fichier de vérité lu par tous les agents (Claude Code lit
`CLAUDE.md`, qui n'y renvoie que le spécifique Claude). Il vient du template : il
n'est **pas** à régénérer de zéro, sinon les conventions durement acquises
disparaissent. Trois sections sont propres au projet, les autres sont le produit
du template.

À réécrire :

- **Project overview** — ce que fait l'app, en 3-5 lignes. Pas la stack (elle est
  déjà décrite plus bas), le *domaine*.
- **Architecture** — les modules réels et qui appelle qui. Refléter l'arborescence
  après le nettoyage de la section 3, pas celle du template.
- **Gotchas** — vide au départ. Se remplit au fil des surprises rencontrées :
  chaque bug dont la cause racine était non évidente y gagne une ligne.

À ajuster seulement si la section 1 l'impose :

- **Setup / Dev environment** — ajouter la ligne 1Password si des secrets réels
  sont nécessaires en local (voir section 5).
- **Build & test commands** — retirer les commandes dont l'outil a été supprimé
  (ex. rien à retirer côté Vercel, mais `docs/deployment.md` disparaît des
  références).
- **Security considerations** — pointer sur le vault 1Password du projet.

Règles de rédaction, elles valent plus que le contenu lui-même :

- **Toute commande citée doit exister dans `package.json`.** Un `AGENTS.md` qui
  ment coûte plus cher que pas d'`AGENTS.md` du tout.
- **Impératif, pas descriptif.** « Lancer `bun run check` avant de commit », pas
  « le projet dispose d'un script de vérification ».
- **Pas de duplication avec le code.** Si l'info est dans `package.json`, un
  schéma Zod ou un type, la citer par chemin plutôt que la recopier.
- **Un `AGENTS.md` par package** en monorepo (cf. 1.5) : le plus proche du fichier
  édité gagne, donc le fichier racine ne garde que ce qui est transverse.

Vérification : relire `AGENTS.md` en se demandant, pour chaque ligne, « un agent
qui ne lit que ça peut-il agir sans se tromper ? ». Puis lancer chaque commande
citée.

## 5. Secrets — 1Password

Trois règles héritées du guide self-hosted, elles priment sur toute commodité :

1. **1Password est la source de vérité.** Aucune valeur réelle dans Git, aucun
   `.env` réel versionné ; seuls les templates à références `op://` se commitent.
2. **1Password est une dépendance de déploiement, jamais de redémarrage.** Aucun
   unit systemd, aucun Quadlet, aucun `ENTRYPOINT` n'appelle `op`. Un reboot du
   VPS ne doit dépendre que de fichiers déjà sur le disque.
3. **Un secret qui a transité par un canal non chiffré est compromis** — chat,
   ticket, presse-papiers partagé. Le tourner, pas le « garder pour l'instant ».

### Ce que ce repo porte, et ce qu'il ne porte pas

| Fichier | Où | Contenu |
| --- | --- | --- |
| `.env.example` | ici, commité | miroir documenté de `src/lib/env.ts`, sans valeur |
| `.env.tpl` | ici, commité | mêmes clés, valeurs = références `op://Infra/<NOM> dev/<VAR>` |
| `.env.local` | ici, ignoré | artefact rendu par `op inject`, jamais édité à la main |
| `<NOM>.env.tpl` prod | **repo infra** | `infra/templates/`, rendu par `render-secrets.sh` |
| `/etc/<NOM>/<NOM>.env` | **VPS**, `root:root` `600` | fichier rendu que lit le Quadlet |

Créer le vault et les items — un item par environnement, un champ par variable :

```bash
op item create --category="Secure Note" --vault=Infra --title="<NOM> dev"
op item create --category="Secure Note" --vault=Infra --title="<NOM> prod"
```

Puis créer `.env.tpl` à la racine :

```bash
NODE_ENV=development
DATABASE_PATH=op://Infra/<NOM> dev/DATABASE_PATH
LOG_LEVEL=debug
PORT=3000
```

`.gitignore` prévoit déjà l'exception (`.env*` sauf `.env.example` et
`.env.tpl`) — vérifier avec `git check-ignore -v .env.tpl` si un doute subsiste.

### Dev local

Une seule commande, une seule fois — ensuite `bun dev`, `bun run test` et
`bun run db:migrate` marchent sans préfixe, puisqu'ils lisent `.env.local`
eux-mêmes :

```bash
op signin                            # une fois par session de travail
op inject -i .env.tpl -o .env.local  # après un clone, ou après une rotation
```

Pas de `op run` dans la boucle locale : ça oblige à préfixer chaque commande et
les sous-processus (Playwright, Drizzle Kit) n'héritent pas toujours de l'env.
Le fichier reste sur le disque entre les sessions, c'est assumé — il est ignoré
par Git, et le hook `block-dangerous-bash.sh` en interdit la lecture aux agents.
Après une rotation dans 1Password, relancer `op inject` : c'est le seul geste.

Ces valeurs sont celles de la **boucle hôte** (`bun dev`). Elles ne sont pas
faites pour être injectées dans un conteneur — voir section 8.

### Prod — branche B (VPS)

Le rendu se fait **sur le VPS, au déploiement**, depuis le repo infra — pas par
GitHub Actions :

```bash
op inject --in-file templates/<NOM>.env.tpl --out-file /etc/<NOM>/<NOM>.env
chown root:root /etc/<NOM>/<NOM>.env
chmod 600 /etc/<NOM>/<NOM>.env
```

Le Quadlet le consomme sans jamais connaître 1Password :

```ini
EnvironmentFile=/etc/<NOM>/<NOM>.env
Volume=/srv/data/<NOM>:/data:Z
```

Conséquence pour ce repo : **la CI n'a aucun secret applicatif à connaître**,
et aucun secret de machine non plus. Elle publie une image, puis ouvre une PR
chez le repo infra ; elle ne se connecte à rien. Son seul secret d'infra est
`VPS_SETUP_TOKEN`, qui n'ouvre que ce repo infra. La migration est lancée par le
converge, et réutilise le fichier déjà rendu sur le disque.
Le `.env` rendu est sauvegardé par restic côté infra, pas ici.

### Prod — branche A (Vercel)

Vercel n'offre pas de fichier root-only : les valeurs vivent dans les variables
d'environnement du projet. 1Password reste la source, on pousse depuis elle
plutôt que de taper la valeur :

```bash
op read "op://Infra/<NOM> prod/TURSO_AUTH_TOKEN" \
  | vercel env add TURSO_AUTH_TOKEN production
```

Si — et seulement si — le **build** a besoin d'un secret applicatif, créer un
service account 1Password en lecture seule limité au vault, et n'exposer que son
jeton en secret GitHub :

```yaml
- uses: 1password/load-secrets-action@v2
  with:
    export-env: true
  env:
    OP_SERVICE_ACCOUNT_TOKEN: ${{ secrets.OP_SERVICE_ACCOUNT_TOKEN }}
    TURSO_AUTH_TOKEN: op://Infra/<NOM> prod/TURSO_AUTH_TOKEN
```

Sinon, ne pas créer ce service account : moins de jetons à tourner.

### Rotation

Changer la valeur dans 1Password, puis re-rendre (VPS) ou re-pousser (Vercel), et
redémarrer. Aucun fichier à éditer, aucun secret à re-coller. Les secrets de
déploiement eux-mêmes (`VERCEL_*`, `VPS_*`) restent des secrets GitHub natifs —
les copier dans 1Password comme filet de restauration, pas comme source.

## 6. Configuration du repo GitHub

- **Pas de checks requis, pas de PR obligatoire.** Un check requis sur une branche
  protégée rejette aussi les pushes directs — GitHub attend un statut qui n'existe
  pas encore sur le commit qu'on pousse. Les deux réglages sont incompatibles avec
  le flux de ce template.
- Ce qui reste utile, en ruleset sur `main` (Settings → Rules → Rulesets) :
  **bloquer les force pushes** et **interdire la suppression de la branche**. Rien
  d'autre. La qualité est tenue par le hook pre-push en local et par le `needs` du
  job `release` en CI, pas par une règle GitHub.
- Ne pas activer « Require signed commits » : semantic-release pousse le commit
  `chore(release)` non signé, il serait rejeté.
- Ne pas créer de ruleset sur les tags `v*` qui restreigne leur création : il
  bloquerait le tag de release. Si tu en veux un malgré tout, ajouter le workflow
  en bypass.
- Créer les secrets listés dans la branche de déploiement retenue, plus
  `OP_SERVICE_ACCOUNT_TOKEN` si le CI a besoin de secrets applicatifs (section 5).
- Branche B : créer l'environnement `production` (Settings → Environments) si tu
  veux une approbation manuelle avant chaque déploiement.

## 7. Config de l'env dev

- Inviter l'utilisateur a utilise un plugin de dev soit <https://github.com/mattpocock/skills> ou <https://github.com/obra/superpowers>


## 8. Vérification finale

```bash
bun install
bun run db:generate   # si le schéma a changé
bun run check:all     # lint + types + unit + e2e, tout doit être vert
```

Puis poser le tag graine — **avant le premier commit conventionnel** :

```bash
git tag v0.0.0
git push origin v0.0.0
```

« Use this template » ne copie aucun tag. Sans ce tag, semantic-release considère
la première release comme une `1.0.0` et le projet naît en version stable alors
qu'il n'a rien fait. Avec, un `feat:` sort en `0.1.0` et un `fix:` en `0.0.1` — et
un breaking change reste en mineur tant qu'on est en `0.x`.

Ensuite : premier commit conventionnel **directement sur `main`**, et push. Pas de
branche, pas de PR. Le pipeline lance lint, types, unitaires, e2e et build d'image ;
s'ils passent, il tague, écrit le CHANGELOG et publie. Le préfixe du commit décide
de la version : plus aucune review ne le rattrape.

### Vérifier l'image en local — branches B et C

Le dev quotidien reste `bun dev` sur l'hôte. Docker ne remplace pas cette boucle :
le `Containerfile` produit un build `output: standalone`, qui ne sait pas faire de
hot reload, et conteneuriser le dev déplacerait `bun test`, Biome et les hooks
Husky dans un second environnement à maintenir. Il sert à une seule chose ici —
vérifier que l'image qui partira en prod démarre vraiment, avant de la pousser.

```bash
bun run docker:build     # build de l'image de prod
bun run docker:migrate   # applique les migrations dans le volume
bun run docker:run       # sert sur http://127.0.0.1:3000
```

Trois points qui expliquent pourquoi ces scripts sont écrits ainsi :

- **Ne pas injecter `.env.local` dans le conteneur.** Ce fichier porte les valeurs
  de la boucle hôte (`DATABASE_PATH=./data/app.db`, `NODE_ENV=development`) et
  écraserait les `ENV` de l'image : la base atterrirait dans `/app/data`, hors du
  volume, donc perdue au premier `--rm`, et un build de prod tournerait en mode
  development. Les défauts du `Containerfile` suffisent ; pour surcharger une
  variable ponctuellement, un `-e` ciblé, jamais le fichier entier.
- **Volume nommé plutôt que bind mount sur `./data`.** Docker initialise un volume
  nommé vide avec le contenu *et le propriétaire* du chemin dans l'image — ici
  `1001:1001` — donc l'utilisateur non-root sait y écrire. Un bind mount arrive
  en `root:root` et l'ouverture de la base échoue.
- **Docker honore le `HEALTHCHECK`**, contrairement à Podman en format OCI (cf.
  `docs/deployment.md`). `docker ps` affiche donc `healthy` : c'est le seul
  endroit où cette sonde se teste sans monter un Quadlet.

En branche A (Vercel), ces scripts partent avec le `Containerfile`.



