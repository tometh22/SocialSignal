/**
 * 🚀 TIPOS CANÓNICOS - SINGLE SOURCE OF TRUTH PARA INGRESOS
 * Definición estable que usa toda la aplicación
 */

// PeriodKey: formato "YYYY-MM" sin días
export type PeriodKey = `${number}-${'01'|'02'|'03'|'04'|'05'|'06'|'07'|'08'|'09'|'10'|'11'|'12'}`;

// Estructura de moneda para display
export type MoneyDisplay = { 
  amount: number; 
  currency: 'USD' | 'ARS' 
};

// Fila de ingresos cruda desde "Ventas Tomi" 
export type IncomeRow = {
  clientName: string;     // "Cliente"
  projectName: string;    // "Proyecto"
  monthEs: string;        // "Mes" (p.e. "Agosto")
  year: number;           // "Año"
  type: string;           // "Tipo_Venta"
  amountARS: number;      // "Monto_ARS" ya parseado (número)
  amountUSD: number;      // "Monto_USD" ya parseado (número)
  confirmed: boolean;     // "Confirmado" (Si/No)
};

// Ingresos de un proyecto específico
export type ProjectIncome = {
  projectId: number | null;                // resuelto por nombre (si aplica)
  clientName: string;
  projectName: string;
  revenueDisplay: MoneyDisplay;            // moneda nativa p/ UI
  revenueUSDNormalized: number;            // USD normalizado p/ KPIs
  records: Array<{ currency: 'USD' | 'ARS'; amount: number }>;
};

// Resumen de ingresos del portfolio
export type PortfolioIncome = {
  period: PeriodKey;
  periodRevenueUSD: number;                // suma normalizada
  projectsWithIncome: number;
  totalProjects: number;
};

// Resultado completo de ingresos por período
export type IncomeResult = {
  period: PeriodKey;
  projects: ProjectIncome[];
  summary: PortfolioIncome;
};