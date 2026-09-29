-- El seed reconcilia target_date contra el plan en cada arranque, así que una
-- fecha movida desde la pantalla se perdería en el próximo deploy. La fecha
-- que decide el equipo vive aparte y, si existe, manda sobre la del plan.
ALTER TABLE "objectives"
  ADD COLUMN IF NOT EXISTS "rescheduled_date" date;
