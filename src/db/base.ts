import type { LibSQLDatabase } from "drizzle-orm/libsql";
import type * as schema from "@/db/schema";

/**
 * La base, telle que la logique métier la reçoit.
 *
 * Le type vit ici et non dans `src/db/index.ts` parce que ce module-là ouvre une
 * connexion à son évaluation : un test qui l'importerait, même pour un type,
 * parlerait à la base de développement. Ici il n'y a que des types, donc rien à
 * exécuter.
 *
 * Toute fonction qui écrit prend la base **en paramètre** plutôt que d'importer
 * le singleton : c'est ce qui la rend vérifiable contre une base jetable.
 */
export type Base = LibSQLDatabase<typeof schema>;

/**
 * La base **à l'intérieur d'une transaction**.
 *
 * Une fonction qui lit pour décider de ce qu'elle va écrire doit prendre ce
 * type et non `Base` : sinon sa lecture et son écriture sont deux gestes qu'une
 * écriture concurrente peut séparer.
 */
export type Ecriture = Parameters<Parameters<Base["transaction"]>[0]>[0];
