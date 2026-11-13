// Ver migrations/0099_pipeline_probability_model.sql (mismo contenido).
export const pipelineProbabilityMigrationSql = String.raw`
-- Modelo de probabilidad del pipeline: metodología versionada y cierres para aprender.
CREATE TABLE IF NOT EXISTS pipeline_methodology (
  version INTEGER PRIMARY KEY,
  model JSONB NOT NULL,
  basis TEXT NOT NULL,
  approved_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  approved_by_name TEXT,
  approved_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
INSERT INTO pipeline_methodology(version, model, basis, approved_by_name, approved_at)
VALUES (1, '{"stageBase":{"Prospección":10,"Reunión / demo":20,"Propuesta":40,"Negociación":70},"automatic":{"existingClient":15,"renewal":25,"decisionMaker":10,"knownCloseDate":5,"closeDateWithinDays":60,"stalePenalty":-20,"staleAfterDays":30,"competition":-10},"teamSignals":[{"key":"prioridad","label":"El cliente dijo que nos va a dar prioridad","points":10},{"key":"relacion-decisor","label":"Relación cercana con el decisor","points":5},{"key":"propuesta-solida","label":"Propuesta sólida / diferencial claro","points":5},{"key":"mas-caros","label":"Somos más caros que la competencia","points":-10},{"key":"cambio-interlocutor","label":"Cambió el interlocutor o hay reestructura","points":-10},{"key":"presupuesto-en-duda","label":"Presupuesto en duda o congelado","points":-15}],"maxTeamAdjustment":25,"manualRange":20,"manualExpiryDays":30,"floor":5,"ceiling":90,"priorWeight":10,"minOutcomesForSignals":30}'::jsonb,
  'Valores de referencia iniciales (base por etapa, señales automáticas y del equipo) definidos y aprobados por Tomás Criado el 13/11/2026. Se recalibran con los cierres de Epical.',
  'Tomás Criado', '2026-11-13T15:00:00-03:00')
ON CONFLICT (version) DO NOTHING;
CREATE TABLE IF NOT EXISTS pipeline_outcomes (
  id SERIAL PRIMARY KEY,
  opportunity_id INTEGER NOT NULL REFERENCES pipeline_opportunities(id) ON DELETE CASCADE,
  result TEXT NOT NULL CHECK (result IN ('won','lost')),
  reason TEXT NOT NULL,
  stages_reached TEXT[] NOT NULL DEFAULT '{}',
  signals TEXT[] NOT NULL DEFAULT '{}',
  predicted_final NUMERIC(5,2),
  predicted_model NUMERIC(5,2),
  methodology_version INTEGER,
  usd NUMERIC(14,2),
  closed_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  closed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS pipeline_outcomes_closed_idx ON pipeline_outcomes(closed_at DESC);
`;
