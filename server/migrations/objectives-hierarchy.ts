// Generated from migrations/0065_objectives_hierarchy.sql — keep both files in sync.
export const objectivesHierarchyMigrationSql = String.raw`
-- Jerarquía y meta medible para los objetivos.
-- parent_objective_id convierte tres listas planas en un árbol.
-- target_kind/value/unit/date sacan el número y la fecha de corte del texto
-- libre de "target", donde no servían para calcular avance ni para ordenar.
ALTER TABLE "objectives"
  ADD COLUMN IF NOT EXISTS "parent_objective_id" integer,
  ADD COLUMN IF NOT EXISTS "target_kind" varchar(20) NOT NULL DEFAULT 'milestone',
  ADD COLUMN IF NOT EXISTS "target_value" numeric(14,2),
  ADD COLUMN IF NOT EXISTS "target_unit" varchar(40),
  ADD COLUMN IF NOT EXISTS "target_date" date;

DO $$
BEGIN
  ALTER TABLE "objectives"
    ADD CONSTRAINT "objectives_parent_objective_id_fkey"
    FOREIGN KEY ("parent_objective_id") REFERENCES "objectives"("id") ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS "idx_objectives_parent" ON "objectives" ("parent_objective_id");
CREATE INDEX IF NOT EXISTS "idx_objectives_target_date" ON "objectives" ("target_date");
`;
