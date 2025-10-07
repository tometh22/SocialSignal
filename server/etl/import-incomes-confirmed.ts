/**
 * 📊 Income ETL from "Proyectos confirmados y estimados"
 * Reemplaza "Ventas Tomi" como fuente de ingresos
 */

import { z } from "zod";
import { db } from "../db";
import { incomeSot } from "../../shared/schema";
import { sql } from "drizzle-orm";

// Schema de validación para filas de "Proyectos confirmados y estimados"
const ConfirmedProjectRow = z.object({
  "Mes Facturación": z.string(),
  "Año Facturación": z.coerce.number(),
  "Cliente": z.string(),
  "Detalle": z.string(), // nombre del proyecto
  "Tipo de proyecto": z.string(), // Fee | One Shot
  "Confirmado": z.string(),
  "Pasado/Futuro": z.string().optional(),
  "Cotización": z.string().optional(),
  "Moneda Original ARS": z.string().optional(),
  "Moneda Original USD": z.string().optional(),
  "Monto Total USD": z.string(),
  "Monto Total ARS CON IVA": z.string().optional(),
  "Monto Total USD CON IVA": z.string().optional(),
  "Facturado/No Facturado": z.string().optional(),
});

type ConfirmedProjectRowType = z.infer<typeof ConfirmedProjectRow>;

/**
 * Parsear dinero en formato flexible
 */
function parseMoneyUnified(value: string | undefined | null): number | null {
  if (!value) return null;
  
  const cleaned = String(value)
    .replace(/[^\d.,-]/g, '') // quitar símbolos
    .replace(/,/g, '.'); // normalizar decimal
  
  const parsed = parseFloat(cleaned);
  return isNaN(parsed) ? null : parsed;
}

/**
 * Convertir mes en español a month_key YYYY-MM
 */
function monthKeyFromEs(mes: string, year: number): string {
  const m = mes.toLowerCase().trim();
  const map: Record<string, string> = {
    ene: "01", enero: "01",
    feb: "02", febrero: "02",
    mar: "03", marzo: "03",
    abr: "04", abril: "04",
    may: "05", mayo: "05",
    jun: "06", junio: "06",
    jul: "07", julio: "07",
    ago: "08", agosto: "08",
    sep: "09", sept: "09", septiembre: "09",
    oct: "10", octubre: "10",
    nov: "11", noviembre: "11",
    dic: "12", diciembre: "12",
  };
  
  const token = Object.keys(map).find(k => m.includes(k)) ?? "01";
  return `${year}-${map[token]}`;
}

export interface ImportIncomesResult {
  inserted: number;
  updated: number;
  skipped: number;
  errors: string[];
}

/**
 * 🔄 Importar ingresos desde "Proyectos confirmados y estimados"
 */
export async function importIncomesFromConfirmed(rows: any[]): Promise<ImportIncomesResult> {
  const result: ImportIncomesResult = {
    inserted: 0,
    updated: 0,
    skipped: 0,
    errors: [],
  };

  try {
    console.log(`📥 Importando ${rows.length} filas de "Proyectos confirmados y estimados"...`);
    
    // Validar y parsear filas
    const parsed = rows.map((r, idx) => {
      try {
        return ConfirmedProjectRow.parse(r);
      } catch (e) {
        result.errors.push(`Fila ${idx + 1}: ${e instanceof Error ? e.message : String(e)}`);
        return null;
      }
    }).filter((r): r is ConfirmedProjectRowType => r !== null);

    console.log(`✅ Filas válidas: ${parsed.length}`);

    // Filtrar: Confirmado = "Sí" y Pasado/Futuro = "Real"
    const filtered = parsed
      .filter(r => {
        const confirmado = (r["Confirmado"] || "").toLowerCase().startsWith("si");
        const pasadoFuturo = (r["Pasado/Futuro"] || "Real").toLowerCase();
        return confirmado && (pasadoFuturo === "real" || !r["Pasado/Futuro"]);
      });

    console.log(`🔍 Filtradas (Confirmado=Sí, Pasado/Futuro=Real): ${filtered.length}`);

    // Procesar cada fila
    for (const row of filtered) {
      try {
        const monthKey = monthKeyFromEs(row["Mes Facturación"], row["Año Facturación"]);
        const amountLocalArs = parseMoneyUnified(row["Moneda Original ARS"] ?? "");
        const amountLocalUsd = parseMoneyUnified(row["Moneda Original USD"] ?? "");
        const revenueUsd = parseMoneyUnified(row["Monto Total USD"]) ?? 0;
        const revenueUsdVat = parseMoneyUnified(row["Monto Total USD CON IVA"] ?? "");
        const revenueArsVat = parseMoneyUnified(row["Monto Total ARS CON IVA"] ?? "");
        const fxRef = parseMoneyUnified(row["Cotización"] ?? "");

        const record = {
          monthKey,
          year: row["Año Facturación"],
          clientName: row["Cliente"].trim(),
          projectName: row["Detalle"].trim(),
          projectType: row["Tipo de proyecto"].trim(),
          confirmed: true,
          statusHint: (row["Facturado/No Facturado"] ?? "").trim() || null,
          fxRef: fxRef ? String(fxRef) : null,
          amountLocalArs: amountLocalArs ? String(amountLocalArs) : null,
          amountLocalUsd: amountLocalUsd ? String(amountLocalUsd) : null,
          revenueUsd: String(revenueUsd),
          revenueUsdWithVat: revenueUsdVat ? String(revenueUsdVat) : null,
          revenueArsWithVat: revenueArsVat ? String(revenueArsVat) : null,
        };

        // Upsert
        await db
          .insert(incomeSot)
          .values(record)
          .onConflictDoUpdate({
            target: [incomeSot.clientName, incomeSot.projectName, incomeSot.monthKey],
            set: {
              projectType: sql`EXCLUDED.project_type`,
              fxRef: sql`COALESCE(EXCLUDED.fx_ref, income_sot.fx_ref)`,
              amountLocalArs: sql`COALESCE(EXCLUDED.amount_local_ars, income_sot.amount_local_ars)`,
              amountLocalUsd: sql`COALESCE(EXCLUDED.amount_local_usd, income_sot.amount_local_usd)`,
              revenueUsd: sql`EXCLUDED.revenue_usd`,
              revenueUsdWithVat: sql`COALESCE(EXCLUDED.revenue_usd_with_vat, income_sot.revenue_usd_with_vat)`,
              revenueArsWithVat: sql`COALESCE(EXCLUDED.revenue_ars_with_vat, income_sot.revenue_ars_with_vat)`,
              updatedAt: sql`NOW()`,
            },
          });

        result.inserted++;
      } catch (error) {
        const errorMsg = `Error procesando ${row["Cliente"]} - ${row["Detalle"]}: ${error instanceof Error ? error.message : String(error)}`;
        result.errors.push(errorMsg);
        console.error(`❌ ${errorMsg}`);
      }
    }

    console.log(`✅ Importación completada: ${result.inserted} registros insertados/actualizados`);
    
    if (result.errors.length > 0) {
      console.warn(`⚠️ Errores encontrados: ${result.errors.length}`);
    }

  } catch (error) {
    const errorMsg = `Error general en importación: ${error instanceof Error ? error.message : String(error)}`;
    result.errors.push(errorMsg);
    console.error(`❌ ${errorMsg}`);
  }

  return result;
}
