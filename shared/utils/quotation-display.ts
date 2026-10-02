/** Labels for canonical service types and older contracts still in production. */
export function quotationProjectTypeLabel(projectType?: string | null, quotationType?: string | null): string {
  const labels: Record<string, string> = {
    'fee-mensual': 'Fee mensual', 'always-on': 'Always-On', 'credit-pack': 'Bolsa de créditos',
    'monitoring': 'Intelligence Event Track', 'demo': 'Demo',
    'on-demand': 'One-Shot', 'one-shot': 'One-Shot', 'one-time': 'One-Shot',
    'recurring': 'Recurrente', 'fee': 'Fee mensual',
  };
  if (projectType) return labels[projectType] || projectType;
  return quotationType ? labels[quotationType] || quotationType : '—';
}

export function quotationPriceLabel(projectType?: string | null): string {
  return ['fee-mensual', 'always-on'].includes(projectType || '') ? 'Precio mensual' : 'Precio total';
}

export function formatEstimatedHours(hours?: number | null): string {
  return hours == null || !Number.isFinite(hours) || hours < 0 ? '—' : `${hours.toFixed(2)} h`;
}

export function formatQuotationAmount(amount: number | null, currency?: string | null): string {
  if (amount == null || !Number.isFinite(amount)) return '—';
  return new Intl.NumberFormat('es-AR', {
    style: 'currency', currency: currency === 'USD' ? 'USD' : 'ARS',
    currencyDisplay: 'code', maximumFractionDigits: 2,
  }).format(amount);
}

export function quotationPersonnelName(
  member: { personnelId: number | null; personnelName?: string | null },
  personnel: Array<{ id: number; name: string }>,
): string {
  if (!member.personnelId) return 'Sin persona asignada';
  return member.personnelName || personnel.find(person => person.id === member.personnelId)?.name || `Personal ID: ${member.personnelId}`;
}
