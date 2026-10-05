export const userNotificationEmailDeliveriesMigrationSql = String.raw`
CREATE TABLE IF NOT EXISTS user_notification_email_deliveries (
  id SERIAL PRIMARY KEY,
  notification_id INTEGER NOT NULL UNIQUE REFERENCES user_notifications(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending',
  attempts INTEGER NOT NULL DEFAULT 0,
  next_attempt_at TIMESTAMP NOT NULL DEFAULT NOW(),
  locked_at TIMESTAMP,
  sent_at TIMESTAMP,
  resend_email_id TEXT,
  last_error TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS user_notification_email_due_idx
  ON user_notification_email_deliveries(status, next_attempt_at);
`;
