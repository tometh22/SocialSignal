import type { QuotationData } from '@/context/optimized-quote-context';
import { blueprintDefinitionSchema, estimateBlueprintWorkload, workloadForBillingPeriod } from '@shared/quotation-professional';

export const QUOTATION_PHASES = [
  { num: 1, title: 'Proyecto', shortTitle: 'Proyecto', description: 'Cliente, modalidad, moneda y plantilla' },
  { num: 2, title: 'Alcance', shortTitle: 'Alcance', description: 'Equipo, complejidad y entregables' },
  { num: 3, title: 'Precio', shortTitle: 'Precio', description: 'Rentabilidad y ajustes comerciales' },
  { num: 4, title: 'Propuesta', shortTitle: 'Propuesta', description: 'Vista cliente, variantes y aprobación' },
] as const;

/**
 * Business-oriented navigation for the professional wizard. The legacy
 * phases above remain exported because older consumers and saved drafts still
 * use their three validation buckets.
 */
export const QUOTATION_STEPS = [
  { num: 1, title: 'Brief', shortTitle: 'Brief', description: 'Cliente, oportunidad y objetivo' },
  { num: 2, title: 'Servicio', shortTitle: 'Servicio', description: 'Elegí una receta probada' },
  { num: 3, title: 'Alcance', shortTitle: 'Alcance', description: 'Definí cobertura y entregables' },
  { num: 4, title: 'Equipo', shortTitle: 'Equipo', description: 'Confirmá capacidad y esfuerzo' },
  { num: 5, title: 'Inversión', shortTitle: 'Inversión', description: 'Precio, moneda y condiciones' },
  { num: 6, title: 'Propuesta', shortTitle: 'Propuesta', description: 'Compará, validá y prepará el envío' },
] as const;

export type QuotationPhase = 1 | 2 | 3 | 4;
export type QuotationStep = 1 | 2 | 3 | 4 | 5 | 6;

export type QuotationValidationIssue = {
  field: string;
  message: string;
};

