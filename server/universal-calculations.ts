// Universal calculations service for standardized project data processing

import { 
  TimeFilter, 
  ProjectConfig, 
  PersonData, 
  PeriodSummary, 
  Basis,
  resolveProject,
  parseDec,
  monthKey,
  fxForRow,
  rateUSD,
  byThreshold,
  parseTimeFilter
} from '../shared/universal-types';

export interface UniversalDataService {
  getIngresos(projectConfig: ProjectConfig, timeFilter: TimeFilter): Promise<any[]>;
  getCostos(projectConfig: ProjectConfig, timeFilter: TimeFilter): Promise<any[]>;
  calculatePersonData(costosData: any[], basis: Basis): PersonData[];
  calculatePeriodSummary(personsData: PersonData[], period: string, basis: Basis): PeriodSummary;
  getRevenueData(ingresosData: any[]): { revenueUSD: number, confirmedOnly: boolean };
}

export class StandardUniversalService implements UniversalDataService {
  private googleSheetsService: any;
  
  constructor(googleSheetsService: any) {
    this.googleSheetsService = googleSheetsService;
  }

  async getIngresos(projectConfig: ProjectConfig, timeFilter: TimeFilter): Promise<any[]> {
    // FUENTE ÚNICA: siempre "Ventas Tomi"
    const allIngresos = await this.googleSheetsService.getSheetData(
      projectConfig.sheetId,
      projectConfig.tabs.ingresos
    );

    // Filtrar por proyecto y período
    return allIngresos.filter((row: any) => {
      // Filtro por proyecto
      const proyecto = String(row.Proyecto || '').toLowerCase();
      if (!proyecto.includes(projectConfig.projectKey.toLowerCase())) return false;

      // Filtro temporal
      const año = parseInt(row.Año || '0');
      const mes = parseInt(row.Mes || '0');
      if (!año || !mes) return false;

      const rowDate = `${año}-${String(mes).padStart(2, '0')}-01`;
      return rowDate >= timeFilter.start && rowDate <= timeFilter.end;
    });
  }

  async getCostos(projectConfig: ProjectConfig, timeFilter: TimeFilter): Promise<any[]> {
    // FUENTE ÚNICA: siempre "Costos directos e indirectos"
    const allCostos = await this.googleSheetsService.getSheetData(
      projectConfig.sheetId, 
      projectConfig.tabs.costos
    );

    // Filtrar por proyecto y período
    return allCostos.filter((row: any) => {
      // Filtro por proyecto - buscar en Detalle o usar projectKey
      const detalle = String(row.Detalle || row.persona || '').toLowerCase();
      if (!detalle) return false;

      // Filtro temporal
      const año = parseInt(row.Año || '0');
      const mes = parseInt(row.Mes || '0'); 
      if (!año || !mes) return false;

      const rowDate = `${año}-${String(mes).padStart(2, '0')}-01`;
      return rowDate >= timeFilter.start && rowDate <= timeFilter.end;
    });
  }

  calculatePersonData(costosData: any[], basis: Basis): PersonData[] {
    // Agrupar por persona
    const personGroups: Record<string, any[]> = {};
    
    costosData.forEach(row => {
      const personName = String(row.Detalle || row.persona || 'Unknown');
      if (!personGroups[personName]) {
        personGroups[personName] = [];
      }
      personGroups[personName].push(row);
    });

    // Calcular métricas por persona
    const personsData: PersonData[] = [];
    
    Object.entries(personGroups).forEach(([personName, rows]) => {
      // Agregaciones por persona
      let Kp = 0, Lp = 0, Mp = 0;
      let totalBudgetedCost = 0;
      let totalActualCost = 0;

      rows.forEach(row => {
        const K = parseDec(row.K || row.hrs_obj || 0);
        const L = parseDec(row.L || row.hrs_reales || 0);
        const M = parseDec(row.M || row.hrs_facturacion || 0);
        const rate = rateUSD(row);

        Kp += K;
        Lp += L; 
        Mp += M;
        totalBudgetedCost += K * rate;
        
        // Cálculo según basis
        if (basis === 'ECON') {
          totalActualCost += M * rate;
        } else { // EXEC
          totalActualCost += L * rate;
        }
      });

      // Métricas derivadas
      const hourDeviationPct = Kp === 0 ? 0 : ((Lp / Kp) - 1) * 100;
      const costDeviation = totalActualCost - totalBudgetedCost;
      const severity = byThreshold(Math.abs(hourDeviationPct));

      personsData.push({
        personId: personName.toLowerCase().replace(/\s+/g, '-'),
        personName,
        Kp,
        Lp, 
        Mp,
        budgetedCost: totalBudgetedCost,
        actualCost: totalActualCost,
        hourDeviationPct,
        costDeviation,
        severity
      });
    });

    return personsData;
  }

