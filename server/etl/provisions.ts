/**
 * MÓDULO DEDICADO DE PROVISIONES CONTABLES
 * 
 * Las provisiones contables SOLO se extraen de hojas específicas del Excel MAESTRO:
 * - "Pasivo" → PROVISIÓN PEPSICO, PROVISIÓN WARNER, PROVISIÓN IMPUESTOS USA
 * - "Provisión pasivo proyectos" → Provisiones adicionales de proyectos
 * 
 * IMPORTANTE: NO se usa detección por patrones de texto.
 * Solo se reconocen los nombres EXACTOS de provisiones válidas.
 */

import { googleSheetsWorkingService, ProvisionRow } from '../services/googleSheetsWorking';
import { db } from '../db';
import { factCostMonth } from '@shared/schema';
import { eq, and } from 'drizzle-orm';

// Lista EXACTA de provisiones válidas (normalizada a minúsculas sin acentos)
const VALID_PROVISION_NAMES = [
  'provision pepsico',
  'provisión pepsico',
  'provision warner',
  'provisión warner',
  'provision impuestos usa',
  'provisión impuestos usa',
  'provision impuesto usa',
  'provisión impuesto usa',
  'provision tax usa',
  'provisión tax usa',
];

// Normalizar texto para comparación
function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

// Verificar si un concepto es una provisión válida (SOLO nombres exactos)
export function isValidProvision(concept: string): boolean {
  const normalized = normalizeText(concept);
  return VALID_PROVISION_NAMES.some(valid => {
    const normalizedValid = normalizeText(valid);
    return normalized === normalizedValid || normalized.includes(normalizedValid);
  });
}

// Detectar el tipo de provisión
export function detectProvisionType(concept: string): 'pepsico' | 'warner' | 'impuestos_usa' | 'otros' {
  const normalized = normalizeText(concept);
  
  if (normalized.includes('pepsico')) return 'pepsico';
  if (normalized.includes('warner')) return 'warner';
  if (normalized.includes('impuesto') && normalized.includes('usa')) return 'impuestos_usa';
  if (normalized.includes('tax') && normalized.includes('usa')) return 'impuestos_usa';
  
  return 'otros';
}

// Interfaz para provisiones procesadas
export interface ProcessedProvision {
  periodKey: string;
  concept: string;
  type: 'pepsico' | 'warner' | 'impuestos_usa' | 'otros';
  amountUsd: number;
  source: 'pasivo' | 'provision_cliente';
}

// Estructura para resumen por período
export interface ProvisionSummary {
  periodKey: string;
  pepsico: number;
  warner: number;
  impuestosUsa: number;
  otros: number;
  total: number;
  details: ProcessedProvision[];
}

/**
 * Obtener provisiones válidas de las hojas del Excel MAESTRO
 * SOLO extrae: PROVISIÓN PEPSICO, PROVISIÓN WARNER, PROVISIÓN IMPUESTOS USA
 */
export async function getValidProvisions(): Promise<ProcessedProvision[]> {
  console.log('📊 [Provisiones] Extrayendo provisiones válidas del Excel MAESTRO...');
  
  const result: ProcessedProvision[] = [];
  
  try {
    // Obtener datos de las hojas relevantes
    const [pasivoData, provisionProyectosData] = await Promise.all([
      googleSheetsWorkingService.getPasivo(),
      googleSheetsWorkingService.getProvisionPasivoProyectos()
    ]);
    
    console.log(`📊 [Provisiones] Hoja Pasivo: ${pasivoData.length} registros`);
    console.log(`📊 [Provisiones] Hoja Provisión Pasivo Proyectos: ${provisionProyectosData.length} registros`);
    
    // Procesar hoja "Pasivo"
    for (const row of pasivoData) {
      if (isValidProvision(row.concept)) {
        const type = detectProvisionType(row.concept);
        result.push({
          periodKey: row.periodKey,
          concept: row.concept,
          type,
          amountUsd: row.amountUsd,
          source: 'pasivo'
        });
        console.log(`  ✅ [Pasivo] ${row.periodKey}: ${row.concept} = USD ${row.amountUsd.toFixed(2)} (${type})`);
      }
    }
    
    // Procesar hoja "Provisión pasivo proyectos"
    for (const row of provisionProyectosData) {
      if (isValidProvision(row.concept)) {
        const type = detectProvisionType(row.concept);
        result.push({
          periodKey: row.periodKey,
          concept: row.concept,
          type,
          amountUsd: row.amountUsd,
          source: 'provision_cliente'
        });
        console.log(`  ✅ [Provisión Proyectos] ${row.periodKey}: ${row.concept} = USD ${row.amountUsd.toFixed(2)} (${type})`);
      }
    }
    
    console.log(`📊 [Provisiones] Total provisiones válidas encontradas: ${result.length}`);
    
  } catch (error) {
    console.error('❌ [Provisiones] Error obteniendo provisiones:', error);
  }
  
  return result;
}

