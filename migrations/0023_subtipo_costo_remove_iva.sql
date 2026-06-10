-- Phase 1: Add subtipo_costo to direct_costs and remove_iva to indirect_cost_categories

ALTER TABLE "direct_costs"
  ADD COLUMN IF NOT EXISTS "subtipo_costo" varchar(60);

ALTER TABLE "indirect_cost_categories"
  ADD COLUMN IF NOT EXISTS "remove_iva" boolean NOT NULL DEFAULT false;

-- Mark known IVA-removal providers
UPDATE "indirect_cost_categories"
  SET "remove_iva" = true
  WHERE "name" ILIKE '%estudio contable%'
     OR "name" ILIKE '%itecsa%'
     OR "name" ILIKE '%otros proveedores%';

-- Backfill subtipo_costo from rol column where rol contains known subtypes
UPDATE "direct_costs"
  SET "subtipo_costo" = "rol"
  WHERE "rol" IN (
    'Equipo', 'Board', 'Equipo - Bono', 'Board - Bono',
    'Administración Finanzas', 'Administración Finanzas - Bono',
    'Suscripciones/Herramientas', 'Impuestos ARG', 'Impuestos USA',
    'Estudio Contable', 'Otros Proveedores', 'Otros Gastos',
    'Tarjeta', 'People', 'Comisiones Bancarias', 'Monotributo',
    'Provisión Pasivo', 'Intereses Oxean', 'Comisiones equipo',
    'Bonos Total', 'Gastos Varios'
  );
