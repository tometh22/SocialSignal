/**
 * 📊 ETL from "Rendimiento Cliente" - Financial Source of Truth
 * Fuente unificada de ingresos y costos por proyecto
 */

import { db } from '../db';
import { financialSot } from '../../shared/schema';
import { sql } from 'drizzle-orm';
import { googleSheetsWorkingService } from '../services/googleSheetsWorking';
import { parseNumberRobust } from '../utils/number';

interface RendimientoClienteRow {
  Cliente?: string;
  "Tipo de proyecto"?: string;
  Proyecto?: string;
  Mes?: string;
  Año?: string | number;
  Cotización?: string | number;
  "Facturación [USD]"?: string | number; // Columna G (los headers usan corchetes)
  "Facturación [ARS]"?: string | number; // Columna I
  "Costos [USD]"?: string | number; // Columna H (los headers usan corchetes)
  "Costos [ARS]"?: string | number; // Columna K
  "Pasado/Futuro"?: string;
}

export interface ImportRendimientoClienteResult {
  inserted: number;
  updated: number;
  errors: string[];
}


/**
 * Convertir mes español a month_key YYYY-MM
 */
function monthKeyFromEs(mes: string, year: number): string {
  const m = mes.toLowerCase().trim();
  const map: Record<string, string> = {
    ene: "01", enero: "01", "01": "01",
    feb: "02", febrero: "02", "02": "02",
    mar: "03", marzo: "03", "03": "03",
    abr: "04", abril: "04", "04": "04",
    may: "05", mayo: "05", "05": "05",
    jun: "06", junio: "06", "06": "06",
    jul: "07", julio: "07", "07": "07",
    ago: "08", agosto: "08", "08": "08",
    sep: "09", sept: "09", septiembre: "09", "09": "09",
    oct: "10", octubre: "10", "10": "10",
    nov: "11", noviembre: "11", "11": "11",
    dic: "12", diciembre: "12", "12": "12",
  };
  
  // Buscar el token en el mes
  for (const [key, monthNum] of Object.entries(map)) {
    if (m.includes(key)) {
      return `${year}-${monthNum}`;
    }
  }
  
  return `${year}-01`; // fallback
}

/**
 * Leer pestaña "Rendimiento Cliente" usando el servicio singleton
 */
async function readRendimientoCliente(): Promise<any[]> {
  const sheetName = 'Rendimiento Cliente';
  
  console.log(`📥 Leyendo "${sheetName}" desde Excel MAESTRO...`);

  try {
    // Usar el método genérico del servicio
    const sheets = (googleSheetsWorkingService as any).createSheetsClientFromJSON();
    const spreadsheetId = '1FZLFmTQQOSYQns2cOYlM86UGEH7EHZsJOFegyDR7quc';
    const range = `${sheetName}!A:Z`;

    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range,
    });

    const rows = response.data.values;
    if (!rows || rows.length === 0) {
      console.log('⚠️ No hay datos en la pestaña');
      return [];
    }

    // Primera fila es headers
    const headers = rows[0] as string[];
    console.log(`📋 Headers encontrados: ${headers.join(', ')}`);

    // Convertir a objetos
    const data = [];
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      const obj: any = {};
      headers.forEach((header, index) => {
        obj[header] = row[index] || '';
      });
      data.push(obj);
    }

    console.log(`✅ Leídas ${data.length} filas de "${sheetName}"`);
    return data;
  } catch (error) {
    console.error(`❌ Error leyendo "${sheetName}":`, error);
    throw error;
  }
}

/**
 * Obtener FX del mes desde exchange_rates
 */
async function getFXForMonth(year: number, monthNum: number): Promise<number> {
  const result = await db.execute(sql`
    SELECT rate 
    FROM exchange_rates 
    WHERE year = ${year} AND month = ${monthNum}
    LIMIT 1
  `);
  
  if (result.rows && result.rows.length > 0) {
    return Number(result.rows[0].rate);
  }
  
  // Fallback: usar 1345 (promedio histórico)
  console.warn(`⚠️ No se encontró FX para ${year}-${String(monthNum).padStart(2, '0')}, usando 1345`);
  return 1345;
}

/**
 * Importar datos de "Rendimiento Cliente" a financial_sot
 */
