/**
 * Script de verificación de regresión para rankings universales
 * Valida que los cálculos coincidan con fixtures esperados (±0.3 pts)
 */

import { resolveProject } from '../server/services/project-resolver.js';
import { 
  computeRankings, 
  filterByPeriod
} from '../shared/utils/rankings-universal.js';
import { adaptExcelToUniversal } from '../shared/utils/universal-adapter.js';
import { resolvePeriod } from '../shared/utils/project-config.js';
import fs from 'fs';
import path from 'path';

type ExpectedResult = {
  unificado: number;
  eficiencia: number;
  impacto: number;
};

async function loadRowsFromSheet(cfg: any) {
  // Importar servicio de sheets
  const { googleSheetsWorkingService } = await import('../server/services/googleSheetsWorking.js');
  const rawData = await googleSheetsWorkingService.getAllData(cfg.spreadsheetId, cfg.sheetName);
  
  // Convertir a formato universal
  const { adaptExcelToUniversal } = await import('../shared/utils/universal-adapter.js');
  return adaptExcelToUniversal(rawData, 'kimberly_huggies', '39');
}

async function verifyRankings(timeFilter: string, projectId: string = '39', tolerance: number = 0.3) {
  console.log(`\n🧪 Verificando regresión para ${timeFilter} (proyecto ${projectId})`);
  
  try {
    // 1. Resolver configuración
    const cfg = resolveProject({ projectId });
    console.log(`✅ Configuración resuelto para proyecto ${projectId}`);
    
    // 2. Resolver período temporal
    const period = resolvePeriod(timeFilter, 'kimberly_huggies');
    console.log(`✅ Período resuelto: ${period.start} → ${period.end}`);
    
    // 3. Cargar y filtrar datos
    const rows = await loadRowsFromSheet(cfg);
    const filtered = filterByPeriod(rows, period);
    console.log(`✅ Datos cargados: ${rows.length} → ${filtered.length} (filtrado)`);
    
    // 4. Calcular rankings
    const results = computeRankings(filtered);
    console.log(`✅ Rankings calculados: ${results.length} personas`);
    
    // 5. Cargar fixture esperado
    const fixturePath = path.join(process.cwd(), 'tests', 'fixtures', `expected-${timeFilter}.json`);
    if (!fs.existsSync(fixturePath)) {
      console.log(`⚠️ No hay fixture para ${timeFilter}, creando datos actuales...`);
      const currentData: Record<string, ExpectedResult> = {};
      for (const r of results) {
        currentData[r.person] = {
          unificado: Math.round(r.unificado * 100) / 100,
          eficiencia: Math.round(r.eficiencia * 100) / 100,
          impacto: Math.round(r.impacto * 100) / 100
        };
      }
      fs.writeFileSync(fixturePath, JSON.stringify(currentData, null, 2));
      console.log(`📝 Fixture creado en ${fixturePath}`);
      return;
    }
    
    const expected: Record<string, ExpectedResult> = JSON.parse(fs.readFileSync(fixturePath, 'utf8'));
    
    // 6. Validar cada persona
    let errors = 0;
    for (const [persona, exp] of Object.entries(expected)) {
      const actual = results.find(r => r.person === persona);
      if (!actual) {
        console.error(`❌ Falta persona: ${persona}`);
        errors++;
        continue;
      }
      
      for (const metric of ['unificado', 'eficiencia', 'impacto'] as const) {
        const actualValue = actual[metric];
        const expectedValue = exp[metric];
        const diff = Math.abs(actualValue - expectedValue);
        
        if (diff > tolerance) {
          console.error(`❌ ${persona}.${metric}: esperado ${expectedValue}, actual ${actualValue} (diff: ${diff.toFixed(3)})`);
          errors++;
        } else {
          console.log(`✅ ${persona}.${metric}: ${actualValue} ≈ ${expectedValue} (diff: ${diff.toFixed(3)})`);
        }
      }
    }
    
    // 7. Verificaciones adicionales
    const shareSum = filtered.reduce((sum, row) => {
      const { computeParticipacion } = require('../shared/utils/rankings-universal.js');
      const { share } = computeParticipacion([row]);
      const key = `${row.projectId}|${row.year}-${String(row.month).padStart(2,'0')}|${row.person}`;
      return sum + (share.get(key) || 0);
    }, 0);
    
    if (Math.abs(shareSum - 1.0) > 1e-3) {
      console.warn(`⚠️ Suma de participaciones ${shareSum.toFixed(6)}, esperado ~1.000000`);
    }
    
    if (errors === 0) {
      console.log(`\n🎉 REGRESIÓN OK para ${timeFilter}: ${Object.keys(expected).length} personas validadas`);
    } else {
      console.error(`\n💥 REGRESIÓN FALLÓ para ${timeFilter}: ${errors} errores`);
      process.exit(1);
    }
    
  } catch (error) {
    console.error(`💥 Error verificando ${timeFilter}:`, error);
    process.exit(1);
  }
}

// CLI runner
async function main() {
  const timeFilter = process.argv[2] || 'july_2025';
  const projectId = process.argv[3] || '39';
  
  console.log(`🚀 Verificador de regresión universal`);
  console.log(`   Período: ${timeFilter}`);
  console.log(`   Proyecto: ${projectId}`);
  console.log(`   Tolerancia: ±0.3 pts`);
  
  await verifyRankings(timeFilter, projectId);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}

export { verifyRankings };