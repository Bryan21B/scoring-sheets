# 0007 — Les déclencheurs vivent hors du jeu de migrations, dans `src/db/triggers.sql`

- **Statut** : acceptée
- **Date** : 2026-09-09
- **Ticket** : [Schéma Drizzle, migrations et déclencheurs](https://github.com/Bryan21B/scoring-sheets/issues/24)
- **Specs** : `docs/specs/2026-09-09-schema.md`

## Contexte

Le schéma tient deux invariants que **seuls des déclencheurs** peuvent porter :

- **L'append-only du journal** — deux déclencheurs refusent `UPDATE` et `DELETE`.
  Par déclencheur et pas par discipline : la discipline ne tient pas dans un
  dépôt où des agents écrivent.
- **L'estampille de version** — `partie.version` doit bouger à *chaque* écriture
  de `manche`, `saisie`, `participant` ou `journal`. Une incrémentation oubliée
  dans une Server Action est invisible en développement — celui qui écrit voit
  son propre changement — et fatale à table, où les autres téléphones sont
  servis en périmé sans que rien ne proteste.

Or **Drizzle Kit n'a aucune primitive de déclencheur**. Rien de déclaré dans
`src/db/schema.ts` ne peut en produire, et `bun run db:generate` n'en générera
jamais. Deux règles du dépôt se retrouvent alors face à face : les déclencheurs
doivent exister en base, et `drizzle/` ne s'édite jamais à la main —
`.claude/settings.json` refuse d'ailleurs l'outil d'édition sur `./drizzle/**`.

## Options examinées

1. **`drizzle-kit generate --custom`**, qui dépose une migration vide à remplir.
   Elle atterrit dans `drizzle/`, et la remplir est précisément l'édition à la
   main que la règle interdit. La permission la refuse, et c'est voulu.
2. **Le SQL des déclencheurs dans une migration générée**, en le collant après
   coup. Même problème, en pire : le fichier ne serait plus le reflet du
   snapshot, et la prochaine génération travaillerait sur une base fausse.
3. **Un fichier SQL à part, appliqué juste après les migrations.** Retenue.

## Décision

Les déclencheurs vivent dans **`src/db/triggers.sql`**, et `scripts/migrate.mjs`
l'applique **après** avoir joué les migrations de `drizzle/`.

L'invariant est préservé des deux côtés : chaque octet de `drizzle/` sort de
`drizzle-kit`, et le SQL écrit à la main est ailleurs, visible, dans un fichier
dont c'est le seul rôle.

**Chaque déclencheur est supprimé avant d'être créé.** Le fichier est donc
idempotent, mais surtout **déclaratif** : le rejouer réconcilie la base avec ce
qui y est écrit, au lieu d'empiler une version de plus. C'est ce qui permet de
corriger un déclencheur en éditant sa définition, sans migration de reprise.

`scripts/migrate.mjs` reste le seul chemin d'application — étape de déploiement,
`bun run db:migrate` en local, et `playwright.config.ts` avant de servir — donc
une base migrée porte toujours ses déclencheurs.

## Conséquences

- **`src/db/schema.ts` ne dit pas toute la vérité sur la base.** Sa JSDoc renvoie
  ici, et `src/db/triggers.sql` renvoie au schéma : un lecteur qui n'ouvre qu'un
  seul des deux fichiers rate la moitié des invariants.
- **Le test de migrations lance le vrai script**, pas `migrate()` de Drizzle. Un
  test qui appellerait `migrate()` directement prouverait que le SQL s'applique
  et ne dirait **rien** des déclencheurs — c'est-à-dire raterait exactement le
  mode de défaillance que cette décision introduit : un fichier de déclencheurs
  correct que plus personne n'applique.
- **Les déclencheurs ne sont pas versionnés par le journal Drizzle.** Ils sont
  rejoués intégralement à chaque migration, ce qui est bon marché — une douzaine
  de `DROP`/`CREATE` — et supprime toute notion de migration de déclencheur.
- **`scripts/migrate.mjs` lit désormais dans `src/`**, alors qu'il est présenté
  comme de l'outillage runtime autonome. Le précédent existe déjà :
  `drizzle.config.ts` pointe sur `./src/db/schema.ts`, donc la chaîne de
  migration lisait `src/db/` avant ce changement. Le fichier reste à côté de
  `schema.ts` parce que c'est du **schéma**, pas de l'outillage, et que c'est là
  qu'un lecteur cherchant les invariants regarde. La contrepartie est qu'un
  déploiement qui n'embarquerait que `drizzle/` et `scripts/` échouerait — mais
  bruyamment, sur un `readFileSync`, pas en servant une base sans déclencheurs.
- **Le jour où Drizzle Kit saura générer des déclencheurs**, cette décision se
  reprend et le fichier disparaît dans le jeu de migrations.
