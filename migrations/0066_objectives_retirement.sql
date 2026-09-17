-- Quince entradas del plan estaban guardadas como objetivos sin serlo: nueve
-- repetían a nivel persona algo ya dicho a nivel área, y siete eran tareas con
-- fecha. No se borran —conservan su avance y su historial—: se marcan como
-- retiradas para que dejen de contarse y de mostrarse como objetivos.
ALTER TABLE "objectives"
  ADD COLUMN IF NOT EXISTS "retired_at" timestamp,
  ADD COLUMN IF NOT EXISTS "retired_reason" varchar(40);

CREATE INDEX IF NOT EXISTS "idx_objectives_retired" ON "objectives" ("retired_at");
