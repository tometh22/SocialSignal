// Generado a partir de migrations/0056_quotation_credit_program.sql — mantener en sync.
export const creditProgramMigrationSql = String.raw`
ALTER TABLE quotations
  ADD COLUMN IF NOT EXISTS credit_program jsonb;
UPDATE quotations
SET credit_program = '{}'::jsonb
WHERE credit_program IS NULL;
`;
