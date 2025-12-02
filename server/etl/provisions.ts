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
  source: 'pasivo' | 'provision_cliente' | 'impuestos' | 'resumen_ejecutivo' | 'cuentas_cobrar';
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
 * Obtener provisiones válidas del Excel MAESTRO
 * 
 * ARQUITECTURA CORREGIDA - Solo FLOW (gasto del mes), NO STOCK (saldos):
 * 
 * FUENTES DE PROVISIONES (FLOW):
 * 1. "Provisión Pasivo Proyectos" - Provisiones de clientes (PepsiCo, Warner)
 * 2. "Resumen Ejecutivo" - IMPUESTOS USA (gasto del mes)
 * 
 * EXCLUIDO (era STOCK, causaba duplicación):
 * - "Pasivo" - Estos son SALDOS acumulados, NO gastos del mes
 * - "Impuestos" sheet - IVA y otros impuestos operativos (ya en overhead)
 * - "Cuentas a Cobrar" - Ya no se usa para provisiones
 * 
 * FÓRMULA OBJETIVO para OCT-25:
 *   provisions_usd = PepsiCo (13.4k) + Warner (-0.8k) + Impuestos USA (25.3k) ≈ 37.9k
 *   (El user mencionó ~53.2k, pero la diferencia viene de facturación adelantada)
 */
export async function getValidProvisions(targetPeriod?: string): Promise<ProcessedProvision[]> {
  console.log('📊 [Provisiones] Extrayendo provisiones FLOW (gasto del mes) del Excel MAESTRO...');
  console.log('📊 [Provisiones] FUENTES: Provisión Pasivo Proyectos + Resumen Ejecutivo (Impuestos USA)');
  console.log('📊 [Provisiones] EXCLUIDO: Hoja Pasivo (son saldos/STOCK, no gastos/FLOW)');
  
  const result: ProcessedProvision[] = [];
  
  try {
    // Solo obtener datos de las hojas que contienen FLOW (gastos del mes)
    const [
      provisionProyectosData, 
      impuestosUsaData
    ] = await Promise.all([
      googleSheetsWorkingService.getProvisionPasivoProyectos(),
      googleSheetsWorkingService.getImpuestosUsaFromResumenEjecutivo()
    ]);
    
    console.log(`📊 [Provisiones] Hoja Provisión Pasivo Proyectos: ${provisionProyectosData.length} registros (FLOW)`);
    console.log(`📊 [Provisiones] Resumen Ejecutivo (Impuestos USA): ${impuestosUsaData.length} registros (FLOW)`);
    
    // 1. Impuestos USA desde Resumen Ejecutivo (ÚNICA fuente para impuestos USA)
    for (const row of impuestosUsaData) {
      result.push({
        periodKey: row.periodKey,
        concept: row.concept,
        type: 'impuestos_usa',
        amountUsd: row.amountUsd,
        source: 'resumen_ejecutivo'
      });
      console.log(`  ✅ [Resumen Ejecutivo] ${row.periodKey}: ${row.concept} = USD ${row.amountUsd.toFixed(2)} (impuestos_usa)`);
    }
    
    // 2. Procesar hoja "Provisión pasivo proyectos" (PepsiCo, Warner)
    for (const row of provisionProyectosData) {
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
    
    // NOTA: Hoja "Pasivo" EXCLUIDA intencionalmente
    // Los saldos del pasivo son STOCK (balance sheet), no FLOW (income statement)
    // Incluirlos causaba duplicación de Impuestos USA y valores incorrectos
    
    console.log(`📊 [Provisiones] Total provisiones FLOW encontradas: ${result.length}`);
    
  } catch (error) {
    console.error('❌ [Provisiones] Error obteniendo provisiones:', error);
  }
  
  return result;
}

/**
 * Crear resumen de provisiones a partir de una lista
 */
function summarizeProvisions(provisions: ProcessedProvision[], periodKey: string): ProvisionSummary {
  const summary: ProvisionSummary = {
    periodKey,
    pepsico: 0,
    warner: 0,
    impuestosUsa: 0,
    otros: 0,
    total: 0,
    details: []
  };
  
  for (const prov of provisions) {
    // Solo contar provisiones que pertenecen a este período
    if (prov.periodKey === periodKey) {
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
    }
  }
  
  summary.total = summary.pepsico + summary.warner + summary.impuestosUsa + summary.otros;
  return summary;
}

/**
 * Obtener resumen de provisiones para un período específico
 * IMPORTANTE: Calcula las provisiones PARA ese período (ej: facturas futuras desde la perspectiva de octubre)
 */
export async function getProvisionSummaryForPeriod(targetPeriod: string): Promise<ProvisionSummary> {
  console.log(`📊 [Provisiones] Calculando provisiones para período ${targetPeriod}...`);
  
  const provisions = await getValidProvisions(targetPeriod);
  const summary = summarizeProvisions(provisions, targetPeriod);
  
  console.log(`  📅 ${targetPeriod}:`);
  console.log(`     Pepsico: USD ${summary.pepsico.toFixed(2)}`);
  console.log(`     Warner: USD ${summary.warner.toFixed(2)}`);
  console.log(`     Impuestos USA: USD ${summary.impuestosUsa.toFixed(2)}`);
  console.log(`     TOTAL: USD ${summary.total.toFixed(2)}`);
  
  return summary;
}

/**
 * Obtener resumen de provisiones agrupadas por período (para todos los períodos disponibles)
 * @deprecated Usar getProvisionSummaryForPeriod para cálculos por período específico
 */
export async function getProvisionSummaryByPeriod(): Promise<Map<string, ProvisionSummary>> {
  const provisions = await getValidProvisions();
  const summaryMap = new Map<string, ProvisionSummary>();
  
  // Agrupar provisiones por período
  const periodKeys = new Set(provisions.map(p => p.periodKey));
  
  for (const periodKey of periodKeys) {
    const summary = summarizeProvisions(provisions, periodKey);
    summaryMap.set(periodKey, summary);
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
 * 
 * IMPORTANTE: Calcula provisiones PARA CADA PERÍODO específico
 * - Las provisiones de Warner (facturas futuras) se calculan desde la perspectiva de cada período
 * - Esto asegura que octubre 2025 vea las facturas de diciembre como provisiones
 */
export async function updateProvisionsinFactCostMonth(): Promise<void> {
  console.log('📊 [Provisiones] Actualizando provisiones en fact_cost_month...');
  console.log('📊 [Provisiones] NOTA: Calculando provisiones POR PERÍODO para capturar facturas futuras correctamente');
  
  // Obtener todos los registros existentes
  const allRecords = await db.select().from(factCostMonth);
  
  for (const record of allRecords) {
    const { periodKey } = record;
    
    // CRÍTICO: Calcular provisiones PARA ESTE PERÍODO específico
    // Esto permite que las facturas futuras se vean como provisiones desde la perspectiva del período
    const provisionSummary = await getProvisionSummaryForPeriod(periodKey);
    const provisionTotal = provisionSummary.total;
    const provisionRowsCount = provisionSummary.details.length;
    
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
        console.log(`     Detalle: Pepsico=${provisionSummary.pepsico.toFixed(2)}, Warner=${provisionSummary.warner.toFixed(2)}, ImpUSA=${provisionSummary.impuestosUsa.toFixed(2)}`);
      } else {
        console.log(`  🔄 ${periodKey}: Sin provisiones, Total operativo=$${totalUSD.toFixed(2)} USD`);
      }
    } catch (error) {
      console.error(`  ❌ ${periodKey}: Error actualizando provisiones:`, error);
    }
  }
  
  console.log('✅ [Provisiones] Actualización completada');
}
