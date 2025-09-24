/**
 * 💰 NORMALIZADOR ÚNICO DE VENTAS - Lógica robusta ARS/USD
 * Maneja anti-×100, conversión FX, y validación por fila
 */

import { monthKeyFromSpanish } from './dates';
import { fxForMonth } from './fx';
import { getFxRate } from '../utils/fx';

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
 * 🔧 UTILIDADES PARA NUEVO NORMALIZADOR DUAL
 */

/**
 * Parseador de números en formato español: "3.718.825,50" → 3718825.50
 */
export function parseNumberEs(value: string | number): number {
  if (typeof value === 'number') return value;
  if (!value || typeof value !== 'string') return 0;
  
  // Remover espacios y convertir comas por puntos
  const clean = value.toString().trim()
    .replace(/\./g, '')  // Remover puntos (separadores de miles)
    .replace(/,/g, '.'); // Convertir comas a puntos decimales
  
  const parsed = parseFloat(clean);
  return isNaN(parsed) ? 0 : parsed;
}

/**
 * Convierte mes en español a número: "Agosto" → 8
 */
export function spanishMonthToNumber(monthEs: string): number {
  const months: Record<string, number> = {
    'enero': 1, 'febrero': 2, 'marzo': 3, 'abril': 4,
    'mayo': 5, 'junio': 6, 'julio': 7, 'agosto': 8,
    'septiembre': 9, 'octubre': 10, 'noviembre': 11, 'diciembre': 12
  };
  
  const normalized = monthEs.toLowerCase().trim();
  return months[normalized] || 1;
}

/**
 * 💰 NUEVO TIPO: Ingreso normalizado con moneda dual
 */
export type DualNormalizedIncome = {
  clientName: string;
  projectName: string;
  monthKey: string;
  saleType: string;
  displayCurrency: "ARS" | "USD";
  revenueDisplay: number;        // Valor en moneda original
  revenueUSDNormalized: number;  // Valor normalizado para cálculos
  confirmed: boolean;
  fx?: number;                   // Rate usado si se convirtió
  antiX100Applied?: boolean;
};

/**
 * 🚀 NUEVO NORMALIZADOR DUAL - Respeta moneda original + normaliza para cálculos
 * Mapeo explícito según especificaciones del usuario
 */
