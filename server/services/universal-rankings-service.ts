/**
 * Servicio universal de rankings que puede ser usado desde cualquier endpoint
 * Consolida toda la lógica en un solo lugar
 */

import { resolveProject } from './project-resolver.js';
import { resolvePeriod } from '../../shared/utils/project-config.js';
import { 
  computeRankings, 
  filterByPeriod 
} from '../../shared/utils/rankings-universal.js';
import { 
  adaptExcelToUniversal, 
  formatForExistingInterface 
} from '../../shared/utils/universal-adapter.js';

export interface UniversalRankingsRequest {
  projectId: string | number;
  timeFilter?: string;
  start?: string;
  end?: string;
}

export interface UniversalRankingsResponse {
  rankings: any[];
  totalEconomicoPeriodo: number;
  periodLabel: string;
  period: { start: string; end: string };
  metadata: {
    universalSystem: boolean;
    projectKey: string;
    spreadsheetId: string;
    filteredRows: number;
    originalRows: number;
  };
  validaciones?: any;
  configuracion?: any;
}

export async function getUniversalRankings(request: UniversalRankingsRequest): Promise<UniversalRankingsResponse> {
  // Validación defensiva contra llamadas incorrectas
  if (!request || typeof request !== 'object') {
    throw new Error(`Invalid request for getUniversalRankings: received ${typeof request}`);
  }
  
  const { projectId, timeFilter = 'all', start, end } = request;
  
  console.log(`🌟 UNIVERSAL SERVICE: Computing rankings for project ${projectId}, filter ${timeFilter}`);
  
  // 1. Resolver configuración del proyecto (dinámico, sin hardcode)
  const cfg = resolveProject({ projectId });
  
  // Obtener projectKey desde el resolvido de id
  const idMapModule = await import('../../shared/config/project-id-map.json', { assert: { type: 'json' } });
  const idMap = idMapModule.default;
  const projectKey = (idMap as any)[String(projectId)] || 'kimberly_huggies';
  
  // 2. Resolver período temporal usando sistema universal
  let period: { start: string; end: string };
  try {
    if (start && end) {
      period = { start, end };
    } else {
      period = resolvePeriod(timeFilter || 'all', projectKey);
    }
  } catch (error) {
    console.warn(`⚠️ Unknown period format: ${timeFilter}, using current month`);
    const now = new Date();
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    period = { start: currentMonth, end: currentMonth };
  }
  
  console.log(`📅 Resolved period for ${timeFilter}:`, period);

  // 3. Obtener datos raw 2D del Excel MAESTRO (para usar con índices numéricos)
  const googleSheetsModule = await import('./googleSheetsWorking.js');
  
  // Usar función que devuelve raw 2D arrays compatible con columnMap numérico
  const rawData = await googleSheetsModule.googleSheetsWorkingService.getSheetValues(cfg.spreadsheetId, cfg.sheetName);
  

  


  // 4. Convertir datos al formato universal
  const universalRows = adaptExcelToUniversal(rawData, projectKey, projectId.toString());
  console.log(`🔄 Converted ${rawData.length} Excel rows to ${universalRows.length} universal rows using config:`, cfg.columnMap);

  // 5. Filtrar por período temporal
  const filteredRows = filterByPeriod(universalRows, period);
  console.log(`📅 Filtered to ${filteredRows.length} rows for period ${period.start} to ${period.end}`);

  if (filteredRows.length === 0) {
    console.log('⚠️ No data found for the specified period');
    return {
      rankings: [],
      totalEconomicoPeriodo: 0,
      periodLabel: timeFilter,
      period: period,
      metadata: {
        universalSystem: true,
        projectKey,
        spreadsheetId: cfg.spreadsheetId,
        filteredRows: 0,
        originalRows: rawData.length
      }
    };
  }

  // 6. Calcular rankings usando sistema universal
  const universalRankings = computeRankings(filteredRows);
  console.log(`📊 Universal rankings calculated: ${universalRankings.length} results`);

  // 7. Formatear para compatibilidad con frontend existente
  const compatibleRankings = universalRankings.map(formatForExistingInterface);

  // 8. Calcular total económico del período para banner
  const { parseDec } = await import('../../shared/utils/num.js');
  const totalEconomicoPeriodo = filteredRows.reduce((sum, row) => {
    const M = parseDec(row.horasFacturacion);
    const VH = parseDec(row.valorHoraARS);
    const USD = parseDec(row.montoUSD);
    return sum + (USD > 0 ? USD : (M * VH));
  }, 0);

  console.log(`💰 Total económico del período: $${totalEconomicoPeriodo}`);
  console.log(`📊 Returning ${compatibleRankings.length} rankings with universal system`);

  // 9. Validaciones adicionales (compatibilidad con frontend)
  const validaciones = {
    datosCompletos: universalRankings.length,
    sinObjetivo: universalRankings.filter(r => r.horasObjetivo === 0).length,
    participacionTotal: universalRankings.reduce((sum, r) => {
      // Calcular participación desde los datos filtrados
      const personData = filteredRows.filter(row => row.person === r.person);
      const totalEconomico = personData.reduce((sum, row) => {
        const M = parseDec(row.horasFacturacion);
        const VH = parseDec(row.valorHoraARS);
        const USD = parseDec(row.montoUSD);
        return sum + (USD > 0 ? USD : (M * VH));
      }, 0);
      return sum + (totalEconomicoPeriodo > 0 ? (totalEconomico / totalEconomicoPeriodo) * 100 : 0);
    }, 0),
    noDataForPeriod: universalRankings.length === 0,
    sinIngresos: totalEconomicoPeriodo <= 1e-6,
    totalEconomicoPeriodo: totalEconomicoPeriodo,
    totalMembers: universalRankings.length
  };

  const configuracion = {
    balanceEficienciaImpacto: "50-50",
    periodoAnalisis: timeFilter,
    algoritmo: "universal_system",
    version: "2025.09.15"
  };

  // 10. Respuesta compatible con frontend existente
  return {
    rankings: compatibleRankings,
    totalEconomicoPeriodo,
    periodLabel: timeFilter,
    period: period,
    metadata: {
      universalSystem: true,
      projectKey,
      spreadsheetId: cfg.spreadsheetId,
      filteredRows: filteredRows.length,
      originalRows: rawData.length
    },
    validaciones,
    configuracion
  };
}