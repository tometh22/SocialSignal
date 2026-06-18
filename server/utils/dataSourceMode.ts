import { db } from '../db';
import { systemConfig } from '@shared/schema';
import { eq } from 'drizzle-orm';

export type HoursDataSource = 'excel' | 'app';

export async function getHoursDataSource(): Promise<HoursDataSource> {
  const row = await db
    .select({ configValue: systemConfig.configValue })
    .from(systemConfig)
    .where(eq(systemConfig.configKey, 'hours_data_source'))
    .limit(1)
    .then((rows) => rows[0]);
  return row?.configValue === 1 ? 'app' : 'excel';
}
