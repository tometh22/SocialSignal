import { and, eq, inArray, max, ne } from "drizzle-orm";
import { db } from "../db";
import { serviceBlueprints } from "@shared/schema";
import { blueprintDefinitionSchema, LEGACY_SERVICE_BLUEPRINT_SEEDS, SERVICE_BLUEPRINT_SEEDS } from "@shared/quotation-professional";

const SOURCE_LABELS: Record<string, string> = {
  "demo-exploratoria": "PeYa / Mercado Libre · demo sin conversión",
  "estudio-one-shot": "Kimberly-Clark · ganada; Banco Galicia · entregables y QA",
  "intelligence-event-pack": "Uber Intelligence Pack y PeYa Campaña Mundial · ganadas",
  "fee-mensual-inteligencia": "Tortugas Mall · ganada; Uber julio/agosto 2026 · abierta",
  "programa-regional-anual": "Pepsico octubre 2025 · ganada",
  "renovacion-expansion": "Patrones de continuidad Epical; Warner excluida hasta incorporar archivo",
  "bolsa-creditos-epical": "Modelo comercial de créditos Epical",
};

export async function ensureServiceBlueprintSeeds() {
  // These used to appear as separate products. They remain archived so every
  // historical quotation keeps its recipe id and definition, while new quotes
  // see only One Shot, Fee, Intelligence Event Track and Demo.
  const legacySlugs = LEGACY_SERVICE_BLUEPRINT_SEEDS.map((seed) => seed.slug);
  if (legacySlugs.length > 0) {
    await db.update(serviceBlueprints)
      .set({ status: "archived", updatedAt: new Date() })
      .where(and(inArray(serviceBlueprints.slug, legacySlugs), ne(serviceBlueprints.status, "archived")));
  }

  for (const seed of SERVICE_BLUEPRINT_SEEDS) {
    await db.update(serviceBlueprints)
      .set({ status: "archived", updatedAt: new Date() })
      .where(and(
        eq(serviceBlueprints.slug, seed.slug),
        ne(serviceBlueprints.version, seed.version),
        ne(serviceBlueprints.status, "archived"),
      ));
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
