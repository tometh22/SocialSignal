/**
 * 🔄 ETL Service - Idempotent data normalization from Excel MAESTRO
 * Transforms raw sheet data into normalized tables per source
 */

import { parseMonthKey, generateSourceRowId, normalizeProjectKey } from '../utils/date-parser';
import { detectAntiX100Generic, parseMoneyUnified } from '../utils/money';
import { getFxRate } from '../utils/fx';
import { salesNorm, costsNorm, targetsNorm, type InsertSalesNorm, type InsertCostsNorm, type InsertTargetsNorm } from '../../shared/schema';
import { eq, and } from 'drizzle-orm';

export class ETLService {
  private db: any;
  
  constructor(database: any) {
    this.db = database;
  }

  /**
   * 🔄 VENTAS ETL: "Ventas Tomi" → sales_norm
   * Procesa datos de ventas con detección de anomalías x100/x10000
   */
  async processVentasToNorm(ventasData: any[]): Promise<{ processed: number; errors: string[] }> {
    console.log('🔄 ETL VENTAS: Starting normalization process...');
    
    let processed = 0;
    const errors: string[] = [];
    
    for (let i = 0; i < ventasData.length; i++) {
      const row = ventasData[i];
      
      try {
        // Parse month key
        const monthKey = parseMonthKey(row.mes, row.año);
        if (!monthKey) {
          errors.push(`Row ${i}: Invalid date - mes=${row.mes}, año=${row.año}`);
          continue;
        }

        // Normalize project key
        const projectKey = normalizeProjectKey(row.cliente, row.proyecto);
        
        // Generate unique source row ID
        const sourceRowId = generateSourceRowId('ventas', Object.values(row), i);
        
        // Parse and normalize USD amount with anomaly detection
        const parsedUSD = parseMoneyUnified(row.montoUSD);
        const parsedARS = parseMoneyUnified(row.montoARS) || 0;
        const tipoCambio = getFxRate(monthKey);
        
        // Apply anti-x100 detection
        const antiX100Result = detectAntiX100Generic(parsedUSD, parsedARS, tipoCambio);
        const finalUSD = antiX100Result.correctedUSD;
        const anomaly = antiX100Result.anomaly || null;

        // Check if record already exists (idempotent)
        const existing = await this.db.select().from(salesNorm).where(eq(salesNorm.sourceRowId, sourceRowId)).limit(1);
        
        const normRecord: InsertSalesNorm = {
          projectKey,
          monthKey,
          usd: finalUSD.toString(),
          sourceRowId,
          anomaly
        };

        if (existing.length === 0) {
          // Insert new record
          await this.db.insert(salesNorm).values(normRecord);
          console.log(`✅ VENTAS: Inserted ${projectKey} ${monthKey} = $${finalUSD}${anomaly ? ` (${anomaly})` : ''}`);
        } else {
          // Update existing record  
          await this.db.update(salesNorm)
            .set({ ...normRecord, updatedAt: new Date() })
            .where(eq(salesNorm.sourceRowId, sourceRowId));
          console.log(`🔄 VENTAS: Updated ${projectKey} ${monthKey} = $${finalUSD}${anomaly ? ` (${anomaly})` : ''}`);
        }
        
        processed++;
        
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        errors.push(`Row ${i}: ${errorMessage}`);
        console.error(`❌ VENTAS ETL Error on row ${i}:`, error);
      }
    }
    
    console.log(`✅ VENTAS ETL: Processed ${processed} records, ${errors.length} errors`);
    return { processed, errors };
  }

