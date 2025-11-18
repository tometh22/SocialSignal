/**
 * Script temporal para validar valores patrón oro en Excel MAESTRO
 * Paso 1 del checklist: Obtener totales de costos directos e indirectos por mes
 */

import { google } from 'googleapis';
import fs from 'fs';

const SPREADSHEET_ID = '1FZLFmTQQOSYQns2cOYlM86UGEH7EHZsJOFegyDR7quc';
const SHEET_NAME = 'Costos directos e indirectos';

async function validateExcelCosts() {
  try {
    // Crear cliente de Google Sheets
    const credentialsPath = 'attached_assets/focal-utility-318020-e2defb839c83_1754064776295.json';
    
    if (!fs.existsSync(credentialsPath)) {
      throw new Error('Archivo de credenciales no encontrado');
    }
    
    const credentialsJson = JSON.parse(fs.readFileSync(credentialsPath, 'utf8'));
    const auth = new google.auth.GoogleAuth({
      credentials: credentialsJson,
      scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly']
    });
    
    const sheets = google.sheets({ version: 'v4', auth });
    
    // Leer datos del Excel (rango completo)
    console.log(`📊 Leyendo ${SHEET_NAME} desde Excel MAESTRO...`);
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `${SHEET_NAME}!A:R`,
      valueRenderOption: 'UNFORMATTED_VALUE'
    });
    
    const rows = response.data.values || [];
    console.log(`📊 Total de filas en Excel: ${rows.length}`);
    
    // El Excel NO tiene header row - row 0 es data real
    // Columnas según COSTO_COLUMN_LAYOUT:
    // 0: Persona, 2: Mes, 3: Año, 4: Tipo de Costo, 10: Cliente, 17: Monto Total USD
    
    const results: Record<string, { directos: number; indirectos: number; rows_directos: number; rows_indirectos: number }> = {};
    
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      
      // Validar que sea una fila válida
      if (!row || row.length < 18) continue;
      
      const año = Number(row[3]);
      const mes = String(row[2] || '').trim();
      const tipoCosto = String(row[4] || '').trim().toLowerCase();
      const montoUSD = Number(row[17]) || 0;
      
      // Solo procesar año 2025
      if (año !== 2025) continue;
      
      // Normalizar mes a formato "YYYY-MM"
      const mesNum = mes.toLowerCase();
      let monthKey = '';
      
      const monthMap: Record<string, string> = {
        '01 ene': '01', '02 feb': '02', '03 mar': '03', '04 abr': '04',
        '05 may': '05', '06 jun': '06', '07 jul': '07', '08 ago': '08',
        '09 sep': '09', '10 oct': '10', '11 nov': '11', '12 dic': '12'
      };
      
      for (const [key, value] of Object.entries(monthMap)) {
        if (mesNum.includes(key)) {
          monthKey = `${año}-${value}`;
          break;
        }
      }
      
      if (!monthKey) continue;
      
      // Inicializar período si no existe
      if (!results[monthKey]) {
        results[monthKey] = { directos: 0, indirectos: 0, rows_directos: 0, rows_indirectos: 0 };
      }
      
      // Clasificar según tipo de costo
      if (tipoCosto === 'directo' || tipoCosto === 'costos directos e indirectos') {
        results[monthKey].directos += montoUSD;
        results[monthKey].rows_directos++;
      } else if (tipoCosto === 'indirecto') {
        results[monthKey].indirectos += montoUSD;
        results[monthKey].rows_indirectos++;
      }
    }
    
    // Mostrar resultados
    console.log('\n📈 VALORES PATRÓN ORO - EXCEL MAESTRO');
    console.log('=====================================\n');
    
    const testMonths = ['2025-05', '2025-08', '2025-09', '2025-10'];
    
    for (const month of testMonths) {
      const data = results[month];
      if (data) {
        console.log(`${month}:`);
        console.log(`  ├─ Directos:   $${data.directos.toFixed(2).padStart(12)} USD (${data.rows_directos} filas)`);
        console.log(`  ├─ Indirectos: $${data.indirectos.toFixed(2).padStart(12)} USD (${data.rows_indirectos} filas)`);
        console.log(`  └─ TOTAL:      $${(data.directos + data.indirectos).toFixed(2).padStart(12)} USD`);
        console.log('');
      } else {
        console.log(`${month}: Sin datos\n`);
      }
    }
    
    // Resumen de todos los meses con datos
    console.log('\n📊 RESUMEN COMPLETO - TODOS LOS MESES 2025');
    console.log('===========================================\n');
    
    const sortedMonths = Object.keys(results).sort();
    for (const month of sortedMonths) {
      const data = results[month];
      console.log(`${month}: D=$${data.directos.toFixed(2)}, I=$${data.indirectos.toFixed(2)}, T=$${(data.directos + data.indirectos).toFixed(2)}`);
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

validateExcelCosts();
