-- Run each statement independently, outside a transaction, using npm run db:performance-indexes.
CREATE INDEX CONCURRENTLY IF NOT EXISTS tasks_assignee_due_idx ON tasks(assignee_id,due_date,id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS tasks_project_order_idx ON tasks(project_id,section_name,position,id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS tasks_parent_read_idx ON tasks(parent_task_id) WHERE parent_task_id IS NOT NULL;
CREATE INDEX CONCURRENTLY IF NOT EXISTS tasks_collaborators_gin_idx ON tasks USING gin(collaborator_ids jsonb_path_ops);
CREATE INDEX CONCURRENTLY IF NOT EXISTS task_hours_person_task_idx ON task_time_entries(personnel_id,task_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS crm_contact_lead_idx ON crm_contacts(lead_id,is_primary DESC,id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS crm_activity_latest_idx ON crm_activities(lead_id,activity_date DESC,id DESC);
CREATE INDEX CONCURRENTLY IF NOT EXISTS crm_reminder_pending_idx ON crm_reminders(lead_id) WHERE completed=false;
CREATE INDEX CONCURRENTLY IF NOT EXISTS crm_leads_stage_page_idx ON crm_leads(stage,id DESC);
CREATE INDEX CONCURRENTLY IF NOT EXISTS quotation_active_page_idx ON quotations(id DESC) WHERE archived_at IS NULL;
CREATE INDEX CONCURRENTLY IF NOT EXISTS financial_intake_queue_idx ON financial_intake_items(status,updated_at,id) WHERE status IN ('received','processing');
CREATE INDEX CONCURRENTLY IF NOT EXISTS personnel_normalized_email_idx ON personnel(lower(trim(email))) WHERE email IS NOT NULL;
-- The database owner may need to enable this extension before the release job runs.
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX CONCURRENTLY IF NOT EXISTS client_search_name_idx ON clients USING gin(name gin_trgm_ops);
CREATE INDEX CONCURRENTLY IF NOT EXISTS client_search_contact_idx ON clients USING gin(contact_name gin_trgm_ops);
CREATE INDEX CONCURRENTLY IF NOT EXISTS client_search_email_idx ON clients USING gin(contact_email gin_trgm_ops);
CREATE INDEX CONCURRENTLY IF NOT EXISTS project_search_name_idx ON active_projects USING gin(name gin_trgm_ops);
CREATE INDEX CONCURRENTLY IF NOT EXISTS quotation_search_name_idx ON quotations USING gin(project_name gin_trgm_ops);
CREATE INDEX CONCURRENTLY IF NOT EXISTS crm_search_company_idx ON crm_leads USING gin(company_name gin_trgm_ops);
CREATE INDEX CONCURRENTLY IF NOT EXISTS crm_search_opportunity_idx ON crm_leads USING gin(opportunity_name gin_trgm_ops);
CREATE INDEX CONCURRENTLY IF NOT EXISTS crm_search_contact_idx ON crm_contacts USING gin(name gin_trgm_ops);
CREATE INDEX CONCURRENTLY IF NOT EXISTS deliverable_search_name_idx ON deliverables USING gin(name gin_trgm_ops);
