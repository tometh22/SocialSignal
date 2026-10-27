// Generado a partir de migrations/0056_quotation_credit_program.sql — mantener en sync.
export const creditProgramMigrationSql = String.raw`
ALTER TABLE quotations
  ADD COLUMN IF NOT EXISTS credit_program jsonb;
-- Absence of a credit program stays NULL. Legacy {} is accepted on read.
`;
