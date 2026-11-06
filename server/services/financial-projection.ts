import { getNativeProjectionSummary } from './financial-native-dashboard';
import { buildMasterScenario, getMasterScenarioSnapshot } from './financial-master-scenario';
import { roundScenarioMoney } from '../../shared/financial-scenario';

/** Native months keep their own source; Master months use one current source snapshot. */
export async function loadFinancialProjection(year: number) {
  const projection = await getNativeProjectionSummary(year);
  const periods = projection.meses.filter(month => month.fuenteFacturacion === 'master').map(month => month.periodKey);
  if (!periods.length) return { projection, master: null, sourceReadAt: undefined };
  const snapshot = await getMasterScenarioSnapshot();
  const master = buildMasterScenario(snapshot, periods);
  const byPeriod = new Map(master.months.map(month => [month.periodKey, month]));
  const months = projection.meses.map(month => {
    const current = byPeriod.get(month.periodKey);
    return current ? { ...month, facturacion: current.revenueUsd, costos: current.costUsd, resultado: current.ebitUsd } : month;
  });
  const series = (key: 'facturacion' | 'costos' | 'resultado') => {
    const ejecutado = roundScenarioMoney(months.filter(month => month.cierre).reduce((sum, month) => sum + month[key], 0));
    const proyectado = roundScenarioMoney(months.filter(month => !month.cierre).reduce((sum, month) => sum + month[key], 0));
    return { ejecutado, proyectado, total: roundScenarioMoney(ejecutado + proyectado) };
  };
  return { projection: { ...projection, months, meses: months, facturacion: series('facturacion'),
    costos: series('costos'), resultado: series('resultado') }, master, sourceReadAt: snapshot.readAt };
}
export async function getFinancialProjection(year: number) {
  return (await loadFinancialProjection(year)).projection;
}
