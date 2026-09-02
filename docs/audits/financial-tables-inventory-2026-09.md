# Inventario de tablas financieras — spike previo a migración Mind

**Fecha**: 2026-09-01
**Método**: grep de uso real en `server/` (routes, storage, domain, etl) + `client/`, cruzado con `git log` para entender origen y motivo de abandono de cada tabla. Cero cambios de código; sólo lectura.

**Por qué existe este documento**: antes de diseñar schema nuevo para migrar registro económico/financiero a Mind, había que confirmar qué de las 33 tablas con nombre `revenue|billing|financial|cost|invoice|sales|exchange|fx|fact_|sot|dim_` en `shared/schema.ts` está viva. El resultado cambia el plan: **el 90% de lo que hacía falta ya existe.**

---

## Hallazgo principal

`project_monthly_revenue`, `project_monthly_sales`, `project_financial_transactions`, `project_financial_summary` y `project_pricing_changes` son un **subsistema completo de facturación/cobranza por proyecto/mes**, con:

- Schema completo (`shared/schema.ts:2692-2815`)
- CRUD completo en `server/storage.ts` (líneas 4104-4497): `getProjectMonthlyRevenue`, `getProjectFinancialSummary`, `calculateAndUpdateFinancialSummary`, `createProjectMonthlySales`, etc.
- Una página de UI de 590 líneas: `client/src/pages/project-financial-management.tsx`
- 9 commits de evolución real entre el 28-ago-2025 y el 5-sep-2025, incluyendo **"Integrate automatic revenue generation from Excel spreadsheets"** — es decir, en su momento alguien ya resolvió el puente Excel→Mind para este dato.

