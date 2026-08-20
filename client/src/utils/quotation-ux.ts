import type { QuotationData } from '@/context/optimized-quote-context';

export const QUOTATION_PHASES = [
  { num: 1, title: 'Proyecto', shortTitle: 'Proyecto', description: 'Cliente, modalidad, moneda y plantilla' },
  { num: 2, title: 'Alcance', shortTitle: 'Alcance', description: 'Equipo, complejidad y entregables' },
  { num: 3, title: 'Precio', shortTitle: 'Precio', description: 'Rentabilidad y ajustes comerciales' },
  { num: 4, title: 'Propuesta', shortTitle: 'Propuesta', description: 'Vista cliente, variantes y aprobación' },
] as const;

export type QuotationPhase = 1 | 2 | 3 | 4;

export type QuotationValidationIssue = {
  field: string;
  message: string;
};

const hasPositiveExchangeRate = (quotation: QuotationData) =>
  Number(quotation.exchangeRateSnapshot) > 0 && !quotation.requiresExchangeRateConfirmation;

export function validateQuotationPhase(
  phase: QuotationPhase,
  quotation: QuotationData,
): QuotationValidationIssue[] {
  if (phase === 1) {
    const issues: QuotationValidationIssue[] = [];
    if (!quotation.client?.id) issues.push({ field: 'client', message: 'Seleccioná un cliente.' });
    if (!quotation.project.name?.trim()) issues.push({ field: 'project-name', message: 'Ingresá el nombre del proyecto.' });
    if (!quotation.project.type) issues.push({ field: 'project-type', message: 'Seleccioná una modalidad de proyecto.' });
    if (quotation.project.type && quotation.project.type !== 'always-on' && !quotation.project.duration) {
      issues.push({ field: 'project-duration', message: 'Seleccioná la duración estimada.' });
    }
    if (!hasPositiveExchangeRate(quotation)) {
      issues.push({ field: 'quotation-exchange-rate', message: 'Confirmá un tipo de cambio positivo.' });
    }
    return issues;
  }

  if (phase === 2) {
    const issues: QuotationValidationIssue[] = [];
    if (quotation.teamMembers.length === 0) {
      issues.push({ field: 'team-config', message: 'Agregá al menos una persona o un rol al equipo.' });
    } else {
      if (quotation.teamMembers.some((member) => Number(member.hours) <= 0)) {
        issues.push({ field: 'team-config', message: 'Todas las asignaciones deben tener horas mayores a cero.' });
      }
      if (quotation.teamMembers.some((member) => Number(member.rate) <= 0)) {
        issues.push({ field: 'team-config', message: 'Resolvé las tarifas faltantes antes de continuar.' });
      }
    }
    if (!quotation.analysisType || !quotation.mentionsVolume || !quotation.countriesCovered || !quotation.clientEngagement) {
      issues.push({ field: 'complexity-config', message: 'Completá todos los factores de complejidad.' });
    }
    if (quotation.project.type === 'always-on') {
      if (!quotation.deliverables.length) {
        issues.push({ field: 'deliverables-config', message: 'Agregá al menos un entregable recurrente.' });
      } else if (quotation.deliverables.some((item) => !item.type || !item.frequency || !String(item.description || '').trim())) {
        issues.push({ field: 'deliverables-config', message: 'Completá tipo, frecuencia y descripción de cada entregable.' });
      }
    }
    return issues;
  }

  if (phase === 3) {
    const issues: QuotationValidationIssue[] = [];
    const financials = quotation.financials;
    if (financials.priceMode === 'manual' && Number(financials.manualPrice) <= 0) {
      issues.push({ field: 'manual-price', message: 'Ingresá un precio objetivo mayor a cero.' });
    }
    if (Number(financials.marginFactor) < 1 || Number(financials.marginFactor) > 6) {
      issues.push({ field: 'pricing-config', message: 'El multiplicador comercial debe estar entre 1x y 6x.' });
    }
    if (Number(financials.discountPercentage || 0) < 0 || Number(financials.discountPercentage || 0) > 50) {
      issues.push({ field: 'pricing-config', message: 'El descuento debe estar entre 0% y 50%.' });
    }
    if (quotation.inflation.applyInflationAdjustment && quotation.inflation.rateProjectionMode !== 'annual_avg' && !quotation.inflation.projectStartDate) {
      issues.push({ field: 'inflation-start-date', message: 'Definí la fecha de inicio para proyectar la inflación.' });
    }
    if (quotation.inflation.applyInflationAdjustment
      && quotation.inflation.inflationMethod === 'automatic'
      && quotation.inflation.automaticInflationRate == null) {
      issues.push({ field: 'pricing-config', message: 'No hay una tasa automática disponible; cargá la serie de inflación o elegí una tasa manual.' });
    }
    if (quotation.inflation.applyInflationAdjustment
      && quotation.inflation.inflationMethod === 'manual'
      && Number(quotation.inflation.manualInflationRate) <= 0) {
      issues.push({ field: 'pricing-config', message: 'Ingresá una tasa manual positiva o desactivá el ajuste por inflación.' });
    }
    if ((financials.priceMode === 'manual' || Number(financials.discountPercentage || 0) > 0)
      && !quotation.adjustmentReason?.trim()) {
      issues.push({ field: 'adjustment-reason', message: 'Justificá el precio manual o descuento para la aprobación.' });
    }
    if (!quotation.expiresAt || new Date(`${quotation.expiresAt}T23:59:59`) <= new Date()) {
      issues.push({ field: 'quotation-expiry', message: 'La vigencia debe finalizar en una fecha futura.' });
    }
    if (!quotation.commercialTerms?.trim()) {
      issues.push({ field: 'commercial-terms', message: 'Definí los términos comerciales de la propuesta.' });
    }
    const schedule = quotation.paymentSchedule || [];
    const scheduleTotal = schedule.reduce((sum, milestone) => sum + Number(milestone.percentage || 0), 0);
    if (schedule.length > 0 && Math.abs(scheduleTotal - 100) > 0.01) {
      issues.push({ field: 'pricing-config', message: `El cronograma de pagos debe sumar 100% (actual: ${scheduleTotal.toFixed(2)}%).` });
    }
    return issues;
  }

  return [];
}

export function getFirstIncompleteQuotationPhase(quotation: QuotationData): QuotationPhase | null {
  for (const phase of [1, 2, 3] as const) {
    if (validateQuotationPhase(phase, quotation).length > 0) return phase;
  }
  return null;
}
