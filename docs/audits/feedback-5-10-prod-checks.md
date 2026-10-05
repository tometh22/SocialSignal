# Feedback 5-10 — verificaciones de producción (sólo lectura)

Nada de esto modifica datos. Correr contra producción antes de actuar sobre los puntos marcados.

## 1. Sync de valor hora 2027 (Refrescar Datos)
`GET /api/personnel/sheets-sync/preview?year=2027` (sesión Admin). Devuelve 502 con `detail` si la
sección 2027 no existe en la pestaña "Valor Hora Real y Estimada" o no tiene columnas reconocibles.
Desde 1.10.16 el botón informa cada año por separado y un año futuro sin cargar es un aviso, no un error.

## 2. Cotizaciones legacy a archivar (Animal Studio, Arcos Dorados)
```
DATABASE_URL=… node scripts/archive-legacy-quotations.mjs --list "Animal Studio" "Arcos Dorados"
```
Armar `manifest.json` con los 4 ids (ver cabecera del script), revisar la vista previa
(`node scripts/archive-legacy-quotations.mjs manifest.json`) y recién entonces `--apply`.
Es reversible: `POST /api/quotations/:id/restore` o el diálogo de archivadas.

## 3. Cotizaciones con precio = costo
```sql
SELECT id, project_name, base_cost, total_amount, markup_amount, margin_factor
FROM quotations WHERE abs(total_amount - base_cost) < 0.01 AND archived_at IS NULL;
```

## 4. Plantillas todavía en uso (antes de borrar código/datos)
```sql
SELECT count(*) FROM quotations WHERE template_id IS NOT NULL AND scope_snapshot IS NULL;
```

## 5. Grupo PepsiCo GRP-2026-000001 (¿USD 4.4M es un error de unidad?)
```sql
SELECT q.id, q.project_name, q.status, q.quotation_currency, q.exchange_rate_at_quote,
       q.total_amount, q.base_cost, q.service_blueprint_id,
       (SELECT sum(cost) FROM quotation_team_members t WHERE t.quotation_id=q.id AND t.variant_id IS NULL) AS team_cost
FROM quotation_group_items i JOIN quotations q ON q.id=i.quotation_id
WHERE i.group_id = (SELECT id FROM quotation_groups WHERE group_number='GRP-2026-000001');
```
Si `quotation_currency='USD'` y `team_cost` está en millones con tarifas de cientos de dólares, hay un
error de unidades al aplicar la receta en USD (abrir fix aparte).
