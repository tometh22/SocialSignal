CREATE TABLE IF NOT EXISTS pipeline_opportunities (
 id serial PRIMARY KEY, import_key text UNIQUE, lead_id integer REFERENCES crm_leads(id), client_id integer REFERENCES clients(id), owner_id integer REFERENCES users(id), contact_id integer REFERENCES crm_contacts(id), quotation_id integer REFERENCES quotations(id), quotation_group_id integer REFERENCES quotation_groups(id),
 usd numeric(14,2), probability numeric(5,2) CHECK(probability BETWEEN 0 AND 100), close_date date, evidence_date date,
 data jsonb NOT NULL, version integer NOT NULL DEFAULT 1, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS pipeline_lead_idx ON pipeline_opportunities(lead_id);
CREATE INDEX IF NOT EXISTS pipeline_client_idx ON pipeline_opportunities(client_id);
CREATE INDEX IF NOT EXISTS pipeline_owner_idx ON pipeline_opportunities(owner_id);
CREATE INDEX IF NOT EXISTS pipeline_close_idx ON pipeline_opportunities(close_date);
CREATE TABLE IF NOT EXISTS pipeline_cuts (id serial PRIMARY KEY, period text NOT NULL, version integer NOT NULL, request_key text UNIQUE NOT NULL, payload jsonb NOT NULL, created_by integer REFERENCES users(id), created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(period,version));
CREATE TABLE IF NOT EXISTS pipeline_log (id serial PRIMARY KEY, actor_id integer REFERENCES users(id), opportunity_id integer REFERENCES pipeline_opportunities(id), period text, kind text NOT NULL, reason text NOT NULL, changes jsonb NOT NULL DEFAULT '{}', created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS pipeline_checklists (period text PRIMARY KEY, steps jsonb NOT NULL DEFAULT '[false,false,false,false]', version integer NOT NULL DEFAULT 1);
CREATE TABLE IF NOT EXISTS pipeline_settings (id integer PRIMARY KEY CHECK(id=1), threshold numeric(5,2) NOT NULL DEFAULT 50 CHECK(threshold BETWEEN 0 AND 100), version integer NOT NULL DEFAULT 1);
INSERT INTO pipeline_settings(id) VALUES(1) ON CONFLICT DO NOTHING;
CREATE OR REPLACE FUNCTION pipeline_reject_history_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'Pipeline history is immutable; create a new version'; END;
$$;
DO $$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM pg_trigger WHERE tgname='pipeline_cuts_immutable') THEN
  CREATE TRIGGER pipeline_cuts_immutable BEFORE UPDATE OR DELETE ON pipeline_cuts FOR EACH ROW EXECUTE FUNCTION pipeline_reject_history_mutation();
 END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_trigger WHERE tgname='pipeline_log_immutable') THEN
  CREATE TRIGGER pipeline_log_immutable BEFORE UPDATE OR DELETE ON pipeline_log FOR EACH ROW EXECUTE FUNCTION pipeline_reject_history_mutation();
 END IF;
END $$;