/**
 * Obtener resumen de provisiones agrupadas por período
 */
export async function getProvisionSummaryByPeriod(): Promise<Map<string, ProvisionSummary>> {
  const provisions = await getValidProvisions();
  const summaryMap = new Map<string, ProvisionSummary>();
  
  for (const prov of provisions) {
    if (!summaryMap.has(prov.periodKey)) {
      summaryMap.set(prov.periodKey, {
        periodKey: prov.periodKey,
        pepsico: 0,
        warner: 0,
        impuestosUsa: 0,
        otros: 0,
        total: 0,
        details: []
      });
    }
    
    const summary = summaryMap.get(prov.periodKey)!;
    summary.details.push(prov);
    
    switch (prov.type) {
      case 'pepsico':
        summary.pepsico += prov.amountUsd;
        break;
      case 'warner':
        summary.warner += prov.amountUsd;
        break;
      case 'impuestos_usa':
        summary.impuestosUsa += prov.amountUsd;
        break;
      default:
        summary.otros += prov.amountUsd;
    }
    
    summary.total = summary.pepsico + summary.warner + summary.impuestosUsa + summary.otros;
  }
  
  // Log resumen por período
  console.log('📊 [Provisiones] Resumen por período:');
  for (const [period, summary] of summaryMap) {
    console.log(`  📅 ${period}:`);
    console.log(`     Pepsico: USD ${summary.pepsico.toFixed(2)}`);
    console.log(`     Warner: USD ${summary.warner.toFixed(2)}`);
    console.log(`     Impuestos USA: USD ${summary.impuestosUsa.toFixed(2)}`);
    console.log(`     TOTAL: USD ${summary.total.toFixed(2)}`);
  }
  
  return summaryMap;
}

/**
 * Actualizar la tabla fact_cost_month con las provisiones correctas
 * REEMPLAZA los valores de provisiones existentes con los valores exactos
 */
export async function updateProvisionsinFactCostMonth(): Promise<void> {
  console.log('📊 [Provisiones] Actualizando provisiones en fact_cost_month...');
  
  const summaryMap = await getProvisionSummaryByPeriod();
  
  for (const [periodKey, summary] of summaryMap) {
    try {
      // Verificar si existe el registro para este período
      const existing = await db
        .select()
        .from(factCostMonth)
        .where(eq(factCostMonth.periodKey, periodKey))
        .limit(1);
      
      if (existing.length > 0) {
        // Actualizar provisiones
        await db
          .update(factCostMonth)
          .set({
            provisionsUSD: summary.total.toFixed(2),
            provisionsARS: '0', // Las provisiones ya están en USD
            provisionsRowsCount: summary.details.length
          })
          .where(eq(factCostMonth.periodKey, periodKey));
        
        console.log(`  ✅ ${periodKey}: Provisiones actualizadas a USD ${summary.total.toFixed(2)}`);
      } else {
        console.log(`  ⚠️ ${periodKey}: No existe registro en fact_cost_month, se creará en el próximo ETL`);
      }
    } catch (error) {
      console.error(`  ❌ ${periodKey}: Error actualizando provisiones:`, error);
    }
  }
  
  // Para períodos sin provisiones, establecer a 0
  try {
    const allPeriods = await db.select({ periodKey: factCostMonth.periodKey }).from(factCostMonth);
    
    for (const { periodKey } of allPeriods) {
      if (!summaryMap.has(periodKey)) {
        await db
          .update(factCostMonth)
          .set({
            provisionsUSD: '0',
            provisionsARS: '0',
            provisionsRowsCount: 0
          })
          .where(eq(factCostMonth.periodKey, periodKey));
        
        console.log(`  🔄 ${periodKey}: Sin provisiones, establecido a 0`);
      }
    }
  } catch (error) {
    console.error('❌ Error limpiando provisiones de períodos sin datos:', error);
  }
  
  console.log('✅ [Provisiones] Actualización completada');
}
