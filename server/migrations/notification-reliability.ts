export const notificationReliabilityMigrationSql = String.raw`
ALTER TABLE user_notifications ADD COLUMN IF NOT EXISTS thread_key TEXT;
ALTER TABLE user_notification_preferences ADD COLUMN IF NOT EXISTS settings JSONB NOT NULL DEFAULT '{"activityEmailMode":"daily","digestHour":9,"timeZone":"America/Argentina/Buenos_Aires","quietHours":{"enabled":false,"start":20,"end":9}}'::jsonb;
ALTER TABLE user_notification_push_subscriptions ADD COLUMN IF NOT EXISTS device_token TEXT;
-- Legacy subscriptions cannot be revoked server-side on logout. Reconnect once
-- to establish a device cookie instead of leaving an anonymous push endpoint.
DELETE FROM user_notification_push_subscriptions WHERE device_token IS NULL;
ALTER TABLE user_notification_email_deliveries ADD COLUMN IF NOT EXISTS batch_key TEXT;
ALTER TABLE user_notification_email_deliveries ADD COLUMN IF NOT EXISTS delivered_at TIMESTAMPTZ;
ALTER TABLE user_notification_email_deliveries ADD COLUMN IF NOT EXISTS delivery_status TEXT;
ALTER TABLE user_notification_email_deliveries ADD COLUMN IF NOT EXISTS delivery_provider TEXT NOT NULL DEFAULT 'resend';
DO $$
DECLARE column_name_to_fix TEXT;
BEGIN
  FOREACH column_name_to_fix IN ARRAY ARRAY['next_attempt_at','locked_at','sent_at','created_at','updated_at','delivered_at'] LOOP
    IF EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=current_schema() AND table_name='user_notification_email_deliveries' AND column_name=column_name_to_fix AND data_type='timestamp without time zone') THEN
      EXECUTE format('ALTER TABLE user_notification_email_deliveries ALTER COLUMN %I TYPE TIMESTAMPTZ USING %I AT TIME ZONE ''UTC''',column_name_to_fix,column_name_to_fix);
    END IF;
  END LOOP;
END $$;
CREATE INDEX IF NOT EXISTS notification_email_batch_idx ON user_notification_email_deliveries(batch_key);
CREATE INDEX IF NOT EXISTS notifications_user_cursor_idx ON user_notifications(user_id, id DESC);
CREATE TABLE IF NOT EXISTS user_notification_push_deliveries (
  id SERIAL PRIMARY KEY,
  notification_id INTEGER NOT NULL REFERENCES user_notifications(id) ON DELETE CASCADE,
  subscription_id INTEGER NOT NULL REFERENCES user_notification_push_subscriptions(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending', attempts INTEGER NOT NULL DEFAULT 0,
  next_attempt_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), locked_at TIMESTAMPTZ, last_error TEXT,
  UNIQUE(notification_id, subscription_id)
);
CREATE INDEX IF NOT EXISTS notification_push_due_idx ON user_notification_push_deliveries(status, next_attempt_at);
CREATE TABLE IF NOT EXISTS user_notification_thread_mutes (
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, thread_key TEXT NOT NULL,
  PRIMARY KEY(user_id, thread_key)
);
CREATE TABLE IF NOT EXISTS notification_email_batches (
  batch_key TEXT PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  payload JSONB, provider_id TEXT, status TEXT NOT NULL DEFAULT 'pending', updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS notification_email_events (
  event_id TEXT PRIMARY KEY, provider_id TEXT NOT NULL, provider TEXT NOT NULL DEFAULT 'resend', type TEXT NOT NULL, occurred_at TIMESTAMPTZ NOT NULL
);
CREATE INDEX IF NOT EXISTS notification_email_events_provider_idx ON notification_email_events(provider_id);
CREATE TABLE IF NOT EXISTS notification_email_suppressions(email TEXT PRIMARY KEY,reason TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS transactional_email_deliveries (
  idempotency_key TEXT PRIMARY KEY, payload_hash TEXT NOT NULL, provider TEXT NOT NULL,
  provider_id TEXT, recipient TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'processing',
  delivery_status TEXT, last_error TEXT,created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS transactional_email_provider_idx ON transactional_email_deliveries(provider_id);
`;