  /**
   * 🔄 COSTOS ETL: "Costos directos e indirectos" → costs_norm  
   * Procesa datos de costos con horas trabajadas y detección de anomalías
   */
  async processCostosToNorm(costosData: any[]): Promise<{ processed: number; errors: string[] }> {
    console.log('🔄 ETL COSTOS: Starting normalization process...');
    
    let processed = 0;
    const errors: string[] = [];
    
    for (let i = 0; i < costosData.length; i++) {
      const row = costosData[i];
      
      try {
        // Parse month key
        const monthKey = parseMonthKey(row.mes, row.año);
        if (!monthKey) {
          errors.push(`Row ${i}: Invalid date - mes=${row.mes}, año=${row.año}`);
          continue;
        }

        // Normalize project key (may come from different fields)
        const projectKey = normalizeProjectKey(row.cliente || row.project, row.proyecto || row.description);
        
        // Generate unique source row ID
        const sourceRowId = generateSourceRowId('costos', Object.values(row), i);
        
        // Parse USD amount with anomaly detection
        const parsedUSD = parseMoneyUnified(row.costoUSD || row.montoUSD);
        const parsedARS = parseMoneyUnified(row.costoARS || row.montoARS) || 0;
        const tipoCambio = getFxRate(monthKey);
        
        // Apply anti-x100 detection
        const antiX100Result = detectAntiX100Generic(parsedUSD, parsedARS, tipoCambio);
        const finalUSD = antiX100Result.correctedUSD;
        const anomaly = antiX100Result.anomaly || null;

        // Parse hours worked
        const hoursWorked = parseMoneyUnified(row.horas || row.horasTrabajas || row.hours) || null;

        // Check if record already exists (idempotent)
        const existing = await this.db.select().from(costsNorm).where(eq(costsNorm.sourceRowId, sourceRowId)).limit(1);
        
        const normRecord: InsertCostsNorm = {
          projectKey,
          monthKey,
          usd: finalUSD.toString(),
          hoursWorked: hoursWorked ? hoursWorked.toString() : null,
          sourceRowId,
          anomaly
        };

        if (existing.length === 0) {
          // Insert new record
          await this.db.insert(costsNorm).values(normRecord);
          console.log(`✅ COSTOS: Inserted ${projectKey} ${monthKey} = $${finalUSD}${hoursWorked ? ` (${hoursWorked}h)` : ''}${anomaly ? ` (${anomaly})` : ''}`);
        } else {
          // Update existing record
          await this.db.update(costsNorm)
            .set({ ...normRecord, updatedAt: new Date() })
            .where(eq(costsNorm.sourceRowId, sourceRowId));
          console.log(`🔄 COSTOS: Updated ${projectKey} ${monthKey} = $${finalUSD}${hoursWorked ? ` (${hoursWorked}h)` : ''}${anomaly ? ` (${anomaly})` : ''}`);
        }
        
        processed++;
        
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        errors.push(`Row ${i}: ${errorMessage}`);
        console.error(`❌ COSTOS ETL Error on row ${i}:`, error);
      }
    }
    
    console.log(`✅ COSTOS ETL: Processed ${processed} records, ${errors.length} errors`);
    return { processed, errors };
  }

