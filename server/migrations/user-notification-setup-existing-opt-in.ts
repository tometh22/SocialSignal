export const userNotificationSetupExistingOptInMigrationSql = String.raw`
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM user_notification_setup_migration_state
    WHERE migration_key = '0079_prompt_existing_users_without_channels'
  ) THEN
    UPDATE user_notification_preferences
    SET setup_completed_at = NULL, updated_at = NOW()
    WHERE desktop_enabled = FALSE
      AND email_enabled = FALSE
      AND setup_completed_at IS NOT NULL;

    INSERT INTO user_notification_setup_migration_state (migration_key)
    VALUES ('0079_prompt_existing_users_without_channels');
  END IF;
END $$;
`;
