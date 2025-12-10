# Data Sources - Dashboard Ejecutivo

Este documento describe las fuentes de datos oficiales para cada métrica del Dashboard Ejecutivo.

## Tablas Principales

### fact_rc_month
**Propósito:** Ingresos por proyecto por período

| Campo | Tipo | Descripción |
|-------|------|-------------|
| revenue_usd | numeric | Ingreso devengado en USD |
| period_key | varchar | Período (YYYY-MM) |
| project_id | integer | ID del proyecto |

**Uso:** Devengado = SUM(revenue_usd) para los períodos seleccionados

---

### fact_cost_month
**Propósito:** Costos mensuales consolidados

| Campo | Tipo | Descripción |
|-------|------|-------------|
| direct_usd | numeric | Costos directos (equipo asignado a proyectos) |
| indirect_usd | numeric | Overhead (costos indirectos operativos) |
| provisions_usd | numeric | Provisiones e impuestos |
| period_key | varchar | Período (YYYY-MM) |

**Uso:**
- Directos = SUM(direct_usd)
- Overhead = SUM(indirect_usd)
- Provisiones = SUM(provisions_usd)

---

### fact_labor_month
**Propósito:** Horas trabajadas por persona y proyecto

| Campo | Tipo | Descripción |
|-------|------|-------------|
| asana_hours | numeric | Horas trabajadas (Asana) |
| billing_hours | numeric | Horas facturables |
| person_id | integer | ID de la persona |
| project_id | integer | ID del proyecto |
| period_key | varchar | Período (YYYY-MM) |

**Uso:**
- Horas totales = SUM(asana_hours)
- Horas facturables = SUM(billing_hours)
- Personas activas = COUNT(DISTINCT person_id) WHERE asana_hours > 0

---

### monthly_financial_summary
**Propósito:** Snapshots mensuales del Excel Maestro

| Campo | Tipo | Descripción |
|-------|------|-------------|
| facturacion_total | numeric | Facturado del período |
| caja_total | numeric | Saldo de caja al cierre |
| total_activo | numeric | Activo total |
| total_pasivo | numeric | Pasivo total |
| period_key | varchar | Período (YYYY-MM) |

**Uso:** Valores directos (no calculados) del Excel Maestro

**IMPORTANTE:** Caja Total, Activo y Pasivo son snapshots. No se calculan.

---

### cash_movements
**Propósito:** Movimientos de caja detallados

| Campo | Tipo | Descripción |
|-------|------|-------------|
| type | varchar | 'IN' (ingreso) o 'OUT' (egreso) |
| amount_usd | numeric | Monto en USD |
| period_key | varchar | Período (YYYY-MM) |

**Uso:**
- Cash In = SUM(amount_usd) WHERE type = 'IN'
- Cash Out = SUM(amount_usd) WHERE type = 'OUT'

---

## Relación entre Tablas

```
Vista Operativa:
  Devengado ← fact_rc_month.revenue_usd
  Directos ← fact_cost_month.direct_usd
  Horas ← fact_labor_month

Vista Económica:
  Devengado ← fact_rc_month.revenue_usd
  Directos ← fact_cost_month.direct_usd
  Overhead ← fact_cost_month.indirect_usd

Vista Financiera:
  Facturado ← monthly_financial_summary.facturacion_total
  Directos ← fact_cost_month.direct_usd
  Overhead ← fact_cost_month.indirect_usd
  Provisiones ← fact_cost_month.provisions_usd
  Cash In/Out ← cash_movements
  Caja Total ← monthly_financial_summary.caja_total
  Activo/Pasivo ← monthly_financial_summary
```

---

## Qué NO trae cada tabla

| Tabla | NO incluye |
|-------|------------|
| fact_rc_month | Costos, provisiones, horas |
| fact_cost_month | Ingresos, horas, caja |
| fact_labor_month | Ingresos, costos monetarios |
| monthly_financial_summary | Desglose por proyecto, horas |
| cash_movements | Devengado, costos operativos |

---

## Notas Importantes

1. **Devengado vs Facturado:**
   - Devengado = Ingreso productivo real (fact_rc_month)
   - Facturado = Ingreso contable (monthly_financial_summary)

2. **Fuente Única:**
   - Cada métrica tiene una sola fuente de verdad
   - No mezclar fuentes para la misma métrica

3. **Caja Total:**
   - SIEMPRE viene del Excel Maestro
   - NUNCA se calcula como suma de cash_movements