  calculatePeriodSummary(personsData: PersonData[], period: string, basis: Basis): PeriodSummary {
    // Totales período
    const sumK = personsData.reduce((sum, p) => sum + p.Kp, 0);
    const sumL = personsData.reduce((sum, p) => sum + p.Lp, 0); 
    const sumM = personsData.reduce((sum, p) => sum + p.Mp, 0);
    const efficiencyPct = sumK === 0 ? 0 : (sumL / sumK) * 100;
    const teamCostUSD = personsData.reduce((sum, p) => sum + p.actualCost, 0);
    const activeMembers = personsData.filter(p => p.Lp > 0 || p.actualCost > 0).length;

    return {
      sumK,
      sumL,
      sumM,
      efficiencyPct,
      teamCostUSD, 
      activeMembers,
      period,
      basis
    };
  }

  getRevenueData(ingresosData: any[]): { revenueUSD: number, confirmedOnly: boolean } {
    let revenueUSD = 0;
    let hasConfirmed = false;

    ingresosData.forEach(row => {
      const confirmado = String(row.Confirmado || '').toLowerCase();
      const isConfirmed = confirmado === 'si' || confirmado === 'true' || confirmado === '1';
      
      if (isConfirmed) {
        hasConfirmed = true;
        // ingresosUSD(row) = row.Monto_USD>0 ? Monto_USD : row.Monto_ARS>0 ? Monto_ARS / fxForRow(row) : 0
        const montoUSD = parseDec(row.Monto_USD || 0);
        const montoARS = parseDec(row.Monto_ARS || 0);
        
        if (montoUSD > 0) {
          revenueUSD += montoUSD;
        } else if (montoARS > 0) {
          revenueUSD += montoARS / fxForRow(row);
        }
      }
    });

    return { revenueUSD, confirmedOnly: hasConfirmed };
  }
}

// Factory function for universal project calculations
export async function calculateUniversalProjectData(
  projectId: string,
  timeFilter: string,
  basis: Basis = 'ECON',
  googleSheetsService: any
): Promise<{
  projectConfig: ProjectConfig;
  timeFilterParsed: TimeFilter;
  personsData: PersonData[];
  periodSummary: PeriodSummary;
  revenueData: { revenueUSD: number, confirmedOnly: boolean };
  ingresosRaw: any[];
  costosRaw: any[];
}> {
  const projectConfig = resolveProject(projectId);
  const timeFilterParsed = parseTimeFilter(timeFilter);
  
  const service = new StandardUniversalService(googleSheetsService);
  
  // Obtener datos de fuentes únicas
  const [ingresosRaw, costosRaw] = await Promise.all([
    service.getIngresos(projectConfig, timeFilterParsed),
    service.getCostos(projectConfig, timeFilterParsed)
  ]);
  
  // Cálculos estandarizados
  const personsData = service.calculatePersonData(costosRaw, basis);
  const periodSummary = service.calculatePeriodSummary(
    personsData, 
    timeFilter, 
    basis
  );
  const revenueData = service.getRevenueData(ingresosRaw);
  
  return {
    projectConfig,
    timeFilterParsed,
    personsData,
    periodSummary,
    revenueData,
    ingresosRaw,
    costosRaw
  };
}