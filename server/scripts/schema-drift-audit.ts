import { getTableConfig, PgTable } from 'drizzle-orm/pg-core';
import * as schema from '@shared/schema';
import { pool } from '../db';

/**
 * Auditoría de deriva entre shared/schema.ts y la base real.
 *
 * Motivación (2026-08-21): producción tenía 13 de 14 tablas de ingesta SIN la
 * constraint única que el schema declaraba. Sin constraint, `INSERT ... ON
 * CONFLICT` no puede funcionar y todo ETL termina siendo un append. Eso explicó
 * de una sola vez la duplicación 764x de cashflow_transactions, el período
 * 2026-03 cargado dos veces y los 298k de filas archivadas como "duplicated
 * snapshot cleanup".
 *
 * El código decía una cosa y la base decía otra, y nada lo señalaba.
 *
 *   npx tsx server/scripts/schema-drift-audit.ts        # reporte
 *   npx tsx server/scripts/schema-drift-audit.ts --sql  # DDL para cerrar la brecha
 */

export interface SchemaDrift {
  missingTables: string[];
  missingColumns: Array<{ table: string; columns: string[] }>;
  missingUniques: Array<{ table: string; columns: string[] }>;
  declaredTables: number;
  liveTables: number;
}

export async function auditSchemaDrift(): Promise<SchemaDrift> {
  const declared = new Map<string, { cols: Set<string>; uniques: string[][] }>();
  for (const value of Object.values(schema)) {
    if (!(value instanceof PgTable)) continue;
    const config = getTableConfig(value as any);
    declared.set(config.name, {
      cols: new Set(config.columns.map((c: any) => c.name)),
      uniques: [
        ...config.uniqueConstraints.map((u: any) => u.columns.map((c: any) => c.name)),
        ...config.columns.filter((c: any) => c.isUnique).map((c: any) => [c.name]),
      ],
    });
  }

  const { rows: colRows } = await pool.query(
    `SELECT table_name, column_name FROM information_schema.columns WHERE table_schema = 'public'`,
  );
  const live = new Map<string, Set<string>>();
  for (const row of colRows) {
    if (!live.has(row.table_name)) live.set(row.table_name, new Set());
    live.get(row.table_name)!.add(row.column_name);
  }

  // Unique constraints e índices únicos: drizzle puede materializar cualquiera
  // de los dos, así que para "existe" cuentan ambos.
  const { rows: uniqueRows } = await pool.query(
    `SELECT c.relname AS tbl,
            (SELECT array_agg(a.attname::text ORDER BY a.attname::text)
               FROM unnest(con.conkey) k
               JOIN pg_attribute a ON a.attrelid = c.oid AND a.attnum = k) AS cols
       FROM pg_constraint con
       JOIN pg_class c ON c.oid = con.conrelid
       JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND con.contype = 'u'
      UNION ALL
     SELECT c.relname AS tbl,
            (SELECT array_agg(a.attname::text ORDER BY a.attname::text)
               FROM unnest(i.indkey::int2[]) k
               JOIN pg_attribute a ON a.attrelid = c.oid AND a.attnum = k) AS cols
       FROM pg_index i
       JOIN pg_class c ON c.oid = i.indrelid
       JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND i.indisunique AND NOT i.indisprimary`,
  );
  const liveUniques = new Map<string, Set<string>>();
  for (const row of uniqueRows) {
    if (!Array.isArray(row.cols) || row.cols.length === 0) continue;
    if (!liveUniques.has(row.tbl)) liveUniques.set(row.tbl, new Set());
    liveUniques.get(row.tbl)!.add((row.cols as string[]).slice().sort().join('|'));
  }

  const drift: SchemaDrift = {
    missingTables: [],
    missingColumns: [],
    missingUniques: [],
    declaredTables: declared.size,
    liveTables: live.size,
  };

  for (const [name, decl] of declared) {
    const liveCols = live.get(name);
    if (!liveCols) {
      drift.missingTables.push(name);
      continue;
    }
    const missing = [...decl.cols].filter((c) => !liveCols.has(c));
    if (missing.length > 0) drift.missingColumns.push({ table: name, columns: missing });

    const present = liveUniques.get(name) ?? new Set<string>();
    for (const cols of decl.uniques) {
      if (!present.has(cols.slice().sort().join('|'))) {
        drift.missingUniques.push({ table: name, columns: cols });
      }
    }
  }

  return drift;
}

export interface DuplicateReport {
  table: string;
  columns: string[];
  rows: number;
  distinct: number;
  duplicates: number;
  hasId: boolean;
  /** true si la constraint entra sin borrar nada. */
  cleanApply: boolean;
}

