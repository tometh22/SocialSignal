import { db } from "../../db";
import { exchangeRates } from "@shared/schema";
import { eq, and } from "drizzle-orm";

export async function getMonthlyFx(period: string): Promise<number> {
  const [y, m] = period.split("-").map(Number);
  
  const row = await db.query.exchangeRates.findFirst({
    where: and(
      eq(exchangeRates.year, y),
      eq(exchangeRates.month, m)
    )
  });
  
  if (!row) {
    throw new Error(`FX not found for period ${period}`);
  }
  
  return Number(row.rate);
}
