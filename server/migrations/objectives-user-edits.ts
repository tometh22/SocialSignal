// Generated from migrations/0068_objectives_user_edits.sql — keep both files in sync.
export const objectivesUserEditsMigrationSql = String.raw`
-- Objetivos y acciones se corrigen y se eliminan desde la pantalla. El seed
-- reconcilia contra el plan en cada arranque, así que necesita saber qué tocó
-- una persona para no revertirlo:
-- edited_at: alguien editó la fila; el seed deja de reasignar su responsable.
-- deleted_at: alguien la eliminó. No se borra —el seed la volvería a crear por
-- su slug—: queda marcada, fuera de la pantalla, y se puede deshacer.
ALTER TABLE "objectives"
  ADD COLUMN IF NOT EXISTS "edited_at" timestamp,
  ADD COLUMN IF NOT EXISTS "deleted_at" timestamp;

ALTER TABLE "objective_actions"
  ADD COLUMN IF NOT EXISTS "edited_at" timestamp,
  ADD COLUMN IF NOT EXISTS "deleted_at" timestamp;

CREATE INDEX IF NOT EXISTS "idx_objectives_deleted" ON "objectives" ("deleted_at");
CREATE INDEX IF NOT EXISTS "idx_objective_actions_deleted" ON "objective_actions" ("deleted_at");
`;