/**
 * Para cada constraint faltante, cuántas filas sobran hoy.
 *
 * Es lo que separa "aplicar la constraint es gratis" de "hay que decidir qué se
 * borra". Sin este conteo, aplicar las 27 a ciegas rompe la mitad.
 */
export async function countDuplicates(drift: SchemaDrift): Promise<DuplicateReport[]> {
  const out: DuplicateReport[] = [];
  for (const { table, columns } of drift.missingUniques) {
    const cols = columns.map((c) => `"${c}"`).join(', ');
    // Postgres permite múltiples NULL bajo una constraint única, así que las
    // filas con NULL en cualquier columna de la clave no cuentan como duplicado.
    const notNull = columns.map((c) => `"${c}" IS NOT NULL`).join(' AND ');
    const { rows } = await pool.query(
      `SELECT count(*) FILTER (WHERE ${notNull})::int AS total,
              count(DISTINCT (${cols})) FILTER (WHERE ${notNull})::int AS distintos,
              EXISTS (SELECT 1 FROM information_schema.columns
                       WHERE table_name = $1 AND table_schema='public' AND column_name='id') AS has_id
         FROM "${table}"`,
      [table],
    );
    const total = Number(rows[0]?.total) || 0;
    const distinct = Number(rows[0]?.distintos) || 0;
    out.push({
      table,
      columns,
      rows: total,
      distinct,
      duplicates: total - distinct,
      hasId: rows[0]?.has_id === true,
      cleanApply: total === distinct,
    });
  }
  return out;
}

/**
 * DDL para cerrar la brecha de constraints únicas.
 *
 * Deduplica antes de aplicar cada constraint: una tabla con duplicados rechaza
 * el ALTER. Conserva la fila de menor id, que es la primera cargada.
 */
export function buildRepairSql(drift: SchemaDrift): string {
  const out: string[] = [];
  for (const { table, columns } of drift.missingUniques) {
    const cols = columns.map((c) => `"${c}"`).join(', ');
    const name = `${table}_${columns.join('_')}_unique`;
    out.push(
      `-- ${table} (${columns.join(', ')})`,
      `DELETE FROM "${table}" a USING "${table}" b`,
      ` WHERE a.id > b.id AND (${columns.map((c) => `a."${c}" = b."${c}"`).join(' AND ')});`,
      `DO $$ BEGIN`,
      `  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = '${name}') THEN`,
      `    ALTER TABLE "${table}" ADD CONSTRAINT "${name}" UNIQUE (${cols});`,
      `  END IF;`,
      `END $$;`,
      '',
    );
  }
  return out.join('\n');
}

const isDirectRun = process.argv[1]?.includes('schema-drift-audit');
if (isDirectRun) {
  auditSchemaDrift()
    .then((drift) => {
      if (process.argv.includes('--sql')) {
        console.log(buildRepairSql(drift));
        return;
      }
      console.log(`\n=== TABLAS DECLARADAS QUE NO EXISTEN (${drift.missingTables.length}) ===`);
      drift.missingTables.forEach((t) => console.log('  ' + t));
      console.log(`\n=== COLUMNAS FALTANTES (${drift.missingColumns.length}) ===`);
      drift.missingColumns.forEach((m) => console.log(`  ${m.table}: ${m.columns.join(', ')}`));
      console.log(`\n=== CONSTRAINTS ÚNICAS FALTANTES (${drift.missingUniques.length}) ===`);
      return countDuplicates(drift).then((dups) => {
        const pad = (s: string, n: number) => s.padEnd(n);
        console.log(`  ${pad('TABLA (columnas)', 62)} ${pad('FILAS', 9)} ${pad('ÚNICAS', 9)} SOBRAN`);
        for (const d of dups.sort((a, b) => b.duplicates - a.duplicates)) {
          const label = `${d.table} (${d.columns.join(', ')})`;
          const flag = d.cleanApply ? '✓ limpia' : `⚠ ${d.duplicates}`;
          console.log(`  ${pad(label, 62)} ${pad(String(d.rows), 9)} ${pad(String(d.distinct), 9)} ${flag}${d.hasId ? '' : '  [sin id]'}`);
        }
        const limpias = dups.filter((d) => d.cleanApply).length;
        console.log(`\n  ${limpias} de ${dups.length} aplican sin borrar nada.`);
        console.log(`\nDeclaradas: ${drift.declaredTables} tablas | en la base: ${drift.liveTables}`);
      });
    })
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('❌ Auditoría falló:', err);
      process.exit(1);
    });
}