export async function importRendimientoCliente(): Promise<ImportRendimientoClienteResult> {
  const result: ImportRendimientoClienteResult = {
    inserted: 0,
    updated: 0,
    errors: [],
  };

  try {
    console.log('🚀 Iniciando importación desde "Rendimiento Cliente"...');
    
    const rows = await readRendimientoCliente();
    
    if (rows.length === 0) {
      console.log('⚠️ No hay datos para procesar');
      return result;
    }

    let skippedNotReal = 0;
    const statusValues = new Set<string>();

    // Procesar cada fila
    for (const row of rows as RendimientoClienteRow[]) {
      try {
        // Validar campos requeridos
        if (!row.Cliente || !row.Proyecto || !row.Mes || !row.Año) {
          console.log('⏭️ Saltando fila por campos faltantes:', { cliente: row.Cliente, proyecto: row.Proyecto, mes: row.Mes, año: row.Año });
          continue; // Skip rows sin datos básicos
        }

        // ⚠️ FILTRO CRÍTICO: Solo importar proyectos confirmados
        // Si la columna "Pasado/Futuro" existe Y tiene valor, solo aceptar "Real"
        // Si está vacía o no existe, asumir que son confirmados
        const statusValue = row["Pasado/Futuro"];
        const hasPasadoFuturo = statusValue !== undefined && 
                                statusValue !== null && 
                                String(statusValue).trim() !== '';
        
        if (hasPasadoFuturo) {
          const statusFlag = String(statusValue).trim().toLowerCase();
          statusValues.add(statusFlag);
          
          if (statusFlag !== 'real') {
            skippedNotReal++;
            console.log(`⏭️ Saltando fila por status "${statusFlag}": ${row.Cliente} - ${row.Proyecto}`);
            continue; // Skip rows que no son "Real" (futuro/pasado proyectado)
          }
        } else {
          // Columna vacía o sin valor - asumir confirmado
          statusValues.add('(vacío - confirmado)');
          console.log(`✅ Procesando fila (status vacío): ${row.Cliente} - ${row.Proyecto}`);
        }

        const year = typeof row.Año === 'string' ? parseInt(row.Año) : Number(row.Año);
        const monthKey = monthKeyFromEs(row.Mes, year);
        const monthNum = parseInt(monthKey.split('-')[1]);

        // Parsear valores - usar nombres exactos de las columnas de la hoja (con corchetes)
        const revenueUsd = parseNumberRobust(row["Facturación [USD]"]); // Columna G
        const revenueArs = parseNumberRobust(row["Facturación [ARS]"]); // Columna I
        const costUsd = parseNumberRobust(row["Costos [USD]"]); // Columna H
        const costArs = parseNumberRobust(row["Costos [ARS]"]); // Columna K
        const quotation = parseNumberRobust(row["Cotización"]); // Columna F
        
        // Obtener FX del mes desde exchange_rates
        const fx = await getFXForMonth(year, monthNum);

        const record = {
          clientName: row.Cliente.trim(),
          projectName: row.Proyecto.trim(),
          projectType: row["Tipo de proyecto"]?.trim() || null,
          monthKey,
          year,
          revenueUsd: revenueUsd ? String(revenueUsd) : null,
          revenueArs: revenueArs ? String(revenueArs) : null,
          costUsd: costUsd ? String(costUsd) : null,
          costArs: costArs ? String(costArs) : null,
          quotation: quotation ? String(quotation) : null,
          fx: String(fx),
        };

        // Upsert (insert or update on conflict)
        await db
          .insert(financialSot)
          .values(record)
          .onConflictDoUpdate({
            target: [financialSot.clientName, financialSot.projectName, financialSot.monthKey],
            set: {
              projectType: sql`EXCLUDED.project_type`,
              revenueUsd: sql`EXCLUDED.revenue_usd`,
              revenueArs: sql`EXCLUDED.revenue_ars`,
              costUsd: sql`EXCLUDED.cost_usd`,
              costArs: sql`EXCLUDED.cost_ars`,
              quotation: sql`EXCLUDED.quotation`,
              fx: sql`EXCLUDED.fx`,
              updatedAt: sql`NOW()`,
            },
          });

        result.inserted++;
      } catch (error) {
        const errorMsg = `Error procesando ${row.Cliente} - ${row.Proyecto}: ${error instanceof Error ? error.message : String(error)}`;
        result.errors.push(errorMsg);
        console.error(`❌ ${errorMsg}`);
      }
    }

    console.log(`✅ Importación completada: ${result.inserted} registros insertados/actualizados`);
    console.log(`🔍 Filas filtradas (no "Real"): ${skippedNotReal}`);
    console.log(`📋 Valores únicos encontrados en "Pasado/Futuro": ${Array.from(statusValues).join(', ')}`);
    
    if (result.errors.length > 0) {
      console.warn(`⚠️ Errores encontrados: ${result.errors.length}`);
    }

  } catch (error) {
    const errorMsg = `Error general en importación: ${error instanceof Error ? error.message : String(error)}`;
    result.errors.push(errorMsg);
    console.error(`❌ ${errorMsg}`);
  }

  return result;
}
