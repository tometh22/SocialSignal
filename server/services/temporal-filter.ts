import { sql, inArray } from 'drizzle-orm';

export type TimeMode = 'month' | 'bimonth' | 'quarter' | 'semester' | 'year' | 'custom';

export interface TimeFilterInput {
  timeMode: TimeMode;
  period?: string;
  year?: number;
  index?: number;
  from?: string;
  to?: string;
  tz?: string;
}

export interface ResolvedPeriod {
  mode: TimeMode;
  start: Date;
  end: Date;
  label: string;
  periodKey: string;
  periodKeys: string[];
  tz: string;
}

function clampEnd(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0);
}

function ym(y: number, m: number): string {
  return `${y}-${String(m).padStart(2, '0')}`;
}

function formatDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function resolvePeriod(input: TimeFilterInput): ResolvedPeriod {
  const tz = input.tz || 'America/Argentina/Buenos_Aires';
  
  let start: Date, end: Date, label = '', periodKey: string;

  if (input.timeMode === 'month') {
    const [y, m] = (input.period ?? '').split('-').map(Number);
    if (!y || !m) {
      throw new Error('Period required for month mode (format: YYYY-MM)');
    }
    start = new Date(y, m - 1, 1);
    end = clampEnd(start);
    label = start.toLocaleString('es-AR', { month: 'long', year: 'numeric' });
    periodKey = ym(y, m);
  }
  else if (input.timeMode === 'bimonth') {
    const y = input.year;
    const idx = input.index;
    if (!y || !idx || idx < 1 || idx > 6) {
      throw new Error('Year and index (1-6) required for bimonth mode');
    }
    const m0 = (idx - 1) * 2 + 1;
    start = new Date(y, m0 - 1, 1);
    end = clampEnd(new Date(y, m0));
    label = `Bimestre ${idx} · ${y}`;
    periodKey = `${ym(y, m0)}..${ym(y, m0 + 1)}`;
  }
  else if (input.timeMode === 'quarter') {
    const y = input.year;
    const q = input.index;
    if (!y || !q || q < 1 || q > 4) {
      throw new Error('Year and index (1-4) required for quarter mode');
    }
    const m0 = (q - 1) * 3 + 1;
    start = new Date(y, m0 - 1, 1);
    end = new Date(y, m0 + 2, 0);
    label = `Q${q} · ${y}`;
    periodKey = `${ym(y, m0)}..${ym(y, m0 + 2)}`;
  }
  else if (input.timeMode === 'semester') {
    const y = input.year;
    const s = input.index;
    if (!y || !s || s < 1 || s > 2) {
      throw new Error('Year and index (1-2) required for semester mode');
    }
    const m0 = s === 1 ? 1 : 7;
    start = new Date(y, m0 - 1, 1);
    end = new Date(y, m0 + 5, 0);
    label = `Semestre ${s} · ${y}`;
    periodKey = `${ym(y, m0)}..${ym(y, m0 + 5)}`;
  }
  else if (input.timeMode === 'year') {
    const y = input.year;
    if (!y) {
      throw new Error('Year required for year mode');
    }
    start = new Date(y, 0, 1);
    end = new Date(y, 11, 31);
    label = `${y}`;
    periodKey = `${y}`;
  }
  else {
    if (!input.from || !input.to) {
      throw new Error('from and to dates required for custom mode');
    }
    start = new Date(input.from);
    end = new Date(input.to);
    
    if (start > end) {
      throw new Error('from date must be before to date');
    }
    
    const diffMonths = (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth());
    if (diffMonths > 24) {
      throw new Error('Custom range cannot exceed 24 months');
    }
    
    label = `${formatDate(start)} → ${formatDate(end)}`;
    periodKey = `${start.toISOString().slice(0, 7)}..${end.toISOString().slice(0, 7)}`;
  }

  const periodKeys = generatePeriodKeys(start, end);

  return { mode: input.timeMode, start, end, label, periodKey, periodKeys, tz };
}

function generatePeriodKeys(start: Date, end: Date): string[] {
  const months: string[] = [];
  const d = new Date(start);
  d.setDate(1);
  
  while (d <= end) {
    months.push(ym(d.getFullYear(), d.getMonth() + 1));
    d.setMonth(d.getMonth() + 1);
  }
  
  return months;
}

export function wherePeriodKey(tablePeriodCol: any, resolved: ResolvedPeriod) {
  if (resolved.periodKeys.length === 1) {
    return sql`${tablePeriodCol} = ${resolved.periodKeys[0]}`;
  }
  return inArray(tablePeriodCol, resolved.periodKeys);
}

export function whereDateRange(dateCol: any, resolved: ResolvedPeriod) {
  const nextDay = new Date(resolved.end);
  nextDay.setDate(nextDay.getDate() + 1);
  return sql`${dateCol} >= ${resolved.start} AND ${dateCol} < ${nextDay}`;
}
