/**
 * Endpoint universal para performance rankings
 * Integra el sistema universal manteniendo compatibilidad con el frontend existente
 */

import { Express } from 'express';
import { 
  adaptExcelToUniversal, 
  formatForExistingInterface 
} from '../shared/utils/universal-adapter.js';
import { 
  computeRankings, 
  filterByPeriod 
} from '../shared/utils/rankings-universal.js';
import { 
  getProjectConfig, 
  resolvePeriod 
} from '../shared/utils/project-config.js';

export function addUniversalRankingsEndpoint(app: Express, storage: any, requireAuth: any) {
  
  // ENDPOINT UNIVERSAL: Performance Rankings con sistema universal
  app.get('/api/projects/:id/performance-rankings-universal', requireAuth, async (req, res) => {
    const id = parseInt(req.params.id);
    const timeFilter = req.query.timeFilter as string || 'all';
    console.log(`🌟 UNIVERSAL API CALL: GET /${id}/performance-rankings-universal?timeFilter=${timeFilter}`);
    
    if (isNaN(id)) return res.status(400).json({ message: "Invalid project ID" });

    try {
      // 1. Obtener configuración del proyecto (multi-proyecto)
      const projectKey = 'kimberly_huggies'; // Por ahora hardcodeado, luego dinámico
      const config = getProjectConfig(projectKey);
      
      // 2. Resolver período temporal usando sistema universal
      let period: { start: string; end: string };
      try {
        period = resolvePeriod(timeFilter, projectKey);
      } catch (error) {
        console.warn(`⚠️ Unknown period format: ${timeFilter}, using current month`);
        const now = new Date();
        const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
        period = { start: currentMonth, end: currentMonth };
      }
      
      console.log(`📅 Resolved period for ${timeFilter}:`, period);

      // 3. Obtener datos del Excel MAESTRO
      const { googleSheetsWorkingService } = await import('../server/services/googleSheetsWorking.js');
      const sheetsService = googleSheetsWorkingService;
      
      // Usar configuración dinámica del proyecto
      const rawData = await sheetsService.getAllData(config.spreadsheetId, config.sheetName);
      
      if (!rawData || rawData.length === 0) {
        console.log('⚠️ No data found in Excel MAESTRO');
        return res.json({
          rankings: [],
          totalEconomicoPeriodo: 0,
          periodLabel: timeFilter,
          period: period
        });
      }

      // 4. Convertir datos al formato universal
      const universalRows = adaptExcelToUniversal(rawData, projectKey, id.toString());
      console.log(`🔄 Converted ${rawData.length} Excel rows to ${universalRows.length} universal rows`);

      // 5. Filtrar por período temporal
      const filteredRows = filterByPeriod(universalRows, period);
      console.log(`📅 Filtered to ${filteredRows.length} rows for period ${period.start} to ${period.end}`);

      if (filteredRows.length === 0) {
        console.log('⚠️ No data found for the specified period');
        return res.json({
          rankings: [],
          totalEconomicoPeriodo: 0,
          periodLabel: timeFilter,
          period: period
        });
      }

      // 6. Calcular rankings usando sistema universal
      const universalRankings = computeRankings(filteredRows);
      console.log(`📊 Universal rankings calculated: ${universalRankings.length} results`);

      // 7. Formatear para compatibilidad con frontend existente
      const compatibleRankings = universalRankings.map(formatForExistingInterface);

      // 8. Calcular total económico del período para banner
      const { parseDec } = await import('../shared/utils/num.js');
      const totalEconomicoPeriodo = filteredRows.reduce((sum, row) => {
        const M = parseDec(row.horasFacturacion);
        const VH = parseDec(row.valorHoraARS);
        const USD = parseDec(row.montoUSD);
        return sum + (USD > 0 ? USD : (M * VH));
      }, 0);

      console.log(`💰 Total económico del período: $${totalEconomicoPeriodo}`);
      console.log(`📊 Returning ${compatibleRankings.length} rankings with universal system`);

      // 9. Respuesta compatible con frontend existente
      return res.json({
        rankings: compatibleRankings,
        totalEconomicoPeriodo,
        periodLabel: timeFilter,
        period: period,
        metadata: {
          universalSystem: true,
          projectKey,
          spreadsheetId: config.spreadsheetId,
          filteredRows: filteredRows.length,
          originalRows: rawData.length
        }
      });

    } catch (error) {
      console.error('❌ Error in universal performance rankings:', error);
      res.status(500).json({ 
        message: "Failed to get universal performance rankings",
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });
}