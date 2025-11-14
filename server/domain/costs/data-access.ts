/**
 * 🚀 COSTS DATA ACCESS - LECTURA STAGING/DB/SHEETS + CACHING
 * 
 * Acceso a datos para costos con múltiples fuentes:
 * - Google Sheets ("Costos directos e indirectos")
 * - Database staging table
 * - Cache en memoria para performance
 */

import type { RawCostRecord, ParsedCostRecord } from './types';
import { parseCostRecords } from './parser';

// Reutilizar infraestructura de income
import { storage } from '../../storage';
import { directCosts } from '@shared/schema';

// ==================== CACHE MANAGEMENT ====================

interface CostDataCache {
  lastUpdated: Date;
  rawRecords: RawCostRecord[];
  parsedRecords: ParsedCostRecord[];
}

const costCache = new Map<string, CostDataCache>();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

function getCacheKey(source: string): string {
  return `costs-${source}`;
}

function isCacheValid(cache: CostDataCache): boolean {
  const now = new Date();
  const age = now.getTime() - cache.lastUpdated.getTime();
  return age < CACHE_TTL_MS;
}

function invalidateCache(source?: string): void {
  if (source) {
    const key = getCacheKey(source);
    costCache.delete(key);
    console.log(`🗑️ COSTS: Cache invalidated for source "${source}"`);
  } else {
    costCache.clear();
    console.log('🗑️ COSTS: All cache invalidated');
  }
}

// ==================== GOOGLE SHEETS ACCESS ====================

async function fetchCostsFromSheets(): Promise<RawCostRecord[]> {
  console.log('🔍 COSTS: Fetching from Google Sheets...');
  
  try {
    // 🔧 CORRECCIÓN CRÍTICA: Usar servicio para "Costos directos e indirectos", NO "Ventas Tomi"
    // 🚨 FALLBACK TEMPORAL: Usar storage.getAllDirectCosts() mientras se resuelve Google Sheets auth
    console.log('🔄 COSTS: Using storage fallback due to Google Sheets auth issue');
    const sheetData = await storage.getAllDirectCosts();
    
    if (!sheetData || !Array.isArray(sheetData)) {
      console.warn('⚠️ COSTS: No data from storage fallback');
      return [];
    }
    
    console.log(`✅ COSTS: Retrieved ${sheetData.length} rows from storage fallback`);
    
    // 🔍 DEBUG: Log first record to see exact structure
    if (sheetData.length > 0) {
      console.log(`🔍 COSTS DEBUG: First record keys:`, Object.keys(sheetData[0]));
      console.log(`🔍 COSTS DEBUG: First record sample:`, sheetData[0]);
    }
    
    return sheetData as RawCostRecord[];
    
  } catch (error) {
    console.error('❌ COSTS: Error fetching from fallback storage:', error);
    return [];
  }
}

// ==================== DATABASE STAGING ACCESS ====================

async function fetchCostsFromDatabase(): Promise<RawCostRecord[]> {
  console.log('🔍 COSTS: Fetching from database...');
  
  try {
    const dbCosts = await storage.db.select().from(directCosts);
    
    if (!dbCosts || dbCosts.length === 0) {
      console.log('📝 COSTS: No records found in direct_costs table');
      return [];
    }
    
    console.log(`✅ COSTS: Retrieved ${dbCosts.length} rows from direct_costs table`);
    
    // Convert DB schema to RawCostRecord format
    const rawRecords: RawCostRecord[] = dbCosts.map(row => ({
      persona: row.persona || '',
      mes: row.mes || '',
      'año': row.año || 0,
      'tipo_gasto': row.tipoGasto || 'Directo',
      'especificacion': row.especificacion || '',
      proyecto: row.proyecto || '',
      'tipo_proyecto': row.tipoProyecto || '',
      cliente: row.cliente || '',
      'horas_reales_asana': row.horasRealesAsana?.toString() || '0',
      'valor_hora_persona': row.valorHoraPersona?.toString() || '0',
      'costo_total': row.costoTotal?.toString() || '0',
      'monto_total_usd': row.montoTotalUsd?.toString() || '',
      'tipo_cambio': row.tipoCambio?.toString() || '',
      'cantidad_de_horas_asana': row.horasRealesAsana?.toString() || '0'
    }));
    
    console.log(`🔄 COSTS: Converted ${rawRecords.length} DB rows to RawCostRecord format`);
    
    return rawRecords;
    
  } catch (error) {
    console.error('❌ COSTS: Error fetching from database:', error);
    return [];
  }
}

// ==================== UNIFIED DATA ACCESS ====================

