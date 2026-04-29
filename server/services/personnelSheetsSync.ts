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

const SPANISH_MONTHS: Record<string, string> = {
  ene: "jan", feb: "feb", mar: "mar", abr: "apr",
  may: "may", jun: "jun", jul: "jul", ago: "aug",
  sep: "sep", oct: "oct", nov: "nov", dic: "dec",
};

export interface ParsedSheetRow {
  sheetName: string;
  monthlyRates: Record<string, number>; // { jan2026: 11562.5, feb2026: 12137.85, ... }
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
  }
  const n = parseFloat(s);
  return isFinite(n) && n > 0 ? n : null;
}

export function parseValorHoraSection(rows: string[][], year: number): ParsedSheetRow[] {
  const yearStr = String(year);
  let yearRowIdx = -1;
  for (let i = 0; i < rows.length; i++) {
    const a = String(rows[i]?.[0] ?? "").trim();
    const b = String(rows[i]?.[1] ?? "").trim();
    if (a === yearStr || b === yearStr) {
      yearRowIdx = i;
      break;
    }
  }
  if (yearRowIdx < 0) {
    throw new Error(`No se encontró la sección "${yearStr}" en la pestaña.`);
  }

  const subHeader = rows[yearRowIdx] ?? [];
  const dateRow = rows[yearRowIdx + 1] ?? [];

  // Mapear índice de columna → campo {mmm}{yyyy}
  const monthByCol = new Map<number, string>();
  for (let c = 0; c < subHeader.length; c++) {
    const label = String(subHeader[c] ?? "").trim().toLowerCase();
    if (label !== "valor hora ajustada") continue;
    const date = String(dateRow[c] ?? "").trim().toLowerCase();
    const m = date.match(/(ene|feb|mar|abr|may|jun|jul|ago|sep|oct|nov|dic)\s*(\d{4})/);
    if (!m) continue;
    const monthKey = SPANISH_MONTHS[m[1]];
    const yr = parseInt(m[2], 10);
    if (yr !== year) continue;
    monthByCol.set(c, `${monthKey}${yr}`);
  }

  if (monthByCol.size === 0) {
    throw new Error(`No se encontraron columnas "Valor Hora Ajustada" para ${yearStr}.`);
  }

  // Detectar la columna de nombres entre A y B.
  const peopleStart = yearRowIdx + 2;
  let nameCol = 0;
  for (let r = peopleStart; r < Math.min(peopleStart + 40, rows.length); r++) {
    const a = String(rows[r]?.[0] ?? "").trim();
    const b = String(rows[r]?.[1] ?? "").trim();
    if (a && !b) { nameCol = 0; break; }
    if (b && !a) { nameCol = 1; break; }
    if (a && b) { nameCol = 1; break; }
  }

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
    for (const [c, field] of monthByCol.entries()) {
      const num = parseMoney(rows[r]?.[c]);
      if (num !== null) {
        monthlyRates[field] = num;
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

    result.push({ sheetName: name, monthlyRates });
  }

  return result;
}

export async function fetchValorHora2026(): Promise<ParsedSheetRow[]> {
  const sheets = buildSheetsClient();
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: READ_RANGE,
  });
  const rows = (response.data.values || []) as string[][];
  return parseValorHoraSection(rows, 2026);
}

export const HISTORICAL_RATE_FIELDS_2026 = [
  "jan2026HourlyRateARS", "feb2026HourlyRateARS", "mar2026HourlyRateARS",
  "apr2026HourlyRateARS", "may2026HourlyRateARS", "jun2026HourlyRateARS",
  "jul2026HourlyRateARS", "aug2026HourlyRateARS", "sep2026HourlyRateARS",
  "oct2026HourlyRateARS", "nov2026HourlyRateARS", "dec2026HourlyRateARS",
] as const;
