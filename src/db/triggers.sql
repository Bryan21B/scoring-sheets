-- Triggers for the domain schema.
--
-- They live here rather than in `drizzle/` because Drizzle Kit has no trigger
-- primitive: nothing declared in `src/db/schema.ts` could ever generate them,
-- and `drizzle/` is never hand-edited. `scripts/migrate.mjs` applies this file
-- right after the generated migrations, so the deploy step, `bun run db:migrate`
-- and the unit tests all get the same database. See
-- `docs/adr/0007-declencheurs-hors-du-jeu-de-migrations.md`.
--
-- Every trigger is dropped before it is created, which makes the file
-- idempotent and, more usefully, declarative: re-running it reconciles the
-- database with what is written here instead of layering another version on top.

-- ---------------------------------------------------------------------------
-- The journal is append-only.
--
-- By trigger, not by discipline: discipline does not hold in a repository where
-- agents write. A line records who did what and when; correcting it would be
-- rewriting history, which is the one thing an audit trail must not allow.
-- ---------------------------------------------------------------------------

DROP TRIGGER IF EXISTS journal_refuse_la_mise_a_jour;
CREATE TRIGGER journal_refuse_la_mise_a_jour
BEFORE UPDATE ON journal
BEGIN
  SELECT RAISE(ABORT, 'journal: append-only, une ligne ne se modifie jamais');
END;

DROP TRIGGER IF EXISTS journal_refuse_la_suppression;
CREATE TRIGGER journal_refuse_la_suppression
BEFORE DELETE ON journal
BEGIN
  SELECT RAISE(ABORT, 'journal: append-only, une ligne ne se supprime jamais');
END;

-- ---------------------------------------------------------------------------
-- The version stamp.
--
-- `partie.version` is what the other phones poll. It has to move on *every*
-- write that changes what a partie shows, and an increment forgotten inside a
-- Server Action is invisible in development and fatal at the table: the writer
-- sees their own change, everyone else is served stale rows and nothing
-- protests. So the database carries it, not the application.
--
-- Four tables feed a partie: manche, saisie, participant and journal. The
-- journal only ever gets inserts — the two triggers above refuse the rest — so
-- it needs one trigger where the others need three.
--
-- A saisie reaches its partie through its manche. When a manche is deleted the
-- cascade may take its saisies with it, and the sub-query then finds nothing and
-- updates nothing: harmless, because the deletion of the manche has already
-- stamped the partie.
--
-- ATTENTION — une écriture qui ne touche QUE `partie` n'est pas estampillée.
-- Il n'y a pas de déclencheur sur `partie` : il devrait s'auto-mettre à jour, ce
-- qui dépend du pragma `recursive_triggers` et se paie d'une récursion à
-- surveiller. Or la fin d'une partie et la **reprise** sont exactement cela —
-- elles n'écrivent que `fin_le`, `fin_cause` et `fin_par`.
--
-- Ce n'est pas un trou tant que la règle applicative tient : `abandon` et
-- `reprise` sont deux des sept **gestes**, donc chacune de ces écritures pose
-- une ligne de journal, et c'est cette ligne qui fait bouger l'estampille. La
-- condition est qu'elles partagent la **même transaction** ; sinon les autres
-- téléphones voient une partie close sans l'avoir appris.
-- ---------------------------------------------------------------------------

DROP TRIGGER IF EXISTS manche_estampille_insertion;
CREATE TRIGGER manche_estampille_insertion
AFTER INSERT ON manche
BEGIN
  UPDATE partie SET version = version + 1 WHERE id = NEW.partie_id;
END;

DROP TRIGGER IF EXISTS manche_estampille_mise_a_jour;
CREATE TRIGGER manche_estampille_mise_a_jour
AFTER UPDATE ON manche
BEGIN
  UPDATE partie SET version = version + 1 WHERE id = NEW.partie_id;
END;

DROP TRIGGER IF EXISTS manche_estampille_suppression;
CREATE TRIGGER manche_estampille_suppression
AFTER DELETE ON manche
BEGIN
  UPDATE partie SET version = version + 1 WHERE id = OLD.partie_id;
END;

DROP TRIGGER IF EXISTS saisie_estampille_insertion;
CREATE TRIGGER saisie_estampille_insertion
AFTER INSERT ON saisie
BEGIN
  UPDATE partie SET version = version + 1
   WHERE id = (SELECT partie_id FROM manche WHERE id = NEW.manche_id);
END;

DROP TRIGGER IF EXISTS saisie_estampille_mise_a_jour;
CREATE TRIGGER saisie_estampille_mise_a_jour
AFTER UPDATE ON saisie
BEGIN
  UPDATE partie SET version = version + 1
   WHERE id = (SELECT partie_id FROM manche WHERE id = NEW.manche_id);
END;

DROP TRIGGER IF EXISTS saisie_estampille_suppression;
CREATE TRIGGER saisie_estampille_suppression
AFTER DELETE ON saisie
BEGIN
  UPDATE partie SET version = version + 1
   WHERE id = (SELECT partie_id FROM manche WHERE id = OLD.manche_id);
END;

DROP TRIGGER IF EXISTS participant_estampille_insertion;
CREATE TRIGGER participant_estampille_insertion
AFTER INSERT ON participant
BEGIN
  UPDATE partie SET version = version + 1 WHERE id = NEW.partie_id;
END;

DROP TRIGGER IF EXISTS participant_estampille_mise_a_jour;
CREATE TRIGGER participant_estampille_mise_a_jour
AFTER UPDATE ON participant
BEGIN
  UPDATE partie SET version = version + 1 WHERE id = NEW.partie_id;
END;

DROP TRIGGER IF EXISTS participant_estampille_suppression;
CREATE TRIGGER participant_estampille_suppression
AFTER DELETE ON participant
BEGIN
  UPDATE partie SET version = version + 1 WHERE id = OLD.partie_id;
END;

DROP TRIGGER IF EXISTS journal_estampille_insertion;
CREATE TRIGGER journal_estampille_insertion
AFTER INSERT ON journal
BEGIN
  UPDATE partie SET version = version + 1 WHERE id = NEW.partie_id;
END;
