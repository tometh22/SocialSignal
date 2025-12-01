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
// Incluye variantes con y sin "PROVISIÓN" prefijo porque la hoja "Provisión Pasivo Proyectos"
// usa nombres simples de cliente (ej: "PepsiCo") mientras que la hoja "Pasivo" puede usar
// nombres completos (ej: "PROVISIÓN PEPSICO")
const VALID_PROVISION_NAMES = [
  // Nombres con prefijo "PROVISIÓN"
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
  // Nombres simples (sin prefijo) - usados en hoja "Provisión Pasivo Proyectos"
  'pepsico',
  'warner',
  'impuestos usa',
  'impuesto usa',
  'tax usa',
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
  
  // Debug: mostrar la comparación
  console.log(`    🔎 isValidProvision: "${concept}" → normalized: "${normalized}"`);
  
  const isValid = VALID_PROVISION_NAMES.some(valid => {
    const normalizedValid = normalizeText(valid);
    const exactMatch = normalized === normalizedValid;
    const containsMatch = normalized.includes(normalizedValid);
    
    if (exactMatch || containsMatch) {
      console.log(`    ✅ Match found: "${normalized}" ${exactMatch ? '==' : 'includes'} "${normalizedValid}"`);
      return true;
    }
    return false;
  });
  
  if (!isValid) {
    console.log(`    ❌ No match for: "${normalized}" in VALID_PROVISION_NAMES`);
  }
  
  return isValid;
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
  source: 'pasivo' | 'provision_cliente' | 'impuestos';
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
    // Obtener datos de las hojas relevantes (incluye "Impuestos" para Impuestos USA)
    const [pasivoData, provisionProyectosData, impuestosData] = await Promise.all([
      googleSheetsWorkingService.getPasivo(),
      googleSheetsWorkingService.getProvisionPasivoProyectos(),
      googleSheetsWorkingService.getImpuestos()
    ]);
    
    console.log(`📊 [Provisiones] Hoja Pasivo: ${pasivoData.length} registros`);
    console.log(`📊 [Provisiones] Hoja Provisión Pasivo Proyectos: ${provisionProyectosData.length} registros`);
    console.log(`📊 [Provisiones] Hoja Impuestos: ${impuestosData.length} registros`);
    
    // Procesar hoja "Pasivo"
    for (const row of pasivoData) {
      console.log(`  🔍 [Pasivo] Concepto: "${row.concept}" | Período: ${row.periodKey} | Raw: "${row.rawValue}" | USD: ${row.amountUsd}`);
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
      // Debug: mostrar todos los conceptos leídos con rawValue para debugging
      console.log(`  🔍 [Provisión Proyectos] Concepto: "${row.concept}" | Período: ${row.periodKey} | Raw: "${row.rawValue}" | USD: ${row.amountUsd}`);
      
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
      } else {
        console.log(`  ⚠️ [Provisión Proyectos] Concepto no válido: "${row.concept}"`);
      }
    }
    
    // Procesar hoja "Impuestos" - buscar específicamente "Impuestos USA"
    for (const row of impuestosData) {
      console.log(`  🔍 [Impuestos] Concepto: "${row.concept}" | Período: ${row.periodKey} | Raw: "${row.rawValue}" | USD: ${row.amountUsd}`);
      
      if (isValidProvision(row.concept)) {
        const type = detectProvisionType(row.concept);
        result.push({
          periodKey: row.periodKey,
          concept: row.concept,
          type,
          amountUsd: row.amountUsd,
          source: 'impuestos'
        });
        console.log(`  ✅ [Impuestos] ${row.periodKey}: ${row.concept} = USD ${row.amountUsd.toFixed(2)} (${type})`);
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
 * Y RECALCULA amountUSD/amountARS para incluir las provisiones en los totales financieros
 */
export async function updateProvisionsinFactCostMonth(): Promise<void> {
  console.log('📊 [Provisiones] Actualizando provisiones en fact_cost_month...');
  
  const summaryMap = await getProvisionSummaryByPeriod();
  
  // Obtener todos los registros existentes
  const allRecords = await db.select().from(factCostMonth);
  
  for (const record of allRecords) {
    const { periodKey } = record;
    const provisionSummary = summaryMap.get(periodKey);
    const provisionTotal = provisionSummary?.total || 0;
    const provisionRowsCount = provisionSummary?.details.length || 0;
    
    // Calcular totales: directos + indirectos + provisiones
    const directUSD = parseFloat(record.directUSD || '0');
    const indirectUSD = parseFloat(record.indirectUSD || '0');
    const directARS = parseFloat(record.directARS || '0');
    const indirectARS = parseFloat(record.indirectARS || '0');
    
    // amountUSD/ARS = operativo + provisiones (para vista Financiera)
    const totalUSD = directUSD + indirectUSD + provisionTotal;
    const totalARS = directARS + indirectARS; // Provisiones ya están en USD
    
    try {
      await db
        .update(factCostMonth)
        .set({
          provisionsUSD: provisionTotal.toFixed(2),
          provisionsARS: '0', // Las provisiones ya están en USD
          provisionsRowsCount: provisionRowsCount,
          amountUSD: totalUSD.toFixed(2), // Recalcular total incluyendo provisiones
          amountARS: totalARS.toFixed(2)
        })
        .where(eq(factCostMonth.periodKey, periodKey));
      
      if (provisionTotal > 0) {
        console.log(`  ✅ ${periodKey}: Provisiones=$${provisionTotal.toFixed(2)}, Total=$${totalUSD.toFixed(2)} USD`);
      } else {
        console.log(`  🔄 ${periodKey}: Sin provisiones, Total operativo=$${totalUSD.toFixed(2)} USD`);
      }
    } catch (error) {
      console.error(`  ❌ ${periodKey}: Error actualizando provisiones:`, error);
    }
  }
  
  console.log('✅ [Provisiones] Actualización completada');
}
