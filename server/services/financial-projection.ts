import { getNativeProjectionSummary } from './financial-native-dashboard';
import { buildMasterScenario, getMasterScenarioSnapshot } from './financial-master-scenario';
import { buildMasterDashboard } from './financial-master-dashboard';
import { roundScenarioMoney } from '../../shared/financial-scenario';

/** Native months keep their own source; Master months use one current source snapshot. */
export async function loadFinancialProjection(year: number) {
  const projection = await getNativeProjectionSummary(year);
  const periods = projection.meses.filter(month => month.fuenteFacturacion === 'master').map(month => month.periodKey);
  if (!periods.length) return { projection, master: null, sourceReadAt: undefined };
  const snapshot = await getMasterScenarioSnapshot();
  const master = buildMasterScenario(snapshot, periods);
  const reporting = new Map(buildMasterDashboard(snapshot, periods).map(month => [month.periodKey, month]));
  const byPeriod = new Map(master.months.map(month => [month.periodKey, month]));
  const months = projection.meses.map(month => {
    const current = byPeriod.get(month.periodKey);
    return current ? { ...month, cierre: reporting.get(month.periodKey)!.cierre, facturacion: current.revenueUsd, costos: current.costUsd, resultado: current.ebitUsd } : month;
  });
  const series = (key: 'facturacion' | 'costos' | 'resultado') => {
    const ejecutado = roundScenarioMoney(months.filter(month => month.cierre).reduce((sum, month) => sum + month[key], 0));
    const proyectado = roundScenarioMoney(months.filter(month => !month.cierre).reduce((sum, month) => sum + month[key], 0));
    return { ejecutado, proyectado, total: roundScenarioMoney(months.reduce((sum, month) => sum + month[key], 0)) };
  };
  return { projection: { ...projection, months, meses: months, mesesCerrados: months.filter(month => month.cierre).length,
    mesesProyectados: months.filter(month => !month.cierre).length, facturacion: series('facturacion'),
    costos: series('costos'), resultado: series('resultado') }, master, sourceReadAt: snapshot.readAt };
}
export async function getFinancialProjection(year: number) {
  return (await loadFinancialProjection(year)).projection;
}
