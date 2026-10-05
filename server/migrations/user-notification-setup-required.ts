export const userNotificationSetupRequiredMigrationSql = String.raw`
ALTER TABLE user_notification_preferences
  ADD COLUMN IF NOT EXISTS setup_completed_at TIMESTAMP;

CREATE TABLE IF NOT EXISTS user_notification_setup_migration_state (
  migration_key TEXT PRIMARY KEY,
  completed_at TIMESTAMP NOT NULL DEFAULT NOW()
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM user_notification_setup_migration_state
    WHERE migration_key = '0078_seed_existing_users'
  ) THEN
    INSERT INTO user_notification_preferences (user_id, desktop_enabled, email_enabled, setup_completed_at)
    SELECT id, FALSE, FALSE, NOW() FROM users
    ON CONFLICT (user_id) DO UPDATE
      SET setup_completed_at = COALESCE(user_notification_preferences.setup_completed_at, NOW());

    INSERT INTO user_notification_setup_migration_state (migration_key)
    VALUES ('0078_seed_existing_users');
  END IF;
END $$;
`;
