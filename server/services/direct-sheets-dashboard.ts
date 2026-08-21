/**
 * Direct Google Sheets Dashboard API
 * Reads Resumen Ejecutivo directly from the spreadsheet - no ETL, no DB.
 * Works exactly like Looker Studio: fetch → parse → display.
 */
import { google } from 'googleapis';
import { StaleDataCache } from '../utils/stale-data-cache';

const SPREADSHEET_ID = '1FZLFmTQQOSYQns2cOYlM86UGEH7EHZsJOFegyDR7quc';
const SHEET_NAME = 'Resumen Ejecutivo';

// Month names for parsing "01 ene", "02 feb", etc.
const MONTH_MAP: Record<string, number> = {
  ene: 1, feb: 2, mar: 3, abr: 4, may: 5, jun: 6,
  jul: 7, ago: 8, sep: 9, oct: 10, nov: 11, dic: 12,
};

function parseMoney(val: string | undefined | null): number | null {
  if (!val || val === '' || val === '-') return null;
  let s = String(val).trim()
    .replace(/\$/g, '')
    .replace(/\s/g, '');
  // Spanish format: 1.234,56 → 1234.56
  if (s.includes(',')) {
    s = s.replace(/\./g, '').replace(',', '.');
  }
  const n = parseFloat(s);
  return isNaN(n) ? null : n;
}

// Activo/Pasivo Total viene pre-calculado en la hoja. Si difiere demasiado de la
// suma de sus partes (bug reportado: "está haciendo alguna multiplicación" /
// tomando ARS como si fuera USD), se prioriza la suma de partes en vez de
// confiar ciegamente en la celda de la hoja.
function reconcileTotal(parts: Array<number | null>, sheetTotal: number | null, label: string): number | null {
  const known = parts.filter((v): v is number => v != null);
  const sum = known.length > 0 ? known.reduce((a, b) => a + b, 0) : null;
  if (sum == null) return sheetTotal;
  if (sheetTotal == null) return sum;
  if (sum === 0) return sheetTotal;
  const ratio = sheetTotal / sum;
  if (ratio < 0.8 || ratio > 1.2) {
    console.warn(
      `[direct-sheets-dashboard] ${label} inconsistente: hoja=${sheetTotal} suma de partes=${sum} (ratio ${ratio.toFixed(2)}). Usando la suma de partes.`
    );
    return sum;
  }
  return sheetTotal;
}

function parsePercent(val: string | undefined | null): number | null {
  if (!val || val === '' || val === '-') return null;
  let s = String(val).trim().replace('%', '').replace(',', '.');
  const n = parseFloat(s);
  return isNaN(n) ? null : n;
}

function parseMonthLabel(label: string): number | null {
  const match = label.match(/(\d{1,2})\s*([a-záéíóú]+)/i);
  if (match) {
    const monthStr = match[2].toLowerCase().slice(0, 3);
    return MONTH_MAP[monthStr] || null;
  }
  return null;
}

/**
 * Detecta la fórmula rota de Beneficio Neto del Resumen Ejecutivo.
 *
 * En los meses sin cerrar (ago–dic 2026 al 2026-08-21) la celda de Beneficio
 * Neto devuelve exactamente las Ventas del mes y el Margen Neto queda en 100%:
 * la fórmula no está restando ningún costo. El dashboard sumaba esas cinco
 * celdas y mostraba 332.145 de beneficio neto anual cuando el real ronda −21k.
 *
 * No es un dato conservador ni optimista: es la venta disfrazada de resultado.
 * Sumarla es peor que no tener el dato.
 */
/**
 * La columna "Cierre" del Resumen Ejecutivo NO es un flag: contiene la fecha de
 * cierre del mes ("31-3-2025"). El parser la comparaba contra ['sí','true','x',…]
 * y nunca matcheaba, así que `cierre` era false en los 24 meses — incluidos los
 * de 2025, que están cerrados hace rato.
 *
 * Un mes está cerrado cuando su fecha de cierre ya pasó.
 */
