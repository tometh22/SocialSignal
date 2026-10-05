// Sincroniza tarifas mes-a-mes desde la pestaña "Valor Hora Real y Estimada"
// del master a las columnas {mmm}{yyyy}HourlyRateARS de personnel.
//
// Por ahora limitado a la sección 2026. La estructura del sheet es:
//
//   Row N:   "2026" | "Detalle" | "Ajuste" | "Valor Hora Ajustada" | "Ajuste" | "Valor Hora Ajustada" | ...
//   Row N+1:        | "01 ene 2026" | "01 ene 2026" | "01 ene 2026" | "02 feb 2026" | "02 feb 2026" | ...
//   Row N+2: <persona> | ... datos por mes ...
//
// La fecha bajo cada par "Ajuste / Valor Hora Ajustada" indica el mes al que
// corresponde la tarifa (NO el mes de pago). "01 ene 2026" → jan2026.

import { google } from "googleapis";
import * as fs from "fs";

const SPREADSHEET_ID = "1FZLFmTQQOSYQns2cOYlM86UGEH7EHZsJOFegyDR7quc";
const SHEET_TAB = "Valor Hora Real y Estimada";
const READ_RANGE = `'${SHEET_TAB}'!A1:AZ200`;
const PERSONNEL_METADATA_RANGE = "A1:Z500";

const SPANISH_MONTHS: Record<string, string> = {
  ene: "jan", feb: "feb", mar: "mar", abr: "apr",
  may: "may", jun: "jun", jul: "jul", ago: "aug",
  sep: "sep", oct: "oct", nov: "nov", dic: "dec",
};

export interface ParsedSheetRow {
  sheetName: string;
  monthlyRates: Record<string, number>; // { jan2026: 11562.5, feb2026: 12137.85, ... }
  // Optional comparison-only values. When the Master exposes a monthly salary,
  // synchronization never writes it directly: it is checked against
  // hourly-rate × hours and a persistent warning is emitted on mismatch.
  monthlySalaries?: Record<string, number>;
  currentRole?: string | null;
  sublevel?: string | null;
  legacyRole?: string | null;
  area?: string | null;
}

export interface ParsedPersonnelMetadata {
  sheetName: string;
  email?: string | null;
  currentRole?: string | null;
  sublevel?: string | null;
  legacyRole?: string | null;
  area?: string | null;
}

export type SheetsLayoutErrorCode = "SECTION_NOT_FOUND" | "HEADERS_NOT_FOUND";

/** El Sheet se leyó bien pero la sección de ese año no existe o tiene otro layout. */
export class SheetsLayoutError extends Error {
  constructor(public readonly code: SheetsLayoutErrorCode, public readonly year: number, message: string) {
    super(message);
    this.name = "SheetsLayoutError";
  }
}

/**
 * Convierte los errores de Google en una respuesta segura y accionable para la
 * interfaz. En particular, invalid_grant suele significar que Railway tiene
 * una clave vencida/malformada: reintentar sin corregir la variable sólo
 * confunde al usuario y puede dar la impresión de que el sync se aplicó.
 */
