import { db } from "../db";
import { systemConfig, exchangeRateHistory } from "@shared/schema";
import { eq, desc } from "drizzle-orm";

/**
 * Servicio mejorado para manejo de tipos de cambio y conversiones
 * Implementa la lógica de una sola fuente de verdad en USD
 */
export class CurrencyService {
  
  /**
   * Obtiene el tipo de cambio actual desde la base de datos
   */
  async getCurrentRate(): Promise<number> {
    try {
      const exchangeRateConfig = await db.select()
        .from(systemConfig)
        .where(eq(systemConfig.configKey, 'usd_exchange_rate'))
        .limit(1);
      
      return exchangeRateConfig.length > 0 ? exchangeRateConfig[0].configValue : 1200;
    } catch (error) {
      console.error("Error fetching current exchange rate:", error);
      return 1200; // Fallback seguro
    }
  }

  /**
   * Obtiene tipo de cambio histórico para una fecha específica
   */
  async getHistoricalRate(date: Date): Promise<number> {
    try {
      const historicalRate = await db.select()
        .from(exchangeRateHistory)
        .where(eq(exchangeRateHistory.effectiveFrom, date))
        .orderBy(desc(exchangeRateHistory.effectiveFrom))
        .limit(1);
      
      if (historicalRate.length > 0) {
        return parseFloat(historicalRate[0].rate);
      }
      
      // Si no hay rate histórico, usar actual
      return await this.getCurrentRate();
    } catch (error) {
      console.error("Error fetching historical exchange rate:", error);
      return await this.getCurrentRate();
    }
  }

  /**
   * Guarda un nuevo tipo de cambio en el historial
   */
  async saveExchangeRateSnapshot(rate: number, userId?: number): Promise<void> {
    try {
      await db.insert(exchangeRateHistory).values({
        rate: rate.toString(),
        effectiveFrom: new Date(),
        createdBy: userId || null,
      });
    } catch (error) {
      console.error("Error saving exchange rate snapshot:", error);
      throw error;
    }
  }

  /**
   * Convierte cantidad USD a moneda de display preservando precisión
   */
  convertFromUSD(amountUSD: number, toCurrency: string, exchangeRate: number): number {
    if (toCurrency === 'USD') {
      return amountUSD;
    }
    
    // Para ARS, usar precisión de 4 decimales en cálculo interno
    return Math.round(amountUSD * exchangeRate * 10000) / 10000;
  }

  /**
   * Convierte cantidad de cualquier moneda a USD
   */
  convertToUSD(amount: number, fromCurrency: string, exchangeRate: number): number {
    if (fromCurrency === 'USD') {
      return amount;
    }
    
    // Convertir de ARS a USD con precisión
    return Math.round((amount / exchangeRate) * 10000) / 10000;
  }

  /**
   * Formatea moneda con prefijo correcto
   */
  formatCurrency(amount: number, currency: string): string {
    if (currency === 'USD') {
      return `USD ${amount.toLocaleString('en-US', { 
        minimumFractionDigits: 2, 
        maximumFractionDigits: 2 
      })}`;
    } else {
      return `ARS ${amount.toLocaleString('es-AR', { 
        minimumFractionDigits: 0, 
        maximumFractionDigits: 0 
      })}`;
    }
  }

  /**
   * Valida que los cálculos de cotización sean consistentes
   */
  validateQuotationCalculation(quotationData: {
    teamBaseCostUsd: number;
    complexityAdjustmentUsd: number;
    inflationAdjustmentUsd: number;
    platformCostUsd: number;
    marginAmountUsd: number;
    discountAmountUsd: number;
    finalTotalUsd: number;
  }): { isValid: boolean; error?: string } {
    
    const calculatedTotal = 
      quotationData.teamBaseCostUsd +
      quotationData.complexityAdjustmentUsd +
      quotationData.inflationAdjustmentUsd +
      quotationData.platformCostUsd +
      quotationData.marginAmountUsd -
      quotationData.discountAmountUsd;
    
    const tolerance = 0.01; // Tolerancia de 1 centavo
    
    if (Math.abs(calculatedTotal - quotationData.finalTotalUsd) > tolerance) {
      return {
        isValid: false,
        error: `Inconsistencia en cálculos: esperado ${calculatedTotal.toFixed(4)}, recibido ${quotationData.finalTotalUsd.toFixed(4)}`
      };
    }
    
    if (quotationData.discountAmountUsd > quotationData.finalTotalUsd) {
      return {
        isValid: false,
        error: 'El descuento no puede ser mayor al total'
      };
    }
    
    if (quotationData.finalTotalUsd <= 0) {
      return {
        isValid: false,
        error: 'El total final debe ser positivo'
      };
    }
    
    return { isValid: true };
  }

  /**
   * Prepara datos de cotización para guardar en base de datos
   * Convierte todos los valores a USD si no lo están ya
   */
  async prepareQuotationForStorage(quotationData: any, displayCurrency: string): Promise<any> {
    const currentRate = await this.getCurrentRate();
    
    // Si los datos vienen en display currency, convertir a USD
    const convertIfNeeded = (amount: number) => {
      return this.convertToUSD(amount, displayCurrency, currentRate);
    };

    return {
      ...quotationData,
      // Costos siempre guardados en USD
      baseCost: convertIfNeeded(quotationData.teamBaseCostUsd || quotationData.baseCost),
      complexityAdjustment: convertIfNeeded(quotationData.complexityAdjustmentUsd || quotationData.complexityAdjustment),
      markupAmount: convertIfNeeded(quotationData.marginAmountUsd || quotationData.markupAmount),
      totalAmount: convertIfNeeded(quotationData.finalTotalUsd || quotationData.totalAmount),
      platformCost: convertIfNeeded(quotationData.platformCostUsd || quotationData.platformCost || 0),
      
      // Metadatos de presentación
      quotationCurrency: displayCurrency,
      exchangeRateUsed: currentRate,
      
      // Status por defecto
      status: quotationData.status || 'draft'
    };
  }
}

// Instancia singleton del servicio
export const currencyService = new CurrencyService();