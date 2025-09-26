/**
 * 🚀 COSTS SOURCE OF TRUTH (SoT) - TIPOS CANÓNICOS
 * 
 * Estructura simétrica a income/ con tipos para costos:
 * - Moneda nativa (ARS/USD) para display
 * - Normalización USD para KPIs
 * - Separación Directo/Indirecto
 */

// ==================== CORE TYPES ====================

export type PeriodKey = `${number}-${'01'|'02'|'03'|'04'|'05'|'06'|'07'|'08'|'09'|'10'|'11'|'12'}`;

export type MoneyDisplay = { 
  amount: number; 
  currency: 'USD' | 'ARS' 
};

export type CostKind = 'Directo' | 'Indirecto';

// ==================== PROJECT COST ====================

export type ProjectCost = {
  clientName: string;
  projectName: string;
  period: PeriodKey;
  
  // 🚀 DUAL CURRENCY: Display (moneda nativa)
  costDisplay: MoneyDisplay;
  
  // 🚀 NORMALIZATION: USD para KPIs
  costUSDNormalized: number;
  
  // 🚀 METADATA
  kind: CostKind;
  sourceRowCount: number;
};

// ==================== AGGREGATE RESULT ====================

export type CostsResult = {
  period: PeriodKey;
  projects: ProjectCost[];
  portfolioCostUSD: number; // suma de costUSDNormalized
};

// ==================== RAW DATA TYPES ====================

export interface RawCostRecord {
  // Identificación
  cliente?: string;
  project?: string;
  clientName?: string;
  projectName?: string;
  client_name?: string;
  project_name?: string;
  
  // Temporal
  mes?: string;
  month?: string;
  año?: string | number;
  year?: string | number;
  
  // Validación
  confirmado?: string;
  confirmed?: string;
  
  // Tipo de costo
  tipo_costo?: string;
  kind?: string;
  
  // Montos
  monto_ars?: string | number;
  amount_ars?: string | number;
  amountLocal?: string | number;
  monto_usd?: string | number;
  amount_usd?: string | number;
  amountUsd?: string | number;
  
  // Metadata para debugging
  rowIndex?: number;
  sheetName?: string;
}

// ==================== PARSER RESULT ====================

export interface ParsedCostRecord {
  clientName: string;
  projectName: string;
  period: PeriodKey;
  
  // Amounts (pre-normalization)
  arsAmount: number | null;
  usdAmount: number | null;
  
  // Metadata
  kind: CostKind;
  sourceRow: number;
  rawRecord: RawCostRecord;
}

// ==================== BUSINESS RULES CONFIG ====================

export interface CostBusinessRules {
  // Filtros
  requiredConfirmation: boolean;
  
  // Anti-escala (igual que income)
  enableAntiScale: boolean;
  scaleFactors: {
    ars: number; // típicamente 100
    usd: number; // típicamente 100 para algunos casos
  };
  
  // Overhead handling
  indirectCostStrategy: 'exclude' | 'portfolio-only' | 'allocate-by-hours';
}

// ==================== API CONTRACTS ====================

export interface CostSummaryByProject {
  clientName: string;
  projectName: string;
  period: PeriodKey;
  costDisplay: MoneyDisplay;
  costUSDNormalized: number;
  kind: CostKind;
}

export interface PortfolioCostSummary {
  period: PeriodKey;
  portfolioCostUSD: number;
  directCostsUSD: number;
  indirectCostsUSD: number;
  projectCount: number;
}

// ==================== INTEGRATION TYPES ====================

export interface ProjectCostMetrics {
  // Para integración con agregador de proyectos
  costDisplay: MoneyDisplay;
  costUSDNormalized: number;
  
  // Derivadas (calculadas en agregador)
  profitUSD?: number;           // revenue - cost
  markupRatio?: number;         // revenue / cost
  marginFrac?: number;          // profit / revenue
}