export function describeSheetsSyncError(error: unknown, currentYear = Number(new Intl.DateTimeFormat("en-CA", { timeZone: "America/Argentina/Buenos_Aires", year: "numeric" }).format(new Date()))) {
  const detail = error instanceof Error ? error.message : String(error ?? "");
  if (error instanceof SheetsLayoutError) {
    // Un año futuro todavía sin cargar en el Máster es esperable: no es un fallo.
    const pendingFutureYear = error.year > currentYear;
    return {
      code: error.code as string,
      message: error.code === "SECTION_NOT_FOUND"
        ? `La pestaña del Máster todavía no tiene la sección ${error.year}.`
        : `La sección ${error.year} del Máster no tiene columnas de valor hora reconocibles.`,
      action: pendingFutureYear
        ? "Se sincronizará cuando Finanzas cargue ese año en el Máster."
        : "Revisá el layout de esa sección en el Máster y volvé a intentar.",
      detail,
      retryable: false,
      severity: (pendingFutureYear && error.code === "SECTION_NOT_FOUND" ? "info" : "error") as "info" | "error",
    };
  }
  const normalized = detail.toLowerCase();
  if (normalized.includes("invalid_grant") || normalized.includes("invalid jwt") || normalized.includes("jwt signature")) {
    return {
      code: "GOOGLE_AUTH_INVALID",
      message: "Google rechazó las credenciales del Máster. Verificá GOOGLE_CLIENT_EMAIL y GOOGLE_PRIVATE_KEY en Railway, y que esa cuenta tenga acceso al Google Sheet.",
      action: "Corregí las variables en Railway y volvé a intentar. No se aplicaron cambios.",
      detail,
      retryable: false,
      severity: "error" as "info" | "error",
    };
  }

  return {
    code: "GOOGLE_SYNC_FAILED",
    message: "No se pudo leer Google Sheets. No se aplicaron cambios.",
    action: "Revisá el acceso al Sheet y volvé a intentar.",
    detail,
    retryable: true,
    severity: "error" as "info" | "error",
  };
}

function buildSheetsClient() {
  let credentials: any;
  if (process.env.GOOGLE_PRIVATE_KEY && process.env.GOOGLE_CLIENT_EMAIL) {
    let privateKey = process.env.GOOGLE_PRIVATE_KEY;
    if (privateKey.startsWith('"') && privateKey.endsWith('"')) {
      privateKey = privateKey.slice(1, -1);
    }
    privateKey = privateKey.replace(/\\n/g, "\n");
    credentials = {
      type: "service_account",
      project_id: process.env.GOOGLE_PROJECT_ID || "focal-utility-318020",
      private_key_id: process.env.GOOGLE_PRIVATE_KEY_ID,
      private_key: privateKey,
      client_email: process.env.GOOGLE_CLIENT_EMAIL,
      client_id: process.env.GOOGLE_CLIENT_ID,
      auth_uri: "https://accounts.google.com/o/oauth2/auth",
      token_uri: "https://oauth2.googleapis.com/token",
    };
  } else {
    const candidates = [
      "attached_assets/focal-utility-318020-e2defb839c83_1754064776295.json",
      "focal-utility-318020-e2defb839c83.json",
    ];
    const path = candidates.find((p) => fs.existsSync(p));
    if (!path) {
      throw new Error("Faltan credenciales de Google (env vars o JSON file).");
    }
    credentials = JSON.parse(fs.readFileSync(path, "utf8"));
  }

  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
  });
  return google.sheets({ version: "v4", auth });
}

// Parsea valores estilo "$11.562,50" (es-AR) o "$11,562.50" (en-US).
// Devuelve null si la celda no es un número válido > 0.
export function parseMoney(raw: unknown): number | null {
  if (raw === null || raw === undefined) return null;
  let s = String(raw).trim();
  if (!s) return null;
  s = s.replace(/[$\s]/g, "").replace(/ARS/gi, "");
  const hasComma = s.includes(",");
  const hasDot = s.includes(".");
  if (hasComma && hasDot) {
    if (s.lastIndexOf(",") > s.lastIndexOf(".")) {
      s = s.replace(/\./g, "").replace(",", ".");
    } else {
      s = s.replace(/,/g, "");
    }
  } else if (hasComma) {
    s = s.replace(",", ".");
  } else if (hasDot && /^\d{1,3}(?:\.\d{3})+$/.test(s)) {
    // Argentine thousands notation without decimal separator: 10.000.
    s = s.replace(/\./g, "");
  }
  const n = parseFloat(s);
  return isFinite(n) && n > 0 ? n : null;
}

