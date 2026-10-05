export const userNotificationPushSubscriptionsMigrationSql = `
CREATE TABLE IF NOT EXISTS user_notification_push_subscriptions (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL UNIQUE,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  user_agent TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS user_notification_push_subscriptions_user_idx
  ON user_notification_push_subscriptions(user_id);

-- Previous desktop opt-ins only worked while Mind was open. Ask those people
-- to explicitly link a browser subscription before showing desktop as active.
UPDATE user_notification_preferences AS preferences
SET desktop_enabled = FALSE,
    setup_completed_at = NULL,
    updated_at = NOW()
WHERE preferences.desktop_enabled = TRUE
  AND NOT EXISTS (
    SELECT 1 FROM user_notification_push_subscriptions AS subscriptions
    WHERE subscriptions.user_id = preferences.user_id
  );
`;