export function parseCierre(raw: string | undefined | null, hoy: Date): boolean {
  const value = String(raw ?? '').trim();
  if (!value) return false;

  const m = value.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/);
  if (!m) {
    // Formatos viejos que sí eran booleanos, por si quedan filas legacy.
    return ['sí', 'si', 'true', 'verdadero', '1', 'yes', 'x', '✓', 'ok', 'cerrado']
      .includes(value.toLowerCase());
  }

  const [, d, mo, y] = m;
  const fecha = new Date(Number(y), Number(mo) - 1, Number(d));
  if (isNaN(fecha.getTime())) return false;
  return fecha.getTime() <= hoy.getTime();
}

export function isBrokenNetProfit(
  beneficioNeto: number | null,
  ventasDelMes: number | null,
  margenNeto: number | null,
): boolean {
  if (beneficioNeto == null || ventasDelMes == null) return false;
  if (ventasDelMes === 0) return false;
  const igualAVentas = Math.abs(beneficioNeto - ventasDelMes) < 0.01;
  const margenCien = margenNeto != null && Math.abs(margenNeto - 100) < 0.01;
  return igualAVentas && margenCien;
}

interface MonthData {
  periodKey: string;
  year: number;
  month: number;
  monthLabel: string;
  cierre: boolean;
  /** true si la celda de Beneficio Neto del Excel está rota (ver isBrokenNetProfit). */
  beneficioNetoRoto?: boolean;
  /** Sólo en agregados: el beneficio neto no cubre todos los meses del período. */
  beneficioNetoParcial?: boolean;
  /** Sólo en agregados: meses excluidos del beneficio neto por celda rota. */
  mesesSinBeneficioNeto?: string[];
  /** Sólo en agregados: cuántos meses entraron al total. */
  mesesAgregados?: number;
  /** Sólo en agregados: período del que sale la foto de balance. */
  balancePeriodKey?: string | null;
  balanceMonthLabel?: string | null;
  /** true si la foto de balance NO es del último mes del período. */
  balanceDesactualizado?: boolean;
  /** Sólo en agregados anuales: cuántos meses ya cerraron y cuántos son proyección. */
  mesesCerrados?: number;
  mesesProyectados?: number;
  /**
   * Markup de los meses proyectados, separado del de ejecución. El markup mide
   * eficiencia de ejecución; mezclarlo con meses no ejecutados lo distorsiona.
   */
  markupProyectado?: number | null;
  markupMesesCerrados?: number;
  markupMesesProyectados?: number;
  // P&L
  ventasDelMes: number | null;
  ebitOperativo: number | null;
  beneficioNeto: number | null;
  margenOperativo: number | null;
  margenNeto: number | null;
  markup: number | null;
  proyeccionResultado: number | null;
  // Balance
  activoLiquido: number | null;
  activoMedPlazo: number | null;
  clientesACobrar: number | null;
  activoTotal: number | null;
  pasivoImpuestosUSA: number | null;
  pasivoFacturacionAdelantada: number | null;
  pasivoProveedores: number | null;
  pasivoTotal: number | null;
  balanceNeto: number | null;
  // Cashflow
  cashflow: number | null;
  cashflow60Dias: number | null;
}

function createSheetsClient() {
  let privateKey = process.env.GOOGLE_PRIVATE_KEY || '';
  if (privateKey.startsWith('"') && privateKey.endsWith('"')) {
    privateKey = privateKey.slice(1, -1);
  }
  privateKey = privateKey.replace(/\\n/g, '\n');

  const auth = new google.auth.GoogleAuth({
    credentials: {
      type: 'service_account',
      project_id: process.env.GOOGLE_PROJECT_ID || 'focal-utility-318020',
      private_key_id: process.env.GOOGLE_PRIVATE_KEY_ID,
      private_key: privateKey,
      client_email: process.env.GOOGLE_CLIENT_EMAIL,
      client_id: process.env.GOOGLE_CLIENT_ID,
    },
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
  });

  return google.sheets({ version: 'v4', auth });
}

