import { sql } from "drizzle-orm";

type SqlExecutor = { execute: (query: ReturnType<typeof sql>) => Promise<unknown> };

/**
 * Users and personnel are linked only by email, and Tareas/Proyectos show the
 * personnel name while Usuarios/Status show the user name. Whenever a user's
 * name changes, mirror it on the linked personnel record so both read the same.
 *
 * The previous personnel name is kept as a Máster sheet alias: the hourly-rate
 * sync falls back to matching personnel by name, and the sheet may still use it.
 */
export async function syncPersonnelNameFromUser(executor: SqlExecutor, email: string, firstName: string, lastName: string) {
  const name = `${firstName.trim()} ${lastName.trim()}`.trim();
  if (!email.trim() || !name) return;
  await executor.execute(sql`
    WITH renamed AS (
      SELECT id, name AS old_name FROM personnel
      WHERE lower(trim(email)) = lower(trim(${email})) AND name IS DISTINCT FROM ${name}
      FOR UPDATE
    ), kept_alias AS (
      INSERT INTO sheet_personnel_aliases (sheet_name, personnel_id)
      SELECT old_name, id FROM renamed WHERE trim(coalesce(old_name, '')) <> ''
      ON CONFLICT (sheet_name) DO NOTHING
    )
    UPDATE personnel p SET name = ${name} FROM renamed WHERE p.id = renamed.id`);
}