  /**
   * 🔄 TARGETS ETL: "Objetivos" → targets_norm (K/h data)
   * Procesa objetivos de horas por proyecto/mes
   */
  async processTargetsToNorm(targetsData: any[]): Promise<{ processed: number; errors: string[] }> {
    console.log('🔄 ETL TARGETS: Starting normalization process...');
    
    let processed = 0;
    const errors: string[] = [];
    
    for (let i = 0; i < targetsData.length; i++) {
      const row = targetsData[i];
      
      try {
        // Parse month key
        const monthKey = parseMonthKey(row.mes, row.año);
        if (!monthKey) {
          errors.push(`Row ${i}: Invalid date - mes=${row.mes}, año=${row.año}`);
          continue;
        }

        // Normalize project key
        const projectKey = normalizeProjectKey(row.cliente || row.project, row.proyecto || row.description);
        
        // Generate unique source row ID  
        const sourceRowId = generateSourceRowId('targets', Object.values(row), i);
        
        // Parse target hours
        const targetHours = parseMoneyUnified(row.horasObjetivo || row.targetHours || row.objetivo);
        if (!targetHours || targetHours <= 0) {
          errors.push(`Row ${i}: Invalid target hours - ${row.horasObjetivo || row.targetHours || row.objetivo}`);
          continue;
        }

        // Parse optional rate USD
        const rateUSD = parseMoneyUnified(row.tarifaUSD || row.rateUSD || row.tarifa) || null;

        // Check if record already exists (idempotent)
        const existing = await this.db.select().from(targetsNorm).where(eq(targetsNorm.sourceRowId, sourceRowId)).limit(1);
        
        const normRecord: InsertTargetsNorm = {
          projectKey,
          monthKey,
          targetHours: targetHours.toString(),
          rateUSD: rateUSD ? rateUSD.toString() : null,
          sourceRowId
        };

        if (existing.length === 0) {
          // Insert new record
          await this.db.insert(targetsNorm).values(normRecord);
          console.log(`✅ TARGETS: Inserted ${projectKey} ${monthKey} = ${targetHours}h${rateUSD ? ` @$${rateUSD}` : ''}`);
        } else {
          // Update existing record
          await this.db.update(targetsNorm)
            .set({ ...normRecord, updatedAt: new Date() })
            .where(eq(targetsNorm.sourceRowId, sourceRowId));
          console.log(`🔄 TARGETS: Updated ${projectKey} ${monthKey} = ${targetHours}h${rateUSD ? ` @$${rateUSD}` : ''}`);
        }
        
        processed++;
        
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        errors.push(`Row ${i}: ${errorMessage}`);
        console.error(`❌ TARGETS ETL Error on row ${i}:`, error);
      }
    }
    
    console.log(`✅ TARGETS ETL: Processed ${processed} records, ${errors.length} errors`);
    return { processed, errors };
  }

  /**
   * 🔄 FULL ETL: Process all sources in sequence
   * Orchestrates complete ETL pipeline with error handling
   */
  async runFullETL(googleSheetsService: any): Promise<{
    ventas: { processed: number; errors: string[] };
    costos: { processed: number; errors: string[] };
    targets: { processed: number; errors: string[] };
    success: boolean;
  }> {
    console.log('🚀 ETL FULL PIPELINE: Starting complete data normalization...');
    
    try {
      // 1. Process Ventas
      console.log('📊 Step 1: Processing Ventas...');
      const ventasData = await googleSheetsService.getVentasTomi();
      const ventasResult = await this.processVentasToNorm(ventasData);

      // 2. Process Costos
      console.log('📊 Step 2: Processing Costos...');
      const costosData = await googleSheetsService.getCostosDirectosIndirectos();
      const costosResult = await this.processCostosToNorm(costosData);

      // 3. Process Targets (if available)
      console.log('📊 Step 3: Processing Targets...');
      let targetsResult = { processed: 0, errors: ['Targets source not implemented yet'] };
      
      // TODO: Implement targets data source when available
      // const targetsData = await googleSheetsService.getObjetivos();
      // targetsResult = await this.processTargetsToNorm(targetsData);

      const totalProcessed = ventasResult.processed + costosResult.processed + targetsResult.processed;
      const totalErrors = ventasResult.errors.length + costosResult.errors.length + targetsResult.errors.length;
      
      console.log(`✅ ETL PIPELINE COMPLETE: ${totalProcessed} records processed, ${totalErrors} errors`);
      
      return {
        ventas: ventasResult,
        costos: costosResult,
        targets: targetsResult,
        success: totalErrors === 0
      };
      
    } catch (error) {
      console.error('❌ ETL PIPELINE FAILED:', error);
      throw error;
    }
  }

  /**
   * 🧹 CLEANUP: Remove orphaned records (soft delete approach)
   * Marks records as stale if they don't appear in latest ETL run
   */
  async cleanupStaleRecords(latestSourceRowIds: { ventas: string[]; costos: string[]; targets: string[] }): Promise<void> {
    console.log('🧹 ETL CLEANUP: Removing stale records...');
    
    // TODO: Implement cleanup logic if needed
    // Could mark records as 'stale' or delete records not in latest source IDs
    
    console.log('🧹 ETL CLEANUP: Complete (placeholder implementation)');
  }
}