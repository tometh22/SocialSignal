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

## Resultado de la corrida en producción (2026-10-05)

- **Migración 0076:** `quotation_alert_dismissals` existe con todas sus columnas (incluida `baseline_severity`) y su constraint única.
- **Cotizaciones legacy:** se archivaron las 4 (ids 257 Dashboard, 258 Estudio Atributos, 267 Diego Perez, 268 Referentes Obesidad) con `scripts/archive-legacy-quotations.mjs`, etiqueta `feedback-5-10-legacy-1000usd`: 4 respaldos en `quotation_archive_rollback_backups` y 4 eventos `archived`. Sus proyectos (37, 38, 47, 48) ya estaban anulados y vacíos y no se tocaron. Reversible con `POST /api/quotations/:id/restore`.
- **Sync 2027:** la pestaña "Valor Hora Real y Estimada" del Máster no tiene una sección 2027 (`SECTION_NOT_FOUND`); 2025 y 2026 se leen bien. No es de permisos ni de código: falta cargar el año en el Máster.
- **Grupo PepsiCo (GRP-2026-000001):** confirmado el error de unidades. Las cotizaciones 325 y 326 (USD, fx 1540) mezclan tarifas en pesos (roles 18, 12, 20 y 21: 22.466, 17.500, 17.500 y 13.686 por hora) con tarifas en dólares (roles 9 y 10: 15 y 12,5), lo que infla el total a USD 4.432.102 en lugar de ~USD 3.900.
