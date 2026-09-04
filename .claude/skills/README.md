# Skills engineering (mattpocock/skills)

Copie vendorée du bucket `skills/engineering/` de
[`mattpocock/skills`](https://github.com/mattpocock/skills) (MIT).

- **Source** : `https://github.com/mattpocock/skills`
- **Commit** : `3cca18b368ae95cdbdebbff572ccafa662551015`
- **Version du plugin amont** : `1.2.3`
- **Importé le** : 2026-09-04

## Pourquoi vendoré plutôt que plugin

Le plugin Claude Code (`claude plugins install mattpocock-skills`) s'installe au
niveau utilisateur : il ne suit pas le repo, disparaît dans les sessions cloud, et
les skills y sont en lecture seule. Ici les skills sont des fichiers du repo :
disponibles partout où le repo l'est, éditables, et le diff d'une adaptation locale
est visible en review. C'est le mode « for tinkerers » documenté en amont.

## Ce qui est inclus

Les 18 skills du bucket `engineering/`. Les `agents/openai.yaml` (politique
d'invocation côté Codex) ne sont pas repris : Claude Code lit `disable-model-invocation`
dans le frontmatter du `SKILL.md`, qui est conservé tel quel.

Les buckets `productivity/`, `misc/`, `in-progress/` et `deprecated/` ne sont pas
installés. Conséquence : `/ask-matt` route vers `/grill-me` et `/handoff`, qui vivent
dans `productivity/` et sont donc absents. Utiliser `/grill-with-docs` à la place de
`/grill-me`.

## Config repo

`/setup-matt-pocock-skills` a déjà tourné sur ce repo : la config vit dans
`docs/agents/` (issue tracker GitHub, labels de triage, docs de domaine) et est
résumée dans `CLAUDE.md`. Pas besoin de le relancer, sauf pour changer un de ces choix.

## Mise à jour

Rien ne se met à jour tout seul. Pour tirer l'amont :

```bash
npx skills@latest update
```

ou, à la main, rejouer la copie depuis un clone du repo amont et relire le diff —
les adaptations locales sont dans l'historique git de ce dossier.