**Se eliminó la página el 23-jul-2026 (PR #152)**, con este texto exacto en la descripción del PR:

> `pages/project-financial-management.tsx` — ruteada pero **sin ningún link inbound**; se elimina el archivo + su ruta e import.

No se borró por ser incorrecta, redundante o por decisión de producto. Se borró porque nadie la enlazaba desde ningún lado y una limpieza de "páginas huérfanas" la barrió junto con código muerto real (`project-single.tsx`, que nunca estuvo ruteada). El backend (schema + storage) quedó atrás porque el PR era de limpieza de frontend, no de auditoría de backend — por eso las tablas siguen ahí, completas, con cero referencias en rutas hoy.

**Consecuencia para la migración**: el formulario de "¿se facturó, por cuánto, se cobró?" que identifiqué como la única pieza genuinamente nueva que hacía falta, **no hay que construirlo. Hay que recuperarlo de `d77d0956^` y volver a enlazarlo.**

---

## Clasificación completa (33 tablas)

### 🟢 VIVAS — pipeline Excel actual (no tocar hasta tener el diff de reconciliación)

| Tabla | Rol en el pipeline actual |
|---|---|
| `googleSheetsSales`, `googleSheetsProjectBilling` | Lectura cruda de Google Sheets ("Ventas Tomi", RC) |
| `financialSot` | Staging del ETL RC (según `FLUJO_DE_DATOS_COMPLETO.md`) |
| `incomeSot` | SoT de ingresos más nueva y más cuidada que `financialSot` — maneja IVA, `isProjection`, `fxRef` de auditoría. Parece el reemplazo en curso de `financialSot` para ingresos. **A confirmar cuál de las dos es la que hay que mirar como fuente real antes de construir nada.** |
| `costsSot`, `salesNorm`, `costsNorm` | Normalización post-staging |
| `dimPeriod`, `dimPersonRate`, `dimClientAlias`, `dimProjectAlias` | Dimensiones del star schema, resolver de proyectos (cascada de 3 etapas documentada) |
| `factRCMonth`, `factLaborMonth`, `factCostMonth`, `factEstimatedCostMonth` | Fact tables — SoT para agregaciones |
| `monthlyFinancialSummary` | Vivo en `routes.ts` y `sot-etl.ts` — incluye `cajaTotal`. Es el cashflow que ya está en memoria (`auto-sync-reenabled.md`: "cashflow balances computed, not imported") |
| `costosRechazados` | Auditoría de filas de costos rechazadas por el ETL |

### 🟢 VIVAS — otros subsistemas (no relacionados a este scope, no confundir)

| Tabla | Rol |
|---|---|
| `exchangeRates`, `exchangeRateHistory` | Tipo de cambio manual + histórico. **Reutilizable tal cual** para snapshot de FX por mes — no hace falta tabla nueva. |
| `personnelHistoricalCosts`, `personnelCostMigrationAudit`, `personnelCostSyncWarnings` | Costos de Personal canónicos (valor hora → sueldo), con auditoría antes/después. Es la pieza que ya cumple CFG-03 del documento de definiciones de producto. |
| `personalMonthlyInvoices`, `personalFxOverrides` | Facturación de **proveedores externos** (freelancers), sistema aparte. No es esto. |
| `clientBillingEntities` | Razones sociales de clientes para facturar |
| `costMultipliers` | Multiplicadores de complejidad del motor de pricing del cotizador |
| `indirectCosts`, `indirectCostCategories`, `directCosts` | Costos operativos de la empresa (no por proyecto) |

### 🟡 RESUCITABLE — el hallazgo principal

| Tabla | Estado | Acción |
|---|---|---|
| `projectMonthlyRevenue` | Backend completo, 0 rutas activas | Recuperar + re-enlazar |
| `projectMonthlySales` | Backend completo, 0 rutas activas | Recuperar + re-enlazar |
| `projectFinancialTransactions` | Backend completo, 0 rutas activas (facturación + cobranza con `invoiceStatus`) | Recuperar + re-enlazar — **esta es la tabla de "se facturó/se cobró"** |
| `projectFinancialSummary` | Backend completo, 0 rutas activas | Recuperar + re-enlazar |
| `projectPricingChanges` | Backend completo, 0 rutas activas | Evaluar si todavía aplica o si `personnelHistoricalCosts`/quotations ya lo cubre |

### 🔴 MUERTA — candidata a borrar en el mismo PR que se toque este scope

| Tabla | Evidencia |
|---|---|
| `revenueEvents` | Cero referencias en `server/`, `client/` o `scripts/`. Declarada y nunca usada. |

---

## Lo que esto cambia del plan anterior

1. **No se diseña `monthly_billing_entries` / `labor_cost_entries` / `fx_rate_history` nuevas.** `exchangeRates`/`exchangeRateHistory` ya cubren FX. Costos por persona/mes ya viven en `personnelHistoricalCosts` + `task_time_entries`. Lo único que faltaba — invoicing/cobranza — ya está construido en `projectFinancialTransactions`.

2. **El único trabajo de "Fase 3" real es:**
   - `git show d77d0956^:client/src/pages/project-financial-management.tsx` → restaurar
   - Volver a registrar la ruta en `App.tsx`
   - Agregar **el link inbound que le faltó la primera vez** (desde `active-projects.tsx`, que es donde vive hoy la cartera financiera según PRO-09) — esa es la causa raíz de por qué murió, no repetir el error
   - Confirmar que `calculateAndUpdateFinancialSummary` sigue siendo correcto contra el modelo de datos actual (11 meses sin correr, puede haber quedado desalineado con cambios de `activeProjects`/`quotations` en el medio)

3. **Sigue pendiente, sin cambios respecto al plan anterior:**
   - Confirmar `incomeSot` vs `financialSot`: cuál es la fuente real hoy antes de escribir el script de diff
   - Script de diff de un solo sentido: Excel (vía `incomeSot`/`financialSot` + `factCostMonth`) vs. lo que Mind ya tiene operativamente (`task_time_entries` + `personnelHistoricalCosts` + `quotations`)
   - Borrar `revenueEvents` en el mismo PR

## Próxima acción concreta

Restaurar `project-financial-management.tsx` en una rama, correr `tsc --noEmit` y los tests existentes contra el modelo actual, y recién ahí decidir si sirve tal cual o si 11 meses de cambios en `activeProjects`/`quotations` la dejaron desalineada. Esto es medio día, no una semana, porque no hay schema nuevo que diseñar.
