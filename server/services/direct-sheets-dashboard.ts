/**
 * Direct Google Sheets Dashboard API
 * Reads Resumen Ejecutivo directly from the spreadsheet - no ETL, no DB.
 * Works exactly like Looker Studio: fetch → parse → display.
 */
import { google } from 'googleapis';

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

interface MonthData {
  periodKey: string;
  year: number;
  month: number;
  monthLabel: string;
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

  const markupVals = sorted.map(m => m.markup).filter((v): v is number => v != null);
  const markup = markupVals.length > 0 ? markupVals.reduce((a, b) => a + b, 0) / markupVals.length : null;

  return {
    periodKey,
    year,
    month,
    monthLabel,
    ventasDelMes,
    ebitOperativo,
    beneficioNeto,
    margenOperativo,
    margenNeto,
    markup,
    proyeccionResultado: last.proyeccionResultado,
    // Balance fields are snapshots — use last available month
    activoLiquido: last.activoLiquido,
    activoMedPlazo: last.activoMedPlazo,
    clientesACobrar: last.clientesACobrar,
    activoTotal: last.activoTotal,
    pasivoImpuestosUSA: last.pasivoImpuestosUSA,
    pasivoFacturacionAdelantada: last.pasivoFacturacionAdelantada,
    pasivoProveedores: last.pasivoProveedores,
    pasivoTotal: last.pasivoTotal,
    balanceNeto: last.balanceNeto,
    cashflow,
    cashflow60Dias: last.cashflow60Dias,
  };
}

export async function fetchResumenEjecutivoDirectly(
  filterYear?: number,
  filterMonth?: number,
  filterQuarter?: number,
  filterYearTotal?: boolean
): Promise<{ data: MonthData[]; filtered: MonthData | null; available: string[] }> {
  const sheets = createSheetsClient();
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `'${SHEET_NAME}'!A:W`,
    valueRenderOption: 'FORMATTED_VALUE',
  });

  const rows = response.data.values;
  if (!rows || rows.length < 2) {
    return { data: [], filtered: null, available: [] };
  }

  // Column indices based on actual Excel structure (verified from debug endpoint)
  // [0]Mes [1]Año [2]Cierre [3]Activo Líquido [4]Activo MP Crypto [5]Activo MP Clientes
  // [6]Activo Total [7]Pasivo Impuestos USA [8]Provisión Pasivo Facturación [9]Pasivo Proveedores
  // [10]Pasivo Total [11]Balance Neto [12]Balance 60d [13]Ventas del mes [14]EBIT
  // [15]Beneficio Neto [16]Margen operativo [17]Margen Neto [18]MarkUp
  // [19]Proyección resultado [20]Chasflow [21]CashFlow+60días [22]NOTAS
  const COL = {
    MES: 0, AÑO: 1,
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

    const ventasDelMes = parseMoney(row[COL.VENTAS]);
    const ebitOperativo = parseMoney(row[COL.EBIT]);
    const sheetMarkup = parseMoney(row[COL.MARKUP]);
    // Fallback: derive markup from ventas and implicit costs when sheet value is missing
    const impliedCosts = ventasDelMes != null && ebitOperativo != null ? ventasDelMes - ebitOperativo : null;
    const markup = sheetMarkup ?? (ventasDelMes != null && impliedCosts != null && impliedCosts > 0
      ? Math.round((ventasDelMes / impliedCosts) * 100) / 100
      : null);

    allData.push({
      periodKey,
      year,
      month,
      monthLabel: mesLabel,
      // P&L
      ventasDelMes,
      ebitOperativo,
      beneficioNeto: parseMoney(row[COL.BENEFICIO_NETO]),
      margenOperativo: parsePercent(row[COL.MARGEN_OP]),
      margenNeto: parsePercent(row[COL.MARGEN_NETO]),
      markup,
      proyeccionResultado: parseMoney(row[COL.PROYECCION]),
      // Balance
      activoLiquido: parseMoney(row[COL.ACTIVO_LIQUIDO]),
      activoMedPlazo: parseMoney(row[COL.ACTIVO_MP_CRYPTO]),
      clientesACobrar: parseMoney(row[COL.CLIENTES_COBRAR]),
      activoTotal: parseMoney(row[COL.ACTIVO_TOTAL]),
      pasivoImpuestosUSA: parseMoney(row[COL.PASIVO_IMP_USA]),
      pasivoFacturacionAdelantada: parseMoney(row[COL.PASIVO_FACT_ADEL]),
      pasivoProveedores: parseMoney(row[COL.PASIVO_PROVEEDORES]),
      pasivoTotal: parseMoney(row[COL.PASIVO_TOTAL]),
      balanceNeto: parseMoney(row[COL.BALANCE_NETO]),
      // Cashflow
      cashflow: parseMoney(row[COL.CASHFLOW]),
      cashflow60Dias: parseMoney(row[COL.CASHFLOW_60]),
    });
  }

  // Filter
  const available = allData.map(d => d.periodKey);
  let filtered: MonthData | null = null;

  if (filterYear && filterYearTotal) {
    // Year-to-date: Jan through latest available month of the year
    const yearMonths = allData
      .filter(d => d.year === filterYear)
      .sort((a, b) => a.month - b.month);
    const lastMonth = yearMonths.length > 0 ? yearMonths[yearMonths.length - 1].month : 12;
    filtered = aggregateMonths(
      yearMonths,
      `${filterYear}-YTD`,
      `Año ${filterYear}`,
      filterYear,
      lastMonth
    );
  } else if (filterYear && filterQuarter && filterQuarter >= 1 && filterQuarter <= 4) {
    const q0 = (filterQuarter - 1) * 3 + 1;
    const quarterMonths = allData.filter(d => d.year === filterYear && d.month >= q0 && d.month <= q0 + 2);
    filtered = aggregateMonths(
      quarterMonths,
      `${filterYear}-Q${filterQuarter}`,
      `Q${filterQuarter} ${filterYear}`,
      filterYear,
      q0
    );
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