// Generic aggregation for any set of months (used by quarter, year-total, etc.)
function aggregateMonths(
  months: MonthData[],
  periodKey: string,
  monthLabel: string,
  year: number,
  month: number
): MonthData | null {
  if (months.length === 0) return null;

  const sorted = [...months].sort((a, b) => a.periodKey.localeCompare(b.periodKey));
  const last = sorted[sorted.length - 1];

  /**
   * Activo y Pasivo son SNAPSHOTS, no flujos: no se suman, se toma una foto.
   *
   * Antes se usaba el último mes del período sin más. Para un año en curso ese
   * mes está vacío — al 2026-08-21, dic-2026 no tiene balance — y toda la
   * sección Balance quedaba en blanco. Con 2025 funcionaba de casualidad,
   * porque dic-2025 sí estaba cargado.
   *
   * Además hay meses abiertos que traen 0,00 en vez de vacío (ago-2026): un
   * cero tampoco es un balance, es un placeholder. Por eso se exige que al
   * menos una de las tres patas sea distinta de cero.
   */
  const tieneBalance = (m: MonthData) =>
    m.activoTotal != null &&
    (m.activoTotal !== 0 || (m.pasivoTotal ?? 0) !== 0 || (m.clientesACobrar ?? 0) !== 0);

  const conBalance = sorted.filter(tieneBalance);
  const snapshot = conBalance.length > 0 ? conBalance[conBalance.length - 1] : last;

  const sumField = (key: 'ventasDelMes' | 'ebitOperativo' | 'beneficioNeto' | 'cashflow'): number | null => {
    const vals = sorted.map(m => m[key]).filter((v): v is number => v != null);
    return vals.length > 0 ? vals.reduce((a, b) => a + b, 0) : null;
  };

  const ventasDelMes = sumField('ventasDelMes');
  const ebitOperativo = sumField('ebitOperativo');
  const beneficioNeto = sumField('beneficioNeto');
  const cashflow = sumField('cashflow');

  const margenOperativo = ventasDelMes ? (ebitOperativo ?? 0) / ventasDelMes * 100 : null;
  const margenNeto = ventasDelMes ? (beneficioNeto ?? 0) / ventasDelMes * 100 : null;

  /**
   * Markup de un período multi-mes: media armónica ponderada por ventas.
   *   markup_i = ventas_i / costos_directos_i  →  CD_i = ventas_i / markup_i
   *   markup   = sum(ventas_i) / sum(CD_i)
   *
   * Se calcula por separado sobre meses CERRADOS y meses PROYECTADOS.
   *
   * Motivo: el markup mide eficiencia de ejecución, y no tiene sentido medir la
   * de meses que todavía no se ejecutaron. Además la planilla usa otra base de
   * costo en los meses abiertos — al 2026-08-21 traía markup 0,76 / 0,85 / 0,84
   * / 0,87 (vender por debajo del costo directo), y mezclarlos hundía el anual
   * de 3,62 a 1,88 contra un estándar de 2,5.
   */
  const markupDe = (ms: MonthData[]): number | null => {
    const validos = ms.filter(m => m.ventasDelMes != null && m.markup != null && m.markup > 0);
    if (validos.length === 0) return null;
    const ventas = validos.reduce((a, m) => a + (m.ventasDelMes as number), 0);
    const costosDirectos = validos.reduce((a, m) => a + (m.ventasDelMes as number) / (m.markup as number), 0);
    return costosDirectos > 0 ? Math.round((ventas / costosDirectos) * 100) / 100 : null;
  };

  const mesesCerradosArr = sorted.filter(m => m.cierre);
  const mesesProyectadosArr = sorted.filter(m => !m.cierre);

  // Si ningún mes está marcado como cerrado, no hay nada que separar: el markup
  // se calcula sobre todo el período, como antes.
  const markup = mesesCerradosArr.length > 0 ? markupDe(mesesCerradosArr) : markupDe(sorted);
  const markupProyectado = mesesCerradosArr.length > 0 ? markupDe(mesesProyectadosArr) : null;

  // Un total parcial no puede presentarse como total. Si algún mes quedó fuera
  // porque su celda estaba rota, el agregado lo declara para que la vista lo
  // etiquete en vez de mostrar un número que no cubre el período completo.
  const mesesSinBeneficioNeto = sorted
    .filter(m => m.beneficioNetoRoto)
    .map(m => m.monthLabel);

  return {
    periodKey,
    year,
    month,
    monthLabel,
    cierre: true,
    ventasDelMes,
    ebitOperativo,
    beneficioNeto,
    beneficioNetoParcial: mesesSinBeneficioNeto.length > 0,
    mesesSinBeneficioNeto,
    mesesAgregados: sorted.length,
    margenOperativo,
    margenNeto,
    markup,
    markupProyectado,
    markupMesesCerrados: mesesCerradosArr.length,
    markupMesesProyectados: mesesProyectadosArr.length,
    proyeccionResultado: last.proyeccionResultado,
    // Balance: foto del último mes CON datos, no del último del calendario.
    activoLiquido: snapshot.activoLiquido,
    activoMedPlazo: snapshot.activoMedPlazo,
    clientesACobrar: snapshot.clientesACobrar,
    activoTotal: snapshot.activoTotal,
    pasivoImpuestosUSA: snapshot.pasivoImpuestosUSA,
    pasivoFacturacionAdelantada: snapshot.pasivoFacturacionAdelantada,
    pasivoProveedores: snapshot.pasivoProveedores,
    pasivoTotal: snapshot.pasivoTotal,
    balanceNeto: snapshot.balanceNeto,
    // Un balance sin su fecha induce a error: puede ser de hace cinco meses.
    balancePeriodKey: conBalance.length > 0 ? snapshot.periodKey : null,
    balanceMonthLabel: conBalance.length > 0 ? snapshot.monthLabel : null,
    balanceDesactualizado: conBalance.length > 0 && snapshot.periodKey !== last.periodKey,
    cashflow,
    cashflow60Dias: snapshot.cashflow60Dias,
  };
}