export async function getCostData(source: 'sheets' | 'database' | 'auto' | 'fresh' = 'auto'): Promise<ParsedCostRecord[]> {
  console.log(`🚀 COSTS DATA ACCESS: Fetching from source "${source}"`);
  
  // 🚨 FORCE CACHE CLEAR: Clear all cache to test new parser
  console.log('🗑️ COSTS DEBUG: Forcibly clearing ALL cache to test new parser');
  costCache.clear();
  
  // 🗑️ FRESH: Invalidate cache if fresh requested
  if (source === 'fresh') {
    invalidateCache();
    source = 'auto'; // Continue with auto logic
  }
  
  const cacheKey = getCacheKey(source);
  const cached = costCache.get(cacheKey);
  
  // Check cache first (unless fresh was requested)
  if (cached && isCacheValid(cached)) {
    console.log(`✅ COSTS: Using cached data (${cached.parsedRecords.length} records)`);
    return cached.parsedRecords;
  }
  
  // Fetch fresh data
  let rawRecords: RawCostRecord[] = [];
  
  switch (source) {
    case 'sheets':
      rawRecords = await fetchCostsFromSheets();
      break;
      
    case 'database':
      rawRecords = await fetchCostsFromDatabase();
      break;
      
    case 'auto':
      // Merge sheets and database records
      const sheetsRecords = await fetchCostsFromSheets();
      const dbRecords = await fetchCostsFromDatabase();
      
      console.log(`🔀 COSTS: Merging ${sheetsRecords.length} sheets + ${dbRecords.length} DB records`);
      
      // Create unique key for deduplication
      const seen = new Set<string>();
      rawRecords = [];
      
      // Add sheets records first (priority)
      for (const record of sheetsRecords) {
        const key = `${record.persona}_${record.cliente}_${record.proyecto}_${record.mes}_${record['año']}`.toLowerCase();
        seen.add(key);
        rawRecords.push(record);
      }
      
      // Add DB records that aren't already in sheets
      for (const record of dbRecords) {
        const key = `${record.persona}_${record.cliente}_${record.proyecto}_${record.mes}_${record['año']}`.toLowerCase();
        if (!seen.has(key)) {
          rawRecords.push(record);
        }
      }
      
      console.log(`✅ COSTS: Merged result has ${rawRecords.length} total records (${rawRecords.length - sheetsRecords.length} unique from DB)`);
      break;
  }
  
  // Parse the raw records
  const parsedRecords = parseCostRecords(rawRecords);
  
  // Update cache
  const cacheData: CostDataCache = {
    lastUpdated: new Date(),
    rawRecords,
    parsedRecords
  };
  
  costCache.set(cacheKey, cacheData);
  
  console.log(`✅ COSTS DATA ACCESS: Retrieved and cached ${parsedRecords.length} parsed records`);
  
  return parsedRecords;
}

// ==================== PROJECT-SPECIFIC ACCESS ====================

export async function getCostDataForProject(
  clientName: string, 
  projectName: string
): Promise<ParsedCostRecord[]> {
  
  console.log(`🔍 COSTS: Fetching for project "${clientName}" - "${projectName}"`);
  
  const allRecords = await getCostData();
  
  const projectRecords = allRecords.filter(record => 
    record.clientName.toLowerCase() === clientName.toLowerCase() &&
    record.projectName.toLowerCase() === projectName.toLowerCase()
  );
  
  console.log(`✅ COSTS: Found ${projectRecords.length} records for project`);
  
  return projectRecords;
}

// ==================== PERIOD-SPECIFIC ACCESS ====================

export async function getCostDataForPeriod(period: string): Promise<ParsedCostRecord[]> {
  console.log(`🔍 COSTS: Fetching for period "${period}"`);
  
  const allRecords = await getCostData();
  
  const periodRecords = allRecords.filter(record => record.period === period);
  
  console.log(`✅ COSTS: Found ${periodRecords.length} records for period`);
  
  return periodRecords;
}

// ==================== CACHE MANAGEMENT ====================

export function clearCostCache(): void {
  console.log('🔄 COSTS: Clearing cache');
  costCache.clear();
}

export function getCostCacheStats(): Record<string, any> {
  const stats: Record<string, any> = {};
  
  for (const [key, cache] of costCache.entries()) {
    stats[key] = {
      lastUpdated: cache.lastUpdated.toISOString(),
      recordCount: cache.parsedRecords.length,
      isValid: isCacheValid(cache)
    };
  }
  
  return stats;
}

// ==================== STAGING TABLE INTEGRATION ====================

export async function syncCostsToStaging(records: RawCostRecord[]): Promise<void> {
  console.log(`🔄 COSTS: Syncing ${records.length} records to staging table`);
  
  try {
    // Placeholder for future staging table implementation
    console.log('📝 COSTS: Staging table sync not yet implemented');
    
    // Clear cache to force refresh
    clearCostCache();
    
  } catch (error) {
    console.error('❌ COSTS: Error syncing to staging:', error);
    throw error;
  }
}

// ==================== DEBUGGING UTILITIES ====================

export async function debugCostData(): Promise<void> {
  console.log('🔍 COSTS DEBUG: Starting data analysis...');
  
  const allRecords = await getCostData();
  
  console.log(`📊 COSTS DEBUG: Total records: ${allRecords.length}`);
  
  // Group by period
  const byPeriod = new Map<string, number>();
  for (const record of allRecords) {
    const count = byPeriod.get(record.period) || 0;
    byPeriod.set(record.period, count + 1);
  }
  
  console.log('📊 COSTS DEBUG: Records by period:', Object.fromEntries(byPeriod));
  
  // Group by client
  const byClient = new Map<string, number>();
  for (const record of allRecords) {
    const count = byClient.get(record.clientName) || 0;
    byClient.set(record.clientName, count + 1);
  }
  
  console.log('📊 COSTS DEBUG: Records by client:', Object.fromEntries(byClient));
  
  // Group by kind
  const byKind = new Map<string, number>();
  for (const record of allRecords) {
    const count = byKind.get(record.kind) || 0;
    byKind.set(record.kind, count + 1);
  }
  
  console.log('📊 COSTS DEBUG: Records by kind:', Object.fromEntries(byKind));
  
  console.log('✅ COSTS DEBUG: Analysis complete');
}