function normalizeHeader(raw: unknown): string {
  return String(raw ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/**
 * Parses the personnel catalogue independently from the hourly-rate tab.
 * The Master keeps Nombre/Mail/Rol viejo/Estado/Rol/Subnivel in a separate
 * table, whose tab name can change. Header-based discovery avoids coupling
 * the synchronization contract to a particular tab or column position.
 */
export function parsePersonnelMetadataGrid(rows: string[][]): ParsedPersonnelMetadata[] {
  const headerAliases = {
    name: new Set(["nombre", "nombre completo", "persona", "personal"]),
    email: new Set(["mail", "email", "correo", "correo electronico"]),
    currentRole: new Set(["rol", "role", "rol actual"]),
    sublevel: new Set(["subnivel", "sublevel", "sub nivel"]),
    legacyRole: new Set(["rol viejo", "rol anterior", "legacy role"]),
    area: new Set(["area", "equipo", "departamento"]),
  };
  const findColumn = (headers: string[], aliases: Set<string>) =>
    headers.findIndex((header) => aliases.has(header));

  for (let headerRow = 0; headerRow < Math.min(rows.length, 50); headerRow++) {
    const headers = (rows[headerRow] ?? []).map(normalizeHeader);
    const nameCol = findColumn(headers, headerAliases.name);
    const roleCol = findColumn(headers, headerAliases.currentRole);
    const sublevelCol = findColumn(headers, headerAliases.sublevel);
    const legacyRoleCol = findColumn(headers, headerAliases.legacyRole);
    const areaCol = findColumn(headers, headerAliases.area);
    if (nameCol < 0 || (roleCol < 0 && sublevelCol < 0 && legacyRoleCol < 0 && areaCol < 0)) continue;

    const emailCol = findColumn(headers, headerAliases.email);
    const parsed: ParsedPersonnelMetadata[] = [];
    for (let rowIndex = headerRow + 1; rowIndex < rows.length; rowIndex++) {
      const row = rows[rowIndex] ?? [];
      const sheetName = String(row[nameCol] ?? "").trim();
      if (!sheetName) continue;
      const cell = (column: number) => column >= 0 ? String(row[column] ?? "").trim() || null : null;
      parsed.push({
        sheetName,
        email: cell(emailCol),
        currentRole: cell(roleCol),
        sublevel: cell(sublevelCol),
        legacyRole: cell(legacyRoleCol),
        ...(areaCol >= 0 ? { area: cell(areaCol) } : {}),
      });
    }
    return parsed;
  }

  return [];
}

export function mergePersonnelMetadata(
  rateRows: ParsedSheetRow[],
  metadataRows: ParsedPersonnelMetadata[],
): ParsedSheetRow[] {
  const metadataByName = new Map<string, ParsedPersonnelMetadata>();
  for (const metadata of metadataRows) {
    const key = normalizeName(metadata.sheetName);
    const current = metadataByName.get(key);
    const merged: ParsedPersonnelMetadata = {
      sheetName: current?.sheetName ?? metadata.sheetName,
      email: current?.email ?? metadata.email ?? null,
      currentRole: current?.currentRole ?? metadata.currentRole ?? null,
      sublevel: current?.sublevel ?? metadata.sublevel ?? null,
      legacyRole: current?.legacyRole ?? metadata.legacyRole ?? null,
    };
    if (current?.area != null || metadata.area != null) merged.area = current?.area ?? metadata.area ?? null;
    metadataByName.set(key, merged);
  }

  return rateRows.map((row) => {
    const metadata = metadataByName.get(normalizeName(row.sheetName));
    if (!metadata) return row;
    return {
      ...row,
      currentRole: row.currentRole ?? metadata.currentRole ?? null,
      sublevel: row.sublevel ?? metadata.sublevel ?? null,
      legacyRole: row.legacyRole ?? metadata.legacyRole ?? null,
      ...(row.area != null || metadata.area != null ? { area: row.area ?? metadata.area ?? null } : {}),
    };
  });
}

export function parseValorHoraSection(
  rows: string[][],
  year: number,
  options: { allowEstimatedFallback?: boolean } = {},
): ParsedSheetRow[] {
  const yearStr = String(year);
  // Buscar la celda que contiene el label del año en cualquiera de las primeras
  // dos columnas. La columna donde aparece "2026" es la misma donde luego
  // viven los nombres de las personas — esa es la pista clave para nameCol.
  let yearRowIdx = -1;
  let yearCol = -1;
  for (let i = 0; i < rows.length && yearRowIdx < 0; i++) {
    for (let c = 0; c < Math.min(2, rows[i]?.length ?? 0); c++) {
      if (String(rows[i]?.[c] ?? "").trim() === yearStr) {
        yearRowIdx = i;
        yearCol = c;
        break;
      }
    }
  }
  if (yearRowIdx < 0) {
    throw new SheetsLayoutError("SECTION_NOT_FOUND", year, `No se encontró la sección "${yearStr}" en la pestaña.`);
  }

  const subHeader = rows[yearRowIdx] ?? [];
  const dateRow = rows[yearRowIdx + 1] ?? [];

  // The master has changed layout over time. Read role metadata by header label
  // when it is present instead of relying on fixed column numbers.
  const metadataColumn = (labels: string[]): number => {
    for (let r = Math.max(0, yearRowIdx - 3); r <= yearRowIdx + 2; r++) {
      const row = rows[r] ?? [];
      const index = row.findIndex((cell) => labels.includes(String(cell ?? "").trim().toLowerCase()));
      if (index >= 0) return index;
    }
    return -1;
  };
  const roleCol = metadataColumn(["rol", "role"]);
  const sublevelCol = metadataColumn(["subnivel", "sublevel"]);
  const legacyRoleCol = metadataColumn(["rol viejo", "rol viejo/a", "legacy role"]);
  const areaCol = metadataColumn(["area", "área", "equipo", "departamento"]);

  // Mapear índice de columna → campo {mmm}{yyyy}
  const monthByCol = new Map<number, string>();
  const salaryMonthByCol = new Map<number, string>();
  // Años futuros (y el vigente, mientras el Máster aún no cargó ninguna "Ajustada") suelen venir con
  // "Valor Hora Estimada". Sólo se usa de respaldo, y sólo cuando el llamador lo habilita y la sección no tiene ninguna columna
  // "Valor Hora Ajustada": en años cerrados un layout inesperado debe fallar a la vista, nunca
  // reescribir tarifas con otra columna.
  const normalizeLabel = (value: string) => value.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\s+/g, " ").trim().toLowerCase();
  const fallbackMonthByCol = new Map<number, string>();
  for (let c = 0; c < subHeader.length; c++) {
    const label = String(subHeader[c] ?? "").trim().toLowerCase();
    const date = String(dateRow[c] ?? "").trim().toLowerCase();
    const m = date.match(/(ene|feb|mar|abr|may|jun|jul|ago|sep|oct|nov|dic)\s*(\d{4})/);
    if (!m) continue;
    const monthKey = SPANISH_MONTHS[m[1]];
    const yr = parseInt(m[2], 10);
    if (yr !== year) continue;
    if (label === "valor hora ajustada") {
      monthByCol.set(c, `${monthKey}${yr}`);
    } else if (options.allowEstimatedFallback && /^valor hora estimad[ao]$/.test(normalizeLabel(label))) {
      fallbackMonthByCol.set(c, `${monthKey}${yr}`);
    } else if (label.includes("sueldo") && label.includes("mensual")) {
      salaryMonthByCol.set(c, `${monthKey}${yr}`);
    }
  }
  if (monthByCol.size === 0 && fallbackMonthByCol.size > 0) {
    console.warn(`[personnel-sheets-sync] ${yearStr}: sin "Valor Hora Ajustada"; se usa "Valor Hora Estimada" (año futuro).`);
    for (const [c, field] of fallbackMonthByCol) monthByCol.set(c, field);
  }

  if (monthByCol.size === 0) {
    throw new SheetsLayoutError("HEADERS_NOT_FOUND", year, `No se encontraron columnas "Valor Hora Ajustada" para ${yearStr}.`);
  }

  // Los nombres viven en la misma columna donde se encontró el label del año.
  // Antes detectábamos esto mirando contenido en col A vs col B, pero rompía
  // cuando la primera persona del listado tenía un valor en "Ajuste" — el
  // detector confundía el % con el nombre.
  const nameCol = yearCol;
  const peopleStart = yearRowIdx + 2;

  // Detectar fin de sección: 2 filas consecutivas sin nombre y sin valores.
  const result: ParsedSheetRow[] = [];
  let emptyStreak = 0;
  for (let r = peopleStart; r < rows.length; r++) {
    const name = String(rows[r]?.[nameCol] ?? "").trim();
    const lower = name.toLowerCase();
    const isSectionLabel =
      lower === yearStr ||
      lower === String(year + 1) ||
      lower === String(year - 1) ||
      lower === "detalle" ||
      lower.startsWith("pago en ");

    let hasAny = false;
    const monthlyRates: Record<string, number> = {};
    const monthlySalaries: Record<string, number> = {};
    for (const [c, field] of monthByCol.entries()) {
      const num = parseMoney(rows[r]?.[c]);
      if (num !== null) {
        monthlyRates[field] = num;
        hasAny = true;
      }
    }
    for (const [c, field] of salaryMonthByCol.entries()) {
      const num = parseMoney(rows[r]?.[c]);
      if (num !== null) {
        monthlySalaries[field] = num;
        hasAny = true;
      }
    }

    if (!name && !hasAny) {
      emptyStreak++;
      if (emptyStreak >= 2) break;
      continue;
    }
    emptyStreak = 0;

    if (!name || isSectionLabel) continue;

    const cell = (column: number) => column >= 0 ? String(rows[r]?.[column] ?? "").trim() || null : null;
    result.push({
      sheetName: name,
      monthlyRates,
      monthlySalaries: Object.keys(monthlySalaries).length > 0 ? monthlySalaries : undefined,
      currentRole: cell(roleCol),
      sublevel: cell(sublevelCol),
      legacyRole: cell(legacyRoleCol),
      ...(areaCol >= 0 ? { area: cell(areaCol) } : {}),
    });
  }

  return result;
}

/** Año civil en Buenos Aires (el servidor puede correr en UTC). */
function currentCivilYear(): number {
  return Number(new Intl.DateTimeFormat("en-CA", { timeZone: "America/Argentina/Buenos_Aires", year: "numeric" }).format(new Date()));
}

type MasterSnapshot = { rows: string[][]; metadataRows: ParsedPersonnelMetadata[] };

async function readMasterSnapshot(): Promise<MasterSnapshot> {
  const sheets = buildSheetsClient();
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: READ_RANGE,
  });
  const rows = (response.data.values || []) as string[][];

  try {
    const workbook = await sheets.spreadsheets.get({
      spreadsheetId: SPREADSHEET_ID,
      fields: "sheets.properties.title",
    });
    const tabTitles = (workbook.data.sheets ?? [])
      .map((sheet) => sheet.properties?.title)
      .filter((title): title is string => Boolean(title) && title !== SHEET_TAB)
      .sort((left, right) => {
        const priority = (title: string) => /personal|equipo|team|staff|rrhh/i.test(title) ? 0 : 1;
        return priority(left) - priority(right);
      });
    if (tabTitles.length === 0) return { rows, metadataRows: [] };

    const metadataResponse = await sheets.spreadsheets.values.batchGet({
      spreadsheetId: SPREADSHEET_ID,
      ranges: tabTitles.map((title) => `'${title.replace(/'/g, "''")}'!${PERSONNEL_METADATA_RANGE}`),
      majorDimension: "ROWS",
      valueRenderOption: "FORMATTED_VALUE",
    });
    const metadataRows = (metadataResponse.data.valueRanges ?? []).flatMap((range) =>
      parsePersonnelMetadataGrid((range.values ?? []) as string[][]),
    );
    return { rows, metadataRows };
  } catch (error) {
    // Rates remain usable if an unrelated catalogue tab is temporarily
    // unreadable; auth failures still surface from the primary reads above.
    console.warn("[personnel-sheets-sync] No se pudo leer metadata de Personal; se sincronizarán sólo tarifas.", error);
    return { rows, metadataRows: [] };
  }
}

function rateRowsFromSnapshot(snapshot: MasterSnapshot, year: number): ParsedSheetRow[] {
  const rateRows = parseValorHoraSection(snapshot.rows, year, { allowEstimatedFallback: year >= currentCivilYear() });
  return snapshot.metadataRows.length === 0 ? rateRows : mergePersonnelMetadata(rateRows, snapshot.metadataRows);
}

export async function fetchValorHoraForYear(year: number): Promise<ParsedSheetRow[]> {
  return rateRowsFromSnapshot(await readMasterSnapshot(), year);
}

/**
 * Lee el Máster una sola vez y parsea cada año por separado. Un año con layout
 * inválido no impide aplicar los demás: se devuelve su error tipado. Los errores
 * de Google (auth/red) siguen lanzándose porque afectan a todos los años.
 */
export async function fetchValorHoraForYears(
  years: number[],
): Promise<Map<number, { rows: ParsedSheetRow[] } | { error: unknown }>> {
  const snapshot = await readMasterSnapshot();
  const result = new Map<number, { rows: ParsedSheetRow[] } | { error: unknown }>();
  for (const year of years) {
    try {
      result.set(year, { rows: rateRowsFromSnapshot(snapshot, year) });
    } catch (error) {
      result.set(year, { error });
    }
  }
  return result;
}

/** @deprecated Use fetchValorHoraForYear(2026) */
export const fetchValorHora2026 = () => fetchValorHoraForYear(2026);

const MONTHS_EN = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"] as const;

export function getHistoricalRateFields(year: number): string[] {
  return MONTHS_EN.map((m) => `${m}${year}HourlyRateARS`);
}

export const HISTORICAL_RATE_FIELDS_2025 = getHistoricalRateFields(2025);
export const HISTORICAL_RATE_FIELDS_2026 = getHistoricalRateFields(2026);
export const HISTORICAL_RATE_FIELDS_2027 = getHistoricalRateFields(2027);

/**
 * Normalize a person name for fuzzy matching:
 * lowercase, remove accents, collapse spaces, remove non-alphanumeric.
 */
export function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Find the best matching personnel ID for a sheet name using fuzzy logic:
 * 1. Exact normalized match
 * 2. One name is a substring of the other
 * 3. All words of the shorter name appear in the longer name (min 2 words)
 */
export function findPersonnelIdFuzzy(
  sheetName: string,
  personnelByName: Map<string, number>,
): number | null {
  const normalized = normalizeName(sheetName);

  for (const [key, id] of personnelByName.entries()) {
    if (normalizeName(key) === normalized) return id;
  }

  for (const [key, id] of personnelByName.entries()) {
    const normKey = normalizeName(key);
    if (normalized.includes(normKey) || normKey.includes(normalized)) return id;
  }

  const words = normalized.split(" ").filter(Boolean);
  for (const [key, id] of personnelByName.entries()) {
    const keyWords = normalizeName(key).split(" ").filter(Boolean);
    const shorter = words.length <= keyWords.length ? words : keyWords;
    const longer  = words.length <= keyWords.length ? keyWords : words;
    if (shorter.length >= 2 && shorter.every(w => longer.includes(w))) return id;
  }

  return null;
}