const DASHBOARD_CACHE_TTL_MS = 5 * 60 * 1000;
const DASHBOARD_STALE_TTL_MS = 60 * 60 * 1000;
let dashboardCacheStatus = { stale: false, fetchedAt: null as number | null };

async function fetchDashboardRows(): Promise<MonthData[]> {
  const sheets = createSheetsClient();
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `'${SHEET_NAME}'!A:W`,
    valueRenderOption: 'FORMATTED_VALUE',
  });

  const rows = response.data.values;
  if (!rows || rows.length < 2) return [];

  const COL = {
    MES: 0, AÑO: 1, CIERRE: 2,
    ACTIVO_LIQUIDO: 3, ACTIVO_MP_CRYPTO: 4, CLIENTES_COBRAR: 5, ACTIVO_TOTAL: 6,
    PASIVO_IMP_USA: 7, PASIVO_FACT_ADEL: 8, PASIVO_PROVEEDORES: 9, PASIVO_TOTAL: 10,
    BALANCE_NETO: 11,
    VENTAS: 13, EBIT: 14, BENEFICIO_NETO: 15,
    MARGEN_OP: 16, MARGEN_NETO: 17, MARKUP: 18,
    PROYECCION: 19, CASHFLOW: 20, CASHFLOW_60: 21,
  };
  const allData: MonthData[] = [];

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.length < 2) continue;
    const mesLabel = String(row[COL.MES] || '').trim();
    const yearStr = String(row[COL.AÑO] || '').trim();
    if (!mesLabel || !yearStr) continue;
    const month = parseMonthLabel(mesLabel);
    const year = parseInt(yearStr);
    if (!month || isNaN(year)) continue;
    const periodKey = `${year}-${String(month).padStart(2, '0')}`;
    const cierre = parseCierre(row[COL.CIERRE], new Date());
    const ventasDelMes = parseMoney(row[COL.VENTAS]);
    const ebitOperativo = parseMoney(row[COL.EBIT]);
    const sheetMarkup = parseMoney(row[COL.MARKUP]);
    const impliedCosts = ventasDelMes != null && ebitOperativo != null ? ventasDelMes - ebitOperativo : null;
    const markup = sheetMarkup ?? (ventasDelMes != null && impliedCosts != null && impliedCosts > 0
      ? Math.round((ventasDelMes / impliedCosts) * 100) / 100
      : null);

    const activoLiquido = parseMoney(row[COL.ACTIVO_LIQUIDO]);
    const activoMedPlazo = parseMoney(row[COL.ACTIVO_MP_CRYPTO]);
    const clientesACobrar = parseMoney(row[COL.CLIENTES_COBRAR]);
    const pasivoImpuestosUSA = parseMoney(row[COL.PASIVO_IMP_USA]);
    const pasivoFacturacionAdelantada = parseMoney(row[COL.PASIVO_FACT_ADEL]);
    const pasivoProveedores = parseMoney(row[COL.PASIVO_PROVEEDORES]);

    const beneficioNetoRaw = parseMoney(row[COL.BENEFICIO_NETO]);
    const margenNetoRaw = parsePercent(row[COL.MARGEN_NETO]);
    const beneficioNetoRoto = isBrokenNetProfit(beneficioNetoRaw, ventasDelMes, margenNetoRaw);
    if (beneficioNetoRoto) {
      console.warn(
        `⚠️ [Resumen Ejecutivo] ${periodKey}: Beneficio Neto == Ventas y margen 100% — fórmula rota en la planilla, se excluye del agregado`,
      );
    }

    allData.push({
      periodKey,
      year,
      month,
      monthLabel: mesLabel,
      cierre,
      beneficioNetoRoto,
      ventasDelMes,
      ebitOperativo,
      // La celda rota no se propaga: null significa "sin dato", que es la verdad.
      beneficioNeto: beneficioNetoRoto ? null : beneficioNetoRaw,
      margenOperativo: parsePercent(row[COL.MARGEN_OP]),
      margenNeto: beneficioNetoRoto ? null : margenNetoRaw,
      markup,
      proyeccionResultado: parseMoney(row[COL.PROYECCION]),
      activoLiquido,
      activoMedPlazo,
      clientesACobrar,
      activoTotal: reconcileTotal(
        [activoLiquido, activoMedPlazo, clientesACobrar],
        parseMoney(row[COL.ACTIVO_TOTAL]),
        `Activo Total (${periodKey})`
      ),
      pasivoImpuestosUSA,
      pasivoFacturacionAdelantada,
      pasivoProveedores,
      pasivoTotal: reconcileTotal(
        [pasivoImpuestosUSA, pasivoFacturacionAdelantada, pasivoProveedores],
        parseMoney(row[COL.PASIVO_TOTAL]),
        `Pasivo Total (${periodKey})`
      ),
      balanceNeto: parseMoney(row[COL.BALANCE_NETO]),
      cashflow: parseMoney(row[COL.CASHFLOW]),
      cashflow60Dias: parseMoney(row[COL.CASHFLOW_60]),
    });
  }
  return allData;
}

