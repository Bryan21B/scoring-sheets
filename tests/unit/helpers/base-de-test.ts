import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Client } from "@libsql/client";
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import type { Base } from "@/db/base";
import * as schema from "@/db/schema";
import { toLibsqlUrl } from "@/db/url";

/**
 * Une base neuve, migrée par le **vrai** script de déploiement.
 *
 * `scripts/migrate.mjs` et pas `migrate()` de Drizzle : le script applique aussi
 * `src/db/triggers.sql`, et une base sans déclencheurs n'estampille pas les
 * versions — le test passerait sur une base que la production n'a jamais.
 *
 * `@/db` n'est jamais importé ici : ce module ouvre une connexion à
 * l'évaluation, ce qui ferait des tests des clients de la base de dev.
 */
export type BaseDeTest = {
  base: Base;
  client: Client;
  /** Ferme la connexion et efface le fichier. À appeler dans `afterEach`. */
  fermer: () => void;
};

const SCRIPT_DE_MIGRATION = "scripts/migrate.mjs";

/** Arguments en tableau, jamais en gabarit de chaîne : un chemin interpolé
 * dans une chaîne de shell est une injection de commande (CWE-78). */
function migrer(cheminBase: string): void {
  const resultat = Bun.spawnSync([process.execPath, SCRIPT_DE_MIGRATION], {
    env: { ...process.env, DATABASE_PATH: cheminBase },
    stdout: "pipe",
    stderr: "pipe",
  });

  if (resultat.exitCode !== 0) {
    throw new Error(
      `${SCRIPT_DE_MIGRATION} a rendu ${resultat.exitCode} : ${resultat.stderr.toString()}`,
    );
  }
}

/** Ouvre une base migrée, isolée, jetable. */
export function creerBaseDeTest(): BaseDeTest {
  const dossier = mkdtempSync(join(tmpdir(), "scoring-sheets-"));
  const cheminBase = join(dossier, "test.db");

  migrer(cheminBase);

  const client = createClient({ url: toLibsqlUrl(cheminBase) });
  // Éteint par défaut dans SQLite, et réactivé par connexion dans
  // `src/db/index.ts` : sans ça les clés étrangères ne seraient pas tenues.
  void client.execute("PRAGMA foreign_keys = ON");

  return {
    base: drizzle(client, { schema }),
    client,
    fermer: () => {
      client.close();
      rmSync(dossier, { recursive: true, force: true });
    },
  };
}
