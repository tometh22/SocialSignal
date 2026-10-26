import { beforeAll, beforeEach, afterAll, describe, expect, it, vi } from 'vitest';
import { Pool } from 'pg';
import { getTableColumns, getTableName } from 'drizzle-orm';
import { projectStatusReviews, weeklyStatusItems, statusUpdateEntries, statusChangeLog } from '../shared/schema';
const fixture = vi.hoisted(() => ({ url: process.env.FINANCIAL_TEST_DATABASE_URL, schema: `status_action_${process.pid}` }));
if (fixture.url && !['localhost','127.0.0.1','[::1]'].includes(new URL(fixture.url).hostname)) throw new Error('Local test database required');
vi.mock('../server/db', async () => {
  const { Pool } = await import('pg'); const { drizzle } = await import('drizzle-orm/node-postgres');
  const pool = new Pool({connectionString:fixture.url,options:`-c search_path=${fixture.schema}`,max:3});
  return {pool,db:drizzle(pool)};
});
import {pool} from '../server/db';
import {saveStatusCurrentAction} from '../server/services/status-current-action';
describe.skipIf(!fixture.url)('canonical Status and Daily state in PostgreSQL', () => {
  let admin: Pool;
  beforeAll(async () => {
    admin=new Pool({connectionString:fixture.url}); await admin.query(`CREATE SCHEMA ${fixture.schema}`);
    for (const table of [projectStatusReviews,weeklyStatusItems,statusUpdateEntries,statusChangeLog]) {
      const columns = Object.values(getTableColumns(table)).map(col => `"${col.name}" ${col.getSQLType()}${col.primary ? ' PRIMARY KEY' : ''}`);
      await pool.query(`CREATE TABLE "${getTableName(table)}" (${columns.join(',')})`);
    }
  });
  beforeEach(async () => {
    await pool.query('TRUNCATE project_status_reviews,weekly_status_items,status_update_entries,status_change_log RESTART IDENTITY');
    await pool.query("INSERT INTO project_status_reviews(room_id,project_id,current_action,next_milestone) VALUES(1,100,'Anterior','Conservar historial'); INSERT INTO weekly_status_items(id,room_id,title,current_action) VALUES(10,1,'QA','Anterior')");
  });
  afterAll(async () => {await pool.end(); if(admin) {await admin.query(`DROP SCHEMA ${fixture.schema} CASCADE`);await admin.end();}});
  it('uses one state for list and Daily and preserves the retired next step', async () => {
    await saveStatusCurrentAction(1,{projectId:100},'Editado desde Daily',2,'Anterior');
    const {rows:[state]}=await pool.query('SELECT current_action,next_milestone FROM project_status_reviews');
    expect(state).toEqual({current_action:'Editado desde Daily',next_milestone:'Conservar historial'});
    expect((await pool.query('SELECT content FROM status_update_entries')).rows).toEqual([{content:'Editado desde Daily'}]);
    expect((await pool.query('SELECT old_value,new_value FROM status_change_log')).rows).toEqual([{old_value:'Anterior',new_value:'Editado desde Daily'}]);
  });
  it('scopes custom items to their room and allows clearing the canonical state', async () => {
    await expect(saveStatusCurrentAction(2,{customId:10},'Ajeno',2)).rejects.toMatchObject({statusCode:404});
    expect((await pool.query('SELECT count(*)::int n FROM status_update_entries')).rows[0].n).toBe(0);
    await saveStatusCurrentAction(1,{customId:10},'',2,'Anterior');
    expect((await pool.query('SELECT current_action FROM weekly_status_items WHERE id=10')).rows[0].current_action).toBe('');
  });
  it('rejects a stale Daily edit and rolls back both history and state when the audit insert fails', async () => {
    await saveStatusCurrentAction(1,{projectId:100},'Primero',2,'Anterior');
    await expect(saveStatusCurrentAction(1,{projectId:100},'Obsoleto',3,'Anterior')).rejects.toMatchObject({statusCode:409});
    await pool.query("ALTER TABLE status_change_log ADD CONSTRAINT reject_test CHECK(new_value <> 'Falla')");
    try { await expect(saveStatusCurrentAction(1,{projectId:100},'Falla',2,'Primero')).rejects.toThrow(); }
    finally {await pool.query('ALTER TABLE status_change_log DROP CONSTRAINT reject_test');}
    expect((await pool.query('SELECT current_action FROM project_status_reviews')).rows[0].current_action).toBe('Primero');
    expect((await pool.query('SELECT count(*)::int n FROM status_update_entries')).rows[0].n).toBe(1);
  });
  it('serializes concurrent edits of the same state', async () => {
    const edits=await Promise.allSettled(['A','B'].map(value=>saveStatusCurrentAction(1,{projectId:100},value,2,'Anterior')));
    expect(edits.filter(edit=>edit.status==='fulfilled')).toHaveLength(1);
    expect(edits.filter(edit=>edit.status==='rejected')).toHaveLength(1);
    expect((await pool.query('SELECT count(*)::int n FROM status_update_entries')).rows[0].n).toBe(1);
  });
});