const dashboardDataCache = new StaleDataCache(
  fetchDashboardRows,
  DASHBOARD_CACHE_TTL_MS,
  DASHBOARD_STALE_TTL_MS,
  Date.now,
  (error) => {
    console.warn(
      '⚠️ Dashboard refresh failed; stale snapshot retained:',
      error instanceof Error ? error.message : error,
    );
  },
);

export function getExecutiveDashboardCacheStatus() {
  return dashboardCacheStatus;
}

export async function fetchResumenEjecutivoDirectly(
  filterYear?: number,
  filterMonth?: number,
  filterQuarter?: number,
  filterYearTotal?: boolean,
  filterStartYear?: number,
  filterStartMonth?: number,
  filterEndYear?: number,
  filterEndMonth?: number,
): Promise<{ data: MonthData[]; filtered: MonthData | null; available: string[] }> {
  const cached = await dashboardDataCache.get();
  dashboardCacheStatus = { stale: cached.stale, fetchedAt: cached.fetchedAt };
  const allData = cached.data;

  // Filter
  const available = allData.map(d => d.periodKey);
  let filtered: MonthData | null = null;

  if (filterYear && filterYearTotal) {
    // Year-to-date: only months marked as closed (Cierre = true)
    // El total anual incluye TODOS los meses con facturación cargada, cerrados y
    // proyectados. Filtrar por `cierre` daría un "año" que se corta en agosto.
    // La distinción se expone en mesesCerrados/mesesProyectados para que la
    // vista pueda etiquetarla en vez de esconderla.
    const monthsToAggregate = allData
      .filter(d => d.year === filterYear && d.ventasDelMes != null)
      .sort((a, b) => a.month - b.month);
    const lastMonth = monthsToAggregate.length > 0 ? monthsToAggregate[monthsToAggregate.length - 1].month : 12;
    const lastMonthLabel = monthsToAggregate.length > 0 ? monthsToAggregate[monthsToAggregate.length - 1].monthLabel : `Dic ${filterYear}`;
    filtered = aggregateMonths(
      monthsToAggregate,
      `${filterYear}-YTD`,
      `Año ${filterYear}`,
      filterYear,
      lastMonth
    );
    // Annotate the period badge label with the actual range
    if (filtered) {
      (filtered as any)._ytdLastMonthLabel = lastMonthLabel;
      (filtered as any)._ytdMonthCount = monthsToAggregate.length;
      (filtered as any).mesesCerrados = monthsToAggregate.filter(d => d.cierre).length;
      (filtered as any).mesesProyectados = monthsToAggregate.filter(d => !d.cierre).length;
    }
  } else if (filterYear && filterQuarter && filterQuarter >= 1 && filterQuarter <= 4) {
    const q0 = (filterQuarter - 1) * 3 + 1;
    const allQuarterMonths = allData.filter(d => d.year === filterYear && d.month >= q0 && d.month <= q0 + 2);
    // Only aggregate closed months; fall back to all quarter months if none are marked closed
    const closedQuarterMonths = allQuarterMonths.filter(d => d.cierre);
    const quarterMonths = closedQuarterMonths.length > 0 ? closedQuarterMonths : allQuarterMonths;
    filtered = aggregateMonths(
      quarterMonths,
      `${filterYear}-Q${filterQuarter}`,
      `Q${filterQuarter} ${filterYear}`,
      filterYear,
      q0
    );
    if (filtered) {
      (filtered as any)._closedMonthCount = quarterMonths.length;
    }
  } else if (
    filterStartYear != null && filterStartMonth != null &&
    filterEndYear != null && filterEndMonth != null
  ) {
    // Custom range: all months between start and end inclusive (regardless of cierre)
    const startKey = `${filterStartYear}-${String(filterStartMonth).padStart(2, '0')}`;
    const endKey = `${filterEndYear}-${String(filterEndMonth).padStart(2, '0')}`;
    const rangeMonths = allData
      .filter(d => d.periodKey >= startKey && d.periodKey <= endKey)
      .sort((a, b) => a.periodKey.localeCompare(b.periodKey));
    const rangeKey = `${startKey}:${endKey}`;
    filtered = aggregateMonths(
      rangeMonths,
      rangeKey,
      `${startKey} → ${endKey}`,
      filterEndYear,
      filterEndMonth
    );
    if (filtered) {
      (filtered as any)._rangeStart = startKey;
      (filtered as any)._rangeEnd = endKey;
      (filtered as any)._rangeMonthCount = rangeMonths.length;
    }
  } else if (filterYear && filterMonth) {
    const key = `${filterYear}-${String(filterMonth).padStart(2, '0')}`;
    filtered = allData.find(d => d.periodKey === key) || null;
  }

  if (!filtered && allData.length > 0) {
    // Fallback to latest with ventas data
    filtered = [...allData].reverse().find(d => d.ventasDelMes != null) || allData[allData.length - 1];
  }

  return { data: allData, filtered, available };
}
