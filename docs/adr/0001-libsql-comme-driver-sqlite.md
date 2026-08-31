# 0001 — libSQL comme unique driver SQLite

- **Statut** : acceptée — héritée du template `bryan-cookie-starter`
- **Date** : 2026-08-31 (consignée au scaffolding de `scoring-sheets`)

## Contexte

Le projet fait tourner deux runtimes JavaScript, et ce n'est pas un accident :

- **Bun** exécute les tests unitaires (`bun test`), et installe les dépendances.
- **Node** build et sert Next.js, en local comme en production.

Un driver SQLite doit donc fonctionner à l'identique sous les deux. Les deux
candidats évidents échouent chacun d'un côté :

- `better-sqlite3` est un module natif N-API — il *panique* sous Bun.
- `bun:sqlite` est intégré à Bun, donc indisponible sous Node.

Choisir l'un ou l'autre obligerait à maintenir deux chemins de code, ou à faire
tourner les tests sur un driver différent de celui de la production — c'est-à-dire
à ne plus tester la production.

## Décision

Utiliser **`@libsql/client`** comme unique driver, avec `drizzle-orm/libsql`.

C'est le seul driver qui tourne inchangé sous Node et sous Bun. Il parle SQLite
en local (`file:`) et le protocole distant (`libsql:`, `https:`) sans changer une
ligne d'appelant.

## Conséquences

- Les tests et la production partagent le même driver. Un test qui passe teste
  bien ce qui tourne en prod.
- `next.config.ts` doit garder `serverExternalPackages: ["@libsql/client"]` : le
  binding natif doit rester un `require` réel et ne pas être tracé dans le bundle
  serveur.
- Le chemin de migration vers une base distante est gratuit — c'est ce qui rend
  possible la décision consignée dans `0002`.
- Ne pas « optimiser » en remplaçant le driver sans refaire ce raisonnement. Le
  gain de performance d'un driver natif ne paie pas la perte de la parité
  test/prod.
