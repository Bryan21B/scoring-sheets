# Déploiement

Ce que le repo infra a besoin de savoir pour faire tourner ce service. Le Quadlet
de prod, le Caddyfile, Ansible et Restic **ne vivent pas ici** — ce document est
leur contrat d'entrée.

Ce repo infra est [`Bryan21B/vps-setup`](https://github.com/Bryan21B/vps-setup) :
le VPS y est déclaré en Ansible, et un converge rebâtit la machine entière depuis
ce dépôt. Quand ce document dit « côté infra », il faut donc lire « un commit
là-bas ».

## Image

- Registre : `ghcr.io/<owner>/<repo>`
- Taguée en semver par le job `publish` de `.github/workflows/ci.yml` (`0.1.0`,
  `0.1`, `latest`)
- **La prod épingle un digest, pas un tag.** Un tag est un pointeur qui bouge ;
  un digest est l'image. `ghcr.io/<owner>/<repo>@sha256:<64 hexa>` est la seule
  forme qui se rollback et se diagnostique. Les tags semver restent utiles à
  l'humain qui lit une release ; ils ne décident de rien.
- **Ne jamais déployer `:latest`.** Une prod épinglée sur un tag mouvant ne se
  rollback pas et ne se diagnostique pas.
- Si le paquet GHCR est privé, le VPS a besoin d'un `podman login ghcr.io` avec
  un PAT en `read:packages`.
- Build : `podman build -f Containerfile -t <nom>:dev .`

## Runtime

| Élément | Valeur |
|---|---|
| Port interne | `3000` (surchargeable via `PORT`) |
| Utilisateur | non-root, `uid:gid = 1001:1001` |
| Chemin de données | `/data` (volume), fichier SQLite à `/data/app.db` |
| Health check | `GET /health` → `200 {"status":"ok"}`, `503` si la base est injoignable |
| Commande | `node server.js` |

Le conteneur ne publie son port que sur `127.0.0.1`. Caddy expose le domaine
public et gère le TLS. Tailscale est réservé aux surfaces sensibles (dashboards
d'admin, interfaces exposant des données internes) — ce n'est pas le défaut.

⚠️ **Podman ignore la directive `HEALTHCHECK` du Containerfile** quand il
construit au format OCI (son défaut) — il l'annonce par un warning au build. La
sonde doit donc être déclarée côté Quadlet, dans le repo infra :

```ini
[Container]
HealthCmd=/usr/local/bin/node -e "fetch('http://127.0.0.1:3000/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
HealthInterval=30s
HealthTimeout=5s
HealthStartPeriod=10s
HealthRetries=3
```

Le `HEALTHCHECK` reste dans le Containerfile pour Docker, qui l'honore, et pour
`podman build --format docker`.

## Variables d'environnement

Liste faisant foi : `.env.example`. Le service refuse de démarrer si une variable
est absente ou invalide (`src/lib/env.ts`), volontairement — un échec au boot vaut
mieux qu'une panne à la première requête qui touche la variable manquante.

| Variable | Requise | Défaut | Rôle |
|---|---|---|---|
| `NODE_ENV` | non | `development` | `production` en prod |
| `DATABASE_PATH` | oui en prod | `./data/app.db` | Doit pointer dans le volume : `/data/app.db`. Accepte aussi une URL `libsql://` pour basculer sur Turso sans changer de code |
| `LOG_LEVEL` | non | `info` | `debug`/`info`/`warn`/`error`/`silent` |
| `PORT` | non | `3000` | Port HTTP interne |

Aucun chemin de données n'est codé en dur : le service accepte le chemin qu'on lui
donne.

## Persistance

- Un seul volume, monté sur `/data`.
- SQLite est en mode WAL : le volume contient `app.db`, `app.db-wal` et
  `app.db-shm`. **Sauvegarder les trois ensemble**, ou passer par
  `sqlite3 app.db ".backup"` pour un snapshot cohérent — copier `app.db` seul
  pendant une écriture donne une sauvegarde corrompue.
- Le volume doit appartenir à `1001:1001`.

## Migrations

À lancer **avant** de démarrer la nouvelle version, comme étape de déploiement
séparée — jamais au boot de l'application. Une migration qui échoue doit stopper
le rollout, pas laisser un serveur à moitié migré accepter du trafic.

```bash
podman run --rm \
  -v <nom>-data:/data \
  -e DATABASE_PATH=/data/app.db \
  ghcr.io/<owner>/<repo>@sha256:<digest> \
  node scripts/migrate.mjs
```

**Le digest est celui qu'on déploie**, pas un tag. Migrer avec une image et
démarrer avec une autre est une panne difficile à lire : le schéma vient d'un
code, les requêtes d'un autre.

**Cette étape appartient au converge**, pas à ce dépôt. La CI d'ici ne se
connecte à aucune machine ; elle publie une image et s'arrête. C'est donc le repo
infra qui lance cette commande avant de démarrer le service sur la nouvelle
image, en réutilisant le fichier d'env déjà rendu sur le disque.

Si le service tourne en plusieurs conteneurs sur une même base, **une seule
exécution suffit**, et elle doit précéder le démarrage de chacun d'eux.

Les migrations sont idempotentes : relancer sur une base déjà à jour ne fait
rien. Un converge qui la rejoue à chaque passage est donc correct, et c'est la
forme la plus simple à rendre convergente.

## Logs

- Sortie : JSON, une ligne par événement, **tout sur stdout** (y compris les
  erreurs, pour que l'ordre des lignes survive à la collecte).
- L'application n'écrit aucun fichier de log. La rotation est le travail du
  runtime — `podman` avec `--log-opt max-size=10m --log-opt max-file=3`, ou
  journald si le Quadlet route vers lui.
- Volume ajustable à la source via `LOG_LEVEL` sans rebuild.

## Déployer, et revenir en arrière

**Publier une image ne déploie rien.** Le job `publish` pousse sur GHCR, et il
s'arrête là. Ce qui tourne sur la machine est décidé par une ligne `image:` dans
`ansible/host_vars/<hôte>.yml` chez `Bryan21B/vps-setup` — pas par le registre,
pas par un tag. Tant que personne ne déplace cette ligne, l'image publiée
n'existe que sur GHCR.

Déployer, c'est donc **commiter chez vps-setup**. Revenir en arrière aussi : les
deux prennent le même chemin, parce que ce dépôt n'en a aucun autre à offrir.

### La chaîne

1. Un commit `feat:` ou `fix:` arrive sur `main`.
2. `release` coupe la version, écrit le CHANGELOG et tague.
3. `publish` construit l'image, la pousse, et **expose son digest**.
4. `bump` réécrit la ligne `image:` chez vps-setup, puis **ouvre une PR** là-bas.
5. Un humain relit cette PR et la fusionne.
6. Le converge Ansible tire le nouveau digest. La migration passe, puis les
   services redémarrent.

**Rien ne part d'ici vers le VPS.** Aucune clé SSH de production dans un secret
GitHub, aucun runner qui atteint la machine. La boîte tire, elle n'est jamais
poussée. C'est ce qui permet à ce dépôt de ne détenir aucun secret
d'infrastructure, et de rester déployable même si la CI est en panne.

Les étapes 1 à 3 sont livrées par le template. Les étapes 4 à 6 demandent le job
`bump` (recette dans `SETUP.md`, branche B) et un dépôt infra qui déclare déjà ce
service.

### Ce que le repo infra doit déclarer

| Élément | Valeur |
|---|---|
| Fichier épinglant | `ansible/host_vars/<hôte>.yml` |
| Forme de la ligne | `image: ghcr.io/<owner>/<repo>@sha256:<64 hexa>` |
| Fichier d'env de prod | `/etc/<nom>/<nom>.env`, rendu depuis 1Password au déploiement |
| Migration | lancée par le converge, avant le démarrage des services |

**Si le service tourne en plusieurs conteneurs, leurs lignes bougent ensemble.**
Un serveur et un worker qui partagent une image et une base SQLite sont deux
entrées dans `host_vars` pour une seule image. N'en déplacer qu'une les
désynchronise : deux versions du code sur la même base, ce qu'aucun test ne
couvre. Chez vps-setup, `apps_selected_image_peers` existe pour les garder
alignées, et le `sed` du job `bump` est global sur `host_vars/`.

### Le secret `VPS_SETUP_TOKEN`

Le job `bump` écrit dans un **autre dépôt**. Il lui faut donc un jeton d'accès
personnel *fine-grained*, portée `contents: write` et `pull requests: write`, sur
`Bryan21B/vps-setup` **uniquement**.

`GITHUB_TOKEN` ne convient pas, et la seconde raison est un piège silencieux :

1. il est limité à ce dépôt, et ne peut rien écrire ailleurs ;
2. **une PR ouverte avec `GITHUB_TOKEN` ne déclenche pas les workflows du dépôt
   cible.** La PR arriverait sans que les gardes de vps-setup ne tournent — une
   PR de bump qui a l'air validée, et que rien n'a lue.

C'est le **seul** secret d'infrastructure de ce dépôt. Un secret ajouté ici
demande de justifier d'abord quel job le lit.

Range sa valeur dans 1Password, vault `Infra`, un item pour ce credential : le
secret GitHub est un rendu, pas une source. Note aussi sa date d'expiration. À
l'échéance, `bump` échoue au checkout, et rien d'autre ne bouge.

Un GitHub App fait le même travail sans expirer, et son jeton d'installation ne
vit qu'une heure. C'est le choix à faire le jour où ce PAT devient pénible à
tourner.

### Les gardes vivent chez vps-setup

La PR ouverte par `bump` est relue là-bas, pas ici :

- une garde refuse tout patch qui touche autre chose qu'un digest déjà déclaré ;
- une autre vérifie que l'image existe bien dans la plateforme attendue.

Le job `bump` compte donc lui-même ses lignes modifiées, et s'arrête si le compte
ne correspond pas aux occurrences trouvées. Une PR qui déborde ne fusionnera pas
de toute façon : autant échouer ici, avec la raison sous les yeux.

### Ce qui ne déploie pas

Un push en `chore:`, `docs:`, `ci:`, `test:` ou `refactor:` ne produit aucune
version. `release` tourne, ne coupe rien, et `publish` comme `bump` sautent sur
un `released` à `false`. C'est voulu.

La conséquence mérite d'être sue à l'avance : **une PR purement CI ne peut pas
s'auto-tester.** Seuls `feat`, `fix`, `perf`, `revert` et une rupture exercent la
chaîne. Pour vérifier un `bump` fraîchement écrit, il faut un commit qui coupe
une version — au besoin un commit vide portant le type qui manquait.

### Revenir en arrière

L'image précédente reste dans le registre. Revenir en arrière n'est donc **qu'un
digest de moins** : remettre l'ancien `sha256:` dans `host_vars`, commiter,
converger.

**Attention** : une migration de base n'est pas réversible automatiquement. Si la
version fautive a migré le schéma, revenir à l'image d'avant ne revient pas au
schéma d'avant — il faut restaurer la sauvegarde du volume prise avant le
déploiement.