export function isBlueprintCompatibleWithProjectType(projectType: string | undefined, modality: string) {
  // Renewal/expansion is a commercial motion applied to an existing quote,
  // not a standalone service recipe.
  if (modality === 'renewal') return false;
  if (!projectType) return true;
  if (projectType === 'on-demand') return ['one_shot', 'event_pack', 'demo'].includes(modality);
  if (projectType === 'fee-mensual' || projectType === 'always-on') return ['monthly_fee', 'annual_program'].includes(modality);
  if (projectType === 'credit-pack') return modality === 'credit_pack';
  return true;
}

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
    if (!quotation.id && !quotation.scopeSnapshot) {
      issues.push({ field: 'professional-scope', message: 'Elegí una receta profesional para definir el alcance.' });
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
    if (!quotation.mentionsVolume || !quotation.countriesCovered) {
      issues.push({ field: 'complexity-config', message: 'Completá volumen y cobertura para calcular la complejidad.' });
    }
    if (quotation.scopeSnapshot) {
      const definition = blueprintDefinitionSchema.parse(quotation.scopeSnapshot);
      const standardHours = workloadForBillingPeriod(definition, estimateBlueprintWorkload(definition)).totalHours;
      const configuredHours = quotation.teamMembers.reduce((sum, member) => sum + Number(member.hours || 0), 0);
      const deviation = standardHours > 0 ? Math.abs(configuredHours - standardHours) / standardHours : 0;
      if (deviation > 0.1 && !quotation.effortOverrideReason?.trim()) {
        issues.push({ field: 'effort-override-reason', message: 'Justificá el desvío de horas frente a la receta profesional.' });
      }
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
    if (quotation.creditProgram?.enabled) {
      const program = quotation.creditProgram;
      if (!Number.isInteger(program.totalCredits) || program.totalCredits <= 0) {
        issues.push({ field: 'credit-total', message: 'La bolsa debe tener al menos un crédito.' });
      }
      if (!program.validityStart || !program.validityEnd || new Date(`${program.validityEnd}T23:59:59`) <= new Date(`${program.validityStart}T00:00:00`)) {
        issues.push({ field: 'credit-validity', message: 'La vigencia debe tener una fecha de cierre posterior al inicio.' });
      }
      if (program.carryoverPercentage < 0 || program.carryoverPercentage > 20) {
        issues.push({ field: 'credit-carryover', message: 'El carry-over no puede superar el 20%.' });
      }
      if (program.graceMonths < 0 || program.graceMonths > 4) {
        issues.push({ field: 'credit-grace', message: 'La ventana de gracia puede ser de hasta 4 meses.' });
      }
      if (program.executiveCreditValueUSD < 500 || program.executiveCreditValueUSD > 1900) {
        issues.push({ field: 'credit-executive-value', message: 'El valor del informe ejecutivo debe estar entre USD 500 y USD 1.900.' });
      }
      if (program.deepStudyCreditValueUSD < 1500 || program.deepStudyCreditValueUSD > 5800) {
        issues.push({ field: 'credit-deep-value', message: 'El valor del estudio en profundidad debe estar entre USD 1.500 y USD 5.800.' });
      }
      if (program.packagePriceUSD <= 0) {
        issues.push({ field: 'credit-package-price', message: 'Definí un precio total de bolsa mayor a cero.' });
      }
    }
    if (financials.priceMode === 'manual' && Number(financials.manualPrice) <= 0) {
      issues.push({ field: 'manual-price', message: 'Ingresá un precio objetivo mayor a cero.' });
    }
    if (Number(financials.marginFactor) < 1 || Number(financials.marginFactor) > 6) {
      issues.push({ field: 'pricing-config', message: 'El multiplicador comercial debe estar entre 1x y 6x.' });
    }
    if (Number(financials.discountPercentage || 0) < 0 || Number(financials.discountPercentage || 0) > 50) {
      issues.push({ field: 'pricing-config', message: 'El descuento debe estar entre 0% y 50%.' });
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

/** Validation buckets used by the new progressive wizard. */
export function validateQuotationStep(
  step: QuotationStep,
  quotation: QuotationData,
): QuotationValidationIssue[] {
  if (step === 1) {
    const issues: QuotationValidationIssue[] = [];
    if (!quotation.client?.id) issues.push({ field: 'client', message: 'Seleccioná un cliente.' });
    if (!quotation.project.name?.trim()) issues.push({ field: 'project-name', message: 'Ingresá el nombre del proyecto.' });
    if (!quotation.project.type) issues.push({ field: 'project-type', message: 'Seleccioná una modalidad de proyecto.' });
    if (!quotation.commercialMotion) issues.push({ field: 'commercial-motion', message: 'Seleccioná el tipo de oportunidad.' });
    if (quotation.project.type && quotation.project.type !== 'always-on' && !quotation.project.duration) {
      issues.push({ field: 'project-duration', message: 'Seleccioná la duración estimada.' });
    }
    return issues;
  }

  if (step === 2 || step === 3) {
    return quotation.scopeSnapshot || (quotation.id && Number(quotation.pricingVersion || 2) < 2)
      ? []
      : [{ field: 'professional-scope', message: 'Elegí una receta profesional para definir el servicio.' }];
  }

  if (step === 4) return validateQuotationPhase(2, quotation);
  if (step === 5) {
    const issues = validateQuotationPhase(3, quotation);
    if (!hasPositiveExchangeRate(quotation)) {
      issues.unshift({ field: 'quotation-exchange-rate', message: 'Confirmá un tipo de cambio positivo antes de revisar la inversión.' });
    }
    return issues;
  }

  return [];
}

export function getFirstIncompleteQuotationStep(quotation: QuotationData): QuotationStep | null {
  for (const step of [1, 2, 3, 4, 5] as const) {
    if (validateQuotationStep(step, quotation).length > 0) return step;
  }
  return null;
}

export function getFirstIncompleteQuotationPhase(quotation: QuotationData): QuotationPhase | null {
  for (const phase of [1, 2, 3] as const) {
    if (validateQuotationPhase(phase, quotation).length > 0) return phase;
  }
  return null;
}