export function normalizeIncomeRow(row: any): DualNormalizedIncome | null {
  try {
    // 🔧 ADAPTER: Mapear campos de DB con nueva regla de moneda nativa
    const dbRow = {
      Cliente: row.client_name || row.Cliente || "",
      Proyecto: row.project_name || row.Proyecto || "",
      Mes: row.month || row.Mes || "",
      Año: row.year || row.Año || 2025,
      // 🚀 NUEVO: Usar campos nativos del mapeo actualizado
      Monto_ARS: row.Monto_ARS || 0,
      Monto_USD: row.Monto_USD || 0,
      amountLocal: row.amountLocal || 0,
      currency: row.currency || 'USD',
      amountUsd: row.amountUsd || 0,
      Confirmado: row.confirmed || row.Confirmado || "",
      Tipo_Venta: row.sales_type || row.revenue_type || row.Tipo_Venta || ""
    };
    
    // Validar confirmación (aceptar SI/si/sí/Si)
    const confirmedStr = (dbRow.Confirmado || "").toLowerCase();
    const confirmed = confirmedStr.startsWith('s') || confirmedStr === 'si';
    if (!confirmed) return null;
    
    // Mapeo explícito de columnas
    const clientName = (dbRow.Cliente || "").trim();
    const projectName = (dbRow.Proyecto || "").trim();
    const monthEs = (dbRow.Mes || "").trim();
    const year = Number(dbRow.Año) || 2025;
    const saleType = (dbRow.Tipo_Venta || "").trim();
    
    if (!clientName || !projectName || !monthEs) return null;
    
    // Generar monthKey: "2025-08"
    const monthNum = spanishMonthToNumber(monthEs);
    const monthKey = `${year}-${String(monthNum).padStart(2, '0')}`;
    
    // 🚀 IMPLEMENTAR REGLA DE MONEDA NATIVA EXACTA del usuario
    // Helper functions
    const isNumber = (val: any) => val != null && !isNaN(Number(val)) && Number(val) > 0;
    const toNumber = (val: any) => parseNumberEs(val);
    
    // 🔧 DEBUG: Verificar valores de entrada
    console.log(`🔧 NATIVE CURRENCY DEBUG: Cliente="${clientName}", Proyecto="${projectName}"`);
    console.log(`🔧 DB FIELDS: Monto_USD=${dbRow.Monto_USD}, Monto_ARS=${dbRow.Monto_ARS}, amountLocal=${dbRow.amountLocal}, currency=${dbRow.currency}, amountUsd=${dbRow.amountUsd}`);
    
    const hasUsd = isNumber(dbRow.Monto_USD) || isNumber(dbRow.amountUsd);
    const hasArs = isNumber(dbRow.Monto_ARS) || isNumber(dbRow.amountLocal && dbRow.currency === 'ARS');
    
    console.log(`🔧 DETECTION: hasUsd=${hasUsd}, hasArs=${hasArs}`);
    
    let nativeCurrency: 'USD' | 'ARS' = 'USD';
    let nativeAmount = 0;
    let usdNormalized = 0;
    let fx: number | undefined;
    let antiX100Applied = false;
    
    if (hasUsd && !hasArs) {
      // CASO: Solo USD
      nativeCurrency = 'USD';
      nativeAmount = toNumber(dbRow.Monto_USD || dbRow.amountUsd);
      usdNormalized = nativeAmount;
      console.log(`💰 NATIVE CURRENCY USD: Display USD ${nativeAmount}, KPIs USD ${usdNormalized} (${clientName}|${projectName}|${monthKey})`);
      
    } else if (hasArs && !hasUsd) {
      // CASO: Solo ARS - MOSTRAR ARS, calcular USD para KPIs
      nativeCurrency = 'ARS';
      nativeAmount = toNumber(dbRow.Monto_ARS || (dbRow.currency === 'ARS' ? dbRow.amountLocal : 0));
      
      // Normalizar a USD usando FX del mes (solo para KPIs)
      const fxRate = getFxRate(monthKey);
      fx = fxRate;
      usdNormalized = nativeAmount / fxRate;
      
      console.log(`💱 NATIVE CURRENCY ARS: Display ARS ${nativeAmount}, KPIs USD ${usdNormalized.toFixed(2)} (FX=${fx}) (${clientName}|${projectName}|${monthKey})`);
      
    } else if (hasUsd && hasArs) {
      // CASO: Ambos - Preferir USD (dato ya expresado en USD)
      nativeCurrency = 'USD';
      nativeAmount = toNumber(dbRow.Monto_USD || dbRow.amountUsd);
      usdNormalized = nativeAmount;
      console.log(`💰 NATIVE CURRENCY USD (mixed): Display USD ${nativeAmount}, KPIs USD ${usdNormalized} (${clientName}|${projectName}|${monthKey})`);
      
    } else {
      // CASO: Fila vacía → descartar
      return null;
    }
    
    // Asignar valores finales
    const displayCurrency = nativeCurrency;
    const revenueDisplay = nativeAmount;
    const revenueUSDNormalized = usdNormalized;
    
    return {
      clientName,
      projectName,
      monthKey,
      saleType,
      displayCurrency,
      revenueDisplay: Number(revenueDisplay.toFixed(2)),
      revenueUSDNormalized: Number(revenueUSDNormalized.toFixed(2)),
      confirmed: true,
      ...(fx && { fx }),
      ...(antiX100Applied && { antiX100Applied })
    };
    
  } catch (error: any) {
    console.error(`❌ DUAL NORMALIZADOR: Error procesando fila:`, error.message, row);
    return null;
  }
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

/**
 * 🚀 NUEVO AGREGADOR DUAL - Filtra y agrupa ingresos con moneda dual
 * Según especificaciones del usuario para sistema dual
 */
export function aggregateIncome(
  incomeRows: any[], 
  startMonthKey: string, 
  endMonthKey: string
): Map<string, {
  clientName: string;
  projectName: string;
  displayCurrency: "ARS" | "USD";
  revenueDisplay: number;
  revenueUSDNormalized: number;
  saleType: string;
  isActive: boolean;
  records: DualNormalizedIncome[];
}> {
  console.log(`🔧 AGREGADOR DEBUG: Processing ${incomeRows.length} raw income rows for period ${startMonthKey} → ${endMonthKey}`);
  console.log(`🔧 AGREGADOR DEBUG: First 3 raw rows:`, incomeRows.slice(0, 3).map(r => ({ 
    Cliente: r.Cliente, 
    Proyecto: r.Proyecto, 
    Mes: r.Mes, 
    Año: r.Año, 
    Confirmado: r.Confirmado,
    Monto_ARS: r.Monto_ARS,
    Monto_USD: r.Monto_USD
  })));
  
  const aggregated = new Map();
  
  // Normalizar todas las filas
  const normalizedIncomes: DualNormalizedIncome[] = [];
  for (const row of incomeRows) {
    const normalized = normalizeIncomeRow(row);
    if (normalized) {
      normalizedIncomes.push(normalized);
    }
  }
  
  // Filtrar por período
  const filtered = normalizedIncomes.filter(income => 
    income.monthKey >= startMonthKey && income.monthKey <= endMonthKey
  );
  
  console.log(`📊 AGREGADOR DUAL: ${normalizedIncomes.length} ingresos → ${filtered.length} en período ${startMonthKey}..${endMonthKey}`);
  
  // Agrupar por (cliente, proyecto)
  for (const income of filtered) {
    const key = `${income.clientName}|${income.projectName}`;
    
    if (!aggregated.has(key)) {
      aggregated.set(key, {
        clientName: income.clientName,
        projectName: income.projectName,
        displayCurrency: income.displayCurrency, // Usar primera moneda encontrada
        revenueDisplay: 0,
        revenueUSDNormalized: 0,
        saleType: income.saleType,
        isActive: false,
        records: []
      });
    }
    
    const proj = aggregated.get(key);
    proj.revenueDisplay += income.revenueDisplay;
    proj.revenueUSDNormalized += income.revenueUSDNormalized;
    proj.records.push(income);
    
    // Determinar si está activo
    if (income.saleType.toLowerCase().includes("fee")) {
      proj.isActive = true; // Recurrentes siempre activos
    } else if (income.revenueDisplay > 0) {
      proj.isActive = true; // One-shot activos si tienen ingresos en período
    }
  }
  
  console.log(`📊 AGREGADOR DUAL: ${aggregated.size} proyectos únicos agregados`);
  return aggregated;
}