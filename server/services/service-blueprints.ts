import { and, eq, max } from "drizzle-orm";
import { db } from "../db";
import { serviceBlueprints } from "@shared/schema";
import { blueprintDefinitionSchema, SERVICE_BLUEPRINT_SEEDS } from "@shared/quotation-professional";

const SOURCE_LABELS: Record<string, string> = {
  "demo-exploratoria": "PeYa / Mercado Libre · demo sin conversión",
  "estudio-one-shot": "Kimberly-Clark · ganada; Banco Galicia · entregables y QA",
  "intelligence-event-pack": "Uber Intelligence Pack y PeYa Campaña Mundial · ganadas",
  "fee-mensual-inteligencia": "Tortugas Mall · ganada; Uber julio/agosto 2026 · abierta",
  "programa-regional-anual": "Pepsico octubre 2025 · ganada",
  "renovacion-expansion": "Patrones de continuidad Epical; Warner excluida hasta incorporar archivo",
};

export async function ensureServiceBlueprintSeeds() {
  for (const seed of SERVICE_BLUEPRINT_SEEDS) {
    const existing = await db.select({ id: serviceBlueprints.id })
      .from(serviceBlueprints)
      .where(and(eq(serviceBlueprints.slug, seed.slug), eq(serviceBlueprints.version, seed.version)))
      .limit(1);
    if (existing.length) continue;
    await db.insert(serviceBlueprints).values({
      slug: seed.slug,
      name: seed.name,
      description: seed.description,
      version: seed.version,
      status: "published",
      definition: blueprintDefinitionSchema.parse(seed.definition),
      sourceLabel: SOURCE_LABELS[seed.slug] || "Patrones históricos Epical 2024-2026",
      publishedAt: new Date(),
    }).onConflictDoNothing();
  }
}

export async function nextBlueprintVersion(slug: string) {
  const [row] = await db.select({ version: max(serviceBlueprints.version) })
    .from(serviceBlueprints)
    .where(eq(serviceBlueprints.slug, slug));
  return Number(row?.version || 0) + 1;
}
