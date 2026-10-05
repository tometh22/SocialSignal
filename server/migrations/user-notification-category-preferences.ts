export const userNotificationCategoryPreferencesMigrationSql = String.raw`
ALTER TABLE user_notification_preferences
  ADD COLUMN IF NOT EXISTS category_preferences JSONB NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE user_notification_preferences
  ADD COLUMN IF NOT EXISTS discreet_mode BOOLEAN NOT NULL DEFAULT TRUE;
`;
