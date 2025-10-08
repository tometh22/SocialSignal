/**
 * 📊 ETL from "Rendimiento Cliente" - Financial Source of Truth
 * Fuente unificada de ingresos y costos por proyecto
 */

import { google } from 'googleapis';
import fs from 'fs';
import { db } from '../db';
import { financialSot } from '../../shared/schema';
import { sql } from 'drizzle-orm';

interface RendimientoClienteRow {
  Cliente?: string;
  "Tipo de proyecto"?: string;
  Proyecto?: string;
  Mes?: string;
  Año?: string | number;
  Cotización?: string | number;
  "Facturación (USD)"?: string | number;
  "Costos (USD)"?: string | number;
}

export interface ImportRendimientoClienteResult {
  inserted: number;
  updated: number;
  errors: string[];
}

/**
 * Parsear dinero robusto (soporta puntos de miles, comas decimales)
 */
function parseMoneyRobust(value: string | number | undefined | null): number | null {
  if (!value) return null;
  
  const str = String(value)
    .replace(/[^\d.,-]/g, '') // quitar símbolos
    .replace(/\./g, '')       // eliminar puntos de miles
    .replace(/,/g, '.');      // normalizar coma decimal a punto
  
  const parsed = parseFloat(str);
  return isNaN(parsed) ? null : parsed;
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
 * Crear cliente Google Sheets
 */
async function createSheetsClient() {
  const jsonFiles = [
    'attached_assets/focal-utility-318020-e2defb839c83_1754064776295.json',
    'focal-utility-318020-e2defb839c83.json'
  ];

  let credentialsPath = '';
  for (const filePath of jsonFiles) {
    if (fs.existsSync(filePath)) {
      credentialsPath = filePath;
      break;
    }
  }

  if (!credentialsPath) {
    throw new Error('No se encontró el archivo de credenciales JSON');
  }

  const credentials = JSON.parse(fs.readFileSync(credentialsPath, 'utf-8'));
  const auth = new google.auth.JWT(
    credentials.client_email,
    undefined,
    credentials.private_key,
    ['https://www.googleapis.com/auth/spreadsheets.readonly']
  );

  return google.sheets({ version: 'v4', auth });
}

/**
 * Leer pestaña "Rendimiento Cliente" del Excel MAESTRO
 */
async function readRendimientoCliente(): Promise<any[]> {
  const sheets = await createSheetsClient();
  const spreadsheetId = '1FZLFmTQQOSYQns2cOYlM86UGEH7EHZsJOFegyDR7quc';
  const sheetName = 'Rendimiento Cliente';
  const range = `${sheetName}!A:Z`;

  console.log(`📥 Leyendo "${sheetName}" desde Excel MAESTRO...`);

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
}

/**
 * Obtener FX del mes desde exchange_rates
 */
async function getFXForMonth(year: number, monthNum: number): Promise<number> {
  const result = await db.execute(sql`
    SELECT exchange_rate 
    FROM exchange_rates 
    WHERE year = ${year} AND month = ${monthNum}
    LIMIT 1
  `);
  
  if (result.rows && result.rows.length > 0) {
    return Number(result.rows[0].exchange_rate);
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

    // Procesar cada fila
    for (const row of rows as RendimientoClienteRow[]) {
      try {
        // Validar campos requeridos
        if (!row.Cliente || !row.Proyecto || !row.Mes || !row.Año) {
          continue; // Skip rows sin datos básicos
        }

        const year = typeof row.Año === 'string' ? parseInt(row.Año) : Number(row.Año);
        const monthKey = monthKeyFromEs(row.Mes, year);
        const monthNum = parseInt(monthKey.split('-')[1]);

        // Parsear valores
        const revenueUsd = parseMoneyRobust(row["Facturación (USD)"]) ?? 0;
        const costUsd = parseMoneyRobust(row["Costos (USD)"]) ?? 0;
        const fxSheet = parseMoneyRobust(row["Cotización"]);
        
        // Obtener FX del mes (preferir exchange_rates, fallback a Cotización)
        const fx = await getFXForMonth(year, monthNum) || fxSheet || 1345;

        const record = {
          clientName: row.Cliente.trim(),
          projectName: row.Proyecto.trim(),
          projectType: row["Tipo de proyecto"]?.trim() || null,
          monthKey,
          year,
          revenueUsd: String(revenueUsd),
          costUsd: String(costUsd),
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
              costUsd: sql`EXCLUDED.cost_usd`,
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
