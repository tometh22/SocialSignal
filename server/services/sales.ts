/**
 * 💰 NORMALIZADOR ÚNICO DE VENTAS - Lógica robusta ARS/USD
 * Maneja anti-×100, conversión FX, y validación por fila
 */

import { monthKeyFromSpanish } from './dates';
import { fxForMonth } from './fx';

/**
 * Tipo de datos de venta cruda del Excel
 */
type RawSale = { 
  Cliente: string; 
  Proyecto: string; 
  Mes: string; 
  Año: number;
  Monto_ARS: number; 
  Monto_USD: number; 
  Confirmado: string; 
};

/**
 * Tipo de venta normalizada final
 */
export type NormalizedSale = {
  client: string;
  project: string;
  monthKey: string;
  currency: "ARS" | "USD";
  revenueUSD: number;
  originalAmount: number;
  fx?: number;
  antiX100Applied?: boolean;
};

/**
 * 🚀 NORMALIZADOR PRINCIPAL: Convierte ventas crudas a formato estándar
 * 
 * Reglas robustas por fila:
 * 1. Si Monto_USD > 0 ⇒ revenueUSD = Monto_USD (con anti-×100)
 * 2. Si Monto_USD == 0 y Monto_ARS > 0 ⇒ revenueUSD = Monto_ARS / fx(monthKey)
 * 3. Si ambos son 0 ⇒ descartar
 * 4. Sólo incluir si Confirmado == "Si"
 * 5. Anti-×100: si Monto_USD >= 100_000 && Monto_ARS == 0 y Monto_USD % 100 == 0
 */
export function normalizeSales(rows: RawSale[]): NormalizedSale[] {
  const out: NormalizedSale[] = [];
  
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    
    try {
      // Filtro 1: Solo registros confirmados
      if ((r.Confirmado || "").toLowerCase() !== "si") {
        continue;
      }
      
      // Generar monthKey robusto
      const monthKey = monthKeyFromSpanish(r.Mes, r.Año);
      
      // Parsear montos
      const usdRaw = Number(r.Monto_USD || 0) || 0;
      const arsRaw = Number(r.Monto_ARS || 0) || 0;
      
      let revenueUSD = 0;
      let currency: "ARS" | "USD" = "USD";
      let fx: number | undefined;
      let antiX100Applied = false;
      let originalAmount = 0;
      
      if (usdRaw > 0) {
        // CASO USD: Aplicar anti-×100 defensivo
        originalAmount = usdRaw;
        
        const shouldApplyAntiX100 = (
          usdRaw >= 100_000 && 
          arsRaw === 0 && 
          usdRaw % 100 === 0
        );
        
        if (shouldApplyAntiX100) {
          revenueUSD = usdRaw / 100;
          antiX100Applied = true;
          console.log(`🔧 NORMALIZADOR ANTI×100: ${usdRaw} → ${revenueUSD} (${r.Cliente}|${r.Proyecto}|${monthKey})`);
        } else {
          revenueUSD = usdRaw;
        }
        
        currency = "USD";
        
      } else if (arsRaw > 0) {
        // ✅ CASO ARS: RESPETAR MONEDA ORIGINAL - NO CONVERTIR
        originalAmount = arsRaw;
        revenueUSD = arsRaw; // Mantener valor en ARS, no convertir
        currency = "ARS";
        
        console.log(`💰 NORMALIZADOR ARS: Manteniendo ARS ${arsRaw} (${r.Cliente}|${r.Proyecto}|${monthKey})`);
        
      } else {
        // CASO VACÍO: Ambos montos son 0, descartar
        continue;
      }
      
      // Crear registro normalizado
      const normalized: NormalizedSale = {
        client: (r.Cliente || "").trim(),
        project: (r.Proyecto || "").trim(),
        monthKey,
        currency,
        revenueUSD: Number(revenueUSD.toFixed(2)),
        originalAmount,
        ...(fx && { fx }),
        ...(antiX100Applied && { antiX100Applied })
      };
      
      out.push(normalized);
      
    } catch (error: any) {
      console.error(`❌ NORMALIZADOR: Error procesando fila ${i + 1}: ${error.message}`, r);
    }
  }
  
  console.log(`✅ NORMALIZADOR: Procesadas ${rows.length} filas → ${out.length} ventas normalizadas`);
  return out;
}

/**
 * Obtiene estadísticas del proceso de normalización
 */
export function getNormalizationStats(normalized: NormalizedSale[]): {
  totalRecords: number;
  usdRecords: number;
  arsRecords: number;
  antiX100Applied: number;
  totalRevenueUSD: number;
  uniqueClients: number;
  uniqueProjects: number;
} {
  const stats = {
    totalRecords: normalized.length,
    usdRecords: normalized.filter(n => n.currency === "USD").length,
    arsRecords: normalized.filter(n => n.currency === "ARS").length,
    antiX100Applied: normalized.filter(n => n.antiX100Applied).length,
    totalRevenueUSD: normalized.reduce((sum, n) => sum + n.revenueUSD, 0),
    uniqueClients: new Set(normalized.map(n => n.client)).size,
    uniqueProjects: new Set(normalized.map(n => n.project)).size
  };
  
  return stats;
}

/**
 * Valida que un registro de venta esté bien formado
 */
export function validateNormalizedSale(sale: NormalizedSale): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  if (!sale.client?.trim()) {
    errors.push("Client es requerido");
  }
  
  if (!sale.project?.trim()) {
    errors.push("Project es requerido");
  }
  
  if (!sale.monthKey?.match(/^\d{4}-\d{2}$/)) {
    errors.push("MonthKey debe tener formato YYYY-MM");
  }
  
  if (!["ARS", "USD"].includes(sale.currency)) {
    errors.push("Currency debe ser ARS o USD");
  }
  
  if (sale.revenueUSD <= 0) {
    errors.push("RevenueUSD debe ser positivo");
  }
  
  if (sale.currency === "ARS" && !sale.fx) {
    errors.push("Registros ARS deben incluir FX rate");
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Filtra ventas normalizadas por período
 */
export function filterSalesByPeriod(
  sales: NormalizedSale[], 
  startMonthKey: string, 
  endMonthKey: string
): NormalizedSale[] {
  return sales.filter(sale => 
    sale.monthKey >= startMonthKey && sale.monthKey <= endMonthKey
  );
}

/**
 * Agrupa ventas por cliente y proyecto
 */
export function groupSalesByProject(sales: NormalizedSale[]): Map<string, NormalizedSale[]> {
  const groups = new Map<string, NormalizedSale[]>();
  
  for (const sale of sales) {
    const key = `${sale.client}|${sale.project}`;
    
    if (!groups.has(key)) {
      groups.set(key, []);
    }
    
    groups.get(key)!.push(sale);
  }
  
  return groups;
}