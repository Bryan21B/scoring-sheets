# Domain Docs

How the engineering skills should consume this repo's domain documentation when exploring the codebase.

**Layout: single-context.** One `CONTEXT.md` at the repo root, one `docs/adr/` directory.

## Before exploring, read these

- **`CONTEXT.md`** at the repo root: the glossary. It has an "Acquis" section (settled
  vocabulary) and an "À trancher" section (open questions that decide the schema). Both
  matter — the open list tells you what is deliberately not decided yet.
- **`docs/adr/`**: read ADRs that touch the area you're about to work in.

If any of these files don't exist, **proceed silently**. Don't flag their absence; don't suggest creating them upfront. The `/domain-modeling` skill (reached via `/grill-with-docs` and `/improve-codebase-architecture`) creates them lazily when terms or decisions actually get resolved.

## File structure

Single-context repo (this one):

```
/
├── CONTEXT.md
├── docs/adr/
│   ├── 0001-libsql-comme-driver-sqlite.md
│   └── 0002-deploiement-vercel-et-base-turso.md
└── src/
```

Multi-context repos add a root `CONTEXT-MAP.md` pointing at one `CONTEXT.md` per context,
with context-scoped `src/<context>/docs/adr/`. This repo is a single Next.js app, so that
layout does not apply; switch only if it genuinely splits into separate packages.

## Design docs sit alongside ADRs

`docs/specs/YYYY-MM-DD-sujet.md` holds design docs for non-trivial features: 2-3 compared
approaches, written before any code (see the working loop in `CLAUDE.md`). An ADR in
`docs/adr/` records the decision once it's made. When exploring a feature area, a spec in
`docs/specs/` is often the freshest account of the reasoning.

## Use the glossary's vocabulary

When your output names a domain concept (in an issue title, a refactor proposal, a hypothesis, a test name), use the term as defined in `CONTEXT.md`. Don't drift to synonyms the glossary explicitly avoids.

If the concept you need isn't in the glossary yet, that's a signal: either you're inventing language the project doesn't use (reconsider) or there's a real gap (note it for `/domain-modeling`).

Note that the domain terms here are French (`Partie`, `Feuille de score`, `Joueur`,
`Manche`) — keep them as written rather than translating them into code or issue titles.

## Flag ADR conflicts

If your output contradicts an existing ADR, surface it explicitly rather than silently overriding:

> _Contradicts ADR-0002 (déploiement Vercel et base Turso), but worth reopening because…_
