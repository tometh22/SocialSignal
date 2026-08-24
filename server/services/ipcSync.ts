import { sql } from "drizzle-orm";
import { db } from "../db";
import { ipcIndexValues } from "../../shared/schema";

/**
 * Variación mensual del IPC nacional (INDEC), vía ArgentinaDatos — API
 * pública, comunitaria, sin autenticación, que republica los datos
 * oficiales de INDEC. Devuelve la serie completa disponible; el llamador
 * decide qué guardar.
 */
export type IpcMonthlyReading = { year: number; month: number; monthlyPercentage: number };

const SOURCE = "ArgentinaDatos";

export async function fetchIpcHistory(): Promise<IpcMonthlyReading[]> {
  const response = await fetch("https://api.argentinadatos.com/v1/finanzas/indices/inflacion", {
    headers: { accept: "application/json" },
  });
  if (!response.ok) throw new Error(`ArgentinaDatos IPC respondió ${response.status}`);
  const payload = (await response.json()) as Array<{ fecha?: string; valor?: number }>;
  if (!Array.isArray(payload)) throw new Error("Respuesta de IPC con formato inesperado");

  const readings: IpcMonthlyReading[] = [];
  for (const row of payload) {
    const match = row.fecha?.match(/^(\d{4})-(\d{2})-\d{2}$/);
    const value = Number(row.valor);
    if (!match || !Number.isFinite(value)) continue;
    readings.push({ year: Number(match[1]), month: Number(match[2]), monthlyPercentage: value });
  }
  return readings;
}

/**
 * Sincroniza la serie completa contra ipc_index_values (upsert por
 * año/mes/fuente) en un solo statement — la API devuelve la serie entera
 * cada vez (100+ meses), y casi todo ya está sincronizado de corridas
 * anteriores; upsertear fila por fila pagaba ese costo en round-trips
 * secuenciales todos los días para datos que en el 99% de los casos no
 * cambiaron.
 */
export async function syncIpcIndex(): Promise<{ synced: number }> {
  const readings = await fetchIpcHistory();
  if (readings.length === 0) return { synced: 0 };
  const fetchedAt = new Date();
  await db.insert(ipcIndexValues)
    .values(readings.map((reading) => ({
      year: reading.year,
      month: reading.month,
      monthlyPercentage: String(reading.monthlyPercentage),
      source: SOURCE,
      fetchedAt,
      isActive: true,
    })))
    .onConflictDoUpdate({
      target: [ipcIndexValues.year, ipcIndexValues.month, ipcIndexValues.source],
      set: { monthlyPercentage: sql`excluded.monthly_percentage`, fetchedAt: sql`excluded.fetched_at` },
    });
  return { synced: readings.length };
}
