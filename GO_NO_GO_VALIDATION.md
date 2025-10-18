# 🎯 GO/NO-GO VALIDATION PACK - SoT Star Schema

## 📋 **Pre-requisitos**
- Sistema corriendo: `npm run dev`
- Usuario autenticado
- Excel MAESTRO accesible en Google Sheets

---

## 🚀 **EJECUCIÓN RÁPIDA (5 minutos)**

### **1. Ejecutar ETL Completo**
```bash
curl -X POST http://localhost:5000/api/etl/sot/run \
  -H "Content-Type: application/json" \
  -H "Cookie: connect.sid=YOUR_SESSION_COOKIE" \
  -d '{
    "scopes": {
      "periods": ["2025-08", "2025-09"]
    },
    "recomputeAgg": true
  }'
```

**✅ Output esperado (GO):**
```json
{
  "success": true,
  "summary": {
    "periods": ["2025-08", "2025-09"],
    "laborRowsProcessed": 150,
    "rcRowsProcessed": 22,
    "aggregates": 22,
    "executionTimeMs": 3500
  },
  "errors": []
}
```

**❌ Output esperado (NO-GO):**
```json
{
  "success": false,
  "errors": ["Missing FX for project X", "Rate not found for person Y"]
}
```

---

### **2. Validación Automática**
```bash
curl "http://localhost:5000/api/etl/sot/validate?period=2025-08" \
  -H "Cookie: connect.sid=YOUR_SESSION_COOKIE"
```

**✅ Output esperado (GO):**
```json
{
  "summary": {
    "periodKey": "2025-08",
    "missingRates": 0,
    "anti100Violations": 0,
    "currencyIssues": 0,
    "invariantViolations": 0,
    "orphanedLabor": 0,
    "status": "HEALTHY"
  },
  "details": {
    "missingRates": [],
    "anti100Violations": [],
    "currencyIssues": [],
    "invariantViolations": [],
    "orphanedLabor": []
  }
}
```

**❌ Output esperado (NO-GO):**
```json
{
  "summary": {
    "status": "ISSUES_FOUND",
    "missingRates": 3,
    "anti100Violations": 2,
    "currencyIssues": 1
  },
  "details": {
    "missingRates": [
      {"projectId": 5, "personKey": "sol_ayala", "billingHours": "26.92"}
    ]
  }
}
```

---

## 📊 **VALIDACIÓN DETALLADA POR CHECKPOINT**

### **✅ 1. PERÍODOS (dim_period)**

**Query:**
```sql
SELECT period_key, year, month, business_days
FROM dim_period
ORDER BY period_key DESC
LIMIT 12;
```

**✅ GO:** 36+ filas (2023-01 a 2025-12), todos con `business_days IS NOT NULL`

**❌ NO-GO:** Menos de 12 filas o períodos faltantes en rango 2025-01 a 2025-09

---

### **✅ 2. TARIFAS (dim_person_rate)**

**Query:**
```sql
SELECT 
  COUNT(*) as total_rates,
  COUNT(DISTINCT person_id) as unique_persons,
  COUNT(DISTINCT period_key) as unique_periods,
  COUNT(CASE WHEN project_id IS NOT NULL THEN 1 END) as project_specific,
  COUNT(CASE WHEN project_id IS NULL THEN 1 END) as general_rates
FROM dim_person_rate;
```

**✅ GO:** 
- `total_rates >= 72` (12 persons × 6 periods mínimo)
- `unique_persons >= 6`
- `project_specific + general_rates = total_rates`

**❌ NO-GO:** Menos de 50 tarifas o personas faltantes

---

### **✅ 3. ANTI×100 (fact_labor_month)**

**Query:**
```sql
SELECT 
  period_key,
  COUNT(*) FILTER (WHERE flags @> ARRAY['anti_x100_asana']) as normalized_asana,
  COUNT(*) FILTER (WHERE flags @> ARRAY['anti_x100_billing']) as normalized_billing,
  COUNT(*) FILTER (WHERE flags @> ARRAY['anti_x100_cost_ars']) as normalized_cost,
  COUNT(*) FILTER (WHERE CAST(asana_hours AS NUMERIC) > 500) as violations_asana,
  COUNT(*) FILTER (WHERE CAST(billing_hours AS NUMERIC) > 500) as violations_billing,
  COUNT(*) FILTER (WHERE CAST(cost_ars AS NUMERIC) > 1000000) as violations_cost
FROM fact_labor_month
WHERE period_key IN ('2025-08', '2025-09')
GROUP BY period_key;
```

**✅ GO:**
- `violations_asana = 0`
- `violations_billing = 0`
- `violations_cost = 0`
- `normalized_asana >= 1` (al menos 1 corrección aplicada)

**❌ NO-GO:** Cualquier violation > 0

---

### **✅ 4. FX FALLBACK (fact_labor_month)**

**Query:**
```sql
SELECT 
  period_key,
  COUNT(*) FILTER (WHERE flags @> ARRAY['fallback_fx']) as fx_fallbacks,
  COUNT(*) FILTER (WHERE CAST(fx AS NUMERIC) = 0 OR fx IS NULL) as missing_fx
FROM fact_labor_month
WHERE period_key IN ('2025-08', '2025-09')
GROUP BY period_key;
```

**✅ GO:**
- `missing_fx = 0`
- `fx_fallbacks >= 0` (puede ser 0 si Excel tiene todos los FX)

**❌ NO-GO:** `missing_fx > 0`

---

### **✅ 5. FACTS TABLES (estructura completa)**

**Query fact_labor_month:**
```sql
SELECT 
  project_id,
  period_key,
  person_key,
  role_name,
  CAST(target_hours AS NUMERIC) as target,
  CAST(asana_hours AS NUMERIC) as asana,
  CAST(billing_hours AS NUMERIC) as billing,
  CAST(hourly_rate_ars AS NUMERIC) as rate,
  CAST(cost_ars AS NUMERIC) as cost_ars,
  CAST(cost_usd AS NUMERIC) as cost_usd,
  CAST(fx AS NUMERIC) as fx,
  flags
FROM fact_labor_month
WHERE period_key = '2025-08'
  AND project_id = 5
ORDER BY person_key;
```

**✅ GO:**
- Todas las columnas pobladas (sin NULLs en horas, rate, costs)
- `flags` es array (puede ser `[]` o con elementos)
- `billing >= asana` o flag `fallback_billing` presente
- Al menos 6 filas (6 personas en proyecto Modo)

**❌ NO-GO:** 
- `hourly_rate_ars = 0` sin flag `rate_provisional`
- `cost_ars = 0` cuando `billing_hours > 0`

---

**Query fact_rc_month:**
```sql
SELECT 
  project_id,
  period_key,
  CAST(revenue_ars AS NUMERIC) as rev_ars,
  CAST(revenue_usd AS NUMERIC) as rev_usd,
  CAST(cost_ars AS NUMERIC) as cost_ars,
  CAST(cost_usd AS NUMERIC) as cost_usd,
  CAST(price_native AS NUMERIC) as price_native,
  CAST(fx AS NUMERIC) as fx,
  flags
FROM fact_rc_month
WHERE period_key = '2025-08'
  AND project_id = 5;
```

**✅ GO:**
- `revenue_usd > 0` o `revenue_ars > 0`
- `price_native > 0` (cotización del mes)
- `fx > 0`
- Si cliente ARS: `revenue_ars > revenue_usd`

**❌ NO-GO:**
- `revenue_ars = revenue_usd` (error de moneda)
- `fx = 0`

---

### **✅ 6. AGGREGATES (agg_project_month)**

**Query:**
```sql
SELECT 
  project_id,
  period_key,
  CAST(est_hours AS NUMERIC) as est_hours,
  CAST(total_asana_hours AS NUMERIC) as total_asana,
  CAST(total_billing_hours AS NUMERIC) as total_billing,
  CAST(total_cost_ars AS NUMERIC) as total_cost_ars,
  CAST(total_cost_usd AS NUMERIC) as total_cost_usd,
  CAST(view_operativa_revenue AS NUMERIC) as revenue,
  CAST(view_operativa_cost AS NUMERIC) as cost,
  CAST(view_operativa_denom AS NUMERIC) as denom,
  CAST(view_operativa_budget_util AS NUMERIC) as budget_util,
  CAST(view_operativa_markup AS NUMERIC) as markup,
  CAST(view_operativa_margin AS NUMERIC) as margin,
  flags
FROM agg_project_month
WHERE period_key = '2025-08'
  AND project_id = 5;
```

**✅ GO:**
- `total_asana > 0` (si hay equipo trabajando)
- `total_billing >= total_asana`
- `budget_util = cost / denom` (tolerance < 0.01)
- `markup = revenue / cost` (tolerance < 0.01)
- `margin = (revenue - cost) / revenue` (tolerance < 0.01)

**❌ NO-GO:**
- KPIs con valores NULL cuando debería haber datos
- `budget_util` calculado con fórmula incorrecta (hours/hours en lugar de cost/price)

---

### **✅ 7. INVARIANTES MATEMÁTICOS**

**Query:**
```sql
WITH labor_sum AS (
  SELECT 
    project_id,
    period_key,
    SUM(CAST(target_hours AS NUMERIC)) as sum_target,
    SUM(CAST(asana_hours AS NUMERIC)) as sum_asana,
    SUM(CAST(billing_hours AS NUMERIC)) as sum_billing,
    SUM(CAST(cost_ars AS NUMERIC)) as sum_cost_ars,
    SUM(CAST(cost_usd AS NUMERIC)) as sum_cost_usd
  FROM fact_labor_month
  WHERE period_key = '2025-08' AND project_id = 5
  GROUP BY project_id, period_key
),
agg_values AS (
  SELECT 
    project_id,
    period_key,
    CAST(est_hours AS NUMERIC) as agg_target,
    CAST(total_asana_hours AS NUMERIC) as agg_asana,
    CAST(total_billing_hours AS NUMERIC) as agg_billing,
    CAST(total_cost_ars AS NUMERIC) as agg_cost_ars,
    CAST(total_cost_usd AS NUMERIC) as agg_cost_usd
  FROM agg_project_month
  WHERE period_key = '2025-08' AND project_id = 5
)
SELECT 
  l.project_id,
  l.sum_target, a.agg_target, 
  ABS(l.sum_target - a.agg_target) as diff_target,
  l.sum_asana, a.agg_asana,
  ABS(l.sum_asana - a.agg_asana) as diff_asana,
  l.sum_billing, a.agg_billing,
  ABS(l.sum_billing - a.agg_billing) as diff_billing,
  l.sum_cost_usd, a.agg_cost_usd,
  ABS(l.sum_cost_usd - a.agg_cost_usd) as diff_cost_usd,
  CASE 
    WHEN ABS(l.sum_target - a.agg_target) < 0.01
     AND ABS(l.sum_asana - a.agg_asana) < 0.01
     AND ABS(l.sum_billing - a.agg_billing) < 0.01
     AND ABS(l.sum_cost_usd - a.agg_cost_usd) < 0.01
    THEN 'VALID'
    ELSE 'INVARIANT_VIOLATION'
  END as status
FROM labor_sum l
JOIN agg_values a ON l.project_id = a.project_id AND l.period_key = a.period_key;
```

**✅ GO:** `status = 'VALID'` (todas las diff < 0.01)

**❌ NO-GO:** `status = 'INVARIANT_VIOLATION'`

---

### **✅ 8. API CONTRACTS**

**Test 1: Lista de proyectos**
```bash
curl "http://localhost:5000/api/projects?period=2025-08" \
  -H "Cookie: connect.sid=YOUR_SESSION"
```

**✅ GO:**
```json
{
  "success": true,
  "data": [
    {
      "id": 5,
      "projectName": "Modo",
      "revenue": 15000,
      "cost": 8500,
      "currency": "USD",
      "markup": 1.76,
      "margin": 0.43,
      "budgetUtilization": 0.85
    }
  ]
}
```

Verificar:
- ✅ `revenue` y `cost` en misma moneda que `currency`
- ✅ `budgetUtilization <= 1.5` (no debería ser >200%)
- ✅ Sin recálculos en frontend (valores pre-computados)

---

**Test 2: Detalle completo**
```bash
curl "http://localhost:5000/api/projects/5/complete-data?period=2025-08&view=operativa" \
  -H "Cookie: connect.sid=YOUR_SESSION"
```

**✅ GO:**
```json
{
  "projectVM": {
    "currencyNative": "USD",
    "revenueDisplay": 15000,
    "costDisplay": 8500,
    "cotizacion": 10000,
    "budgetUtilization": 0.85,
    "teamBreakdown": [
      {
        "name": "Sol Ayala",
        "targetHours": 30,
        "hoursAsana": 26.92,
        "hoursBilling": 26.92,
        "hourlyRateARS": 12500,
        "costARS": 336500,
        "costUSD": 250.37
      }
    ]
  }
}
```

Verificar:
- ✅ `budgetUtilization = costDisplay / cotizacion` (8500/10000 = 0.85)
- ✅ `hoursAsana < 500` (normalizado)
- ✅ `teamBreakdown` tiene al menos 6 miembros
- ✅ Cada miembro tiene 3 tipos de horas (target, asana, billing)

---

**Test 3: Time tracking**
```bash
curl "http://localhost:5000/api/projects/5/time-tracking?period=2025-08" \
  -H "Cookie: connect.sid=YOUR_SESSION"
```

**✅ GO:**
```json
{
  "summary": {
    "totalAsanaHours": 86.2,
    "estimatedHours": 180,
    "progressPct": 47.9
  },
  "members": [
    {
      "name": "Sol Ayala",
      "targetHours": 30,
      "hoursAsana": 26.92,
      "hoursBilling": 26.92
    }
  ]
}
```

Verificar:
- ✅ `totalAsanaHours = Σ hoursAsana` de todos los miembros
- ✅ Datos derivados de SoT (no Excel directo)
- ✅ Todos los miembros tienen horas < 500

---

### **✅ 9. FRONTEND (query keys y empty states)**

**Verificar en DevTools → Network → XHR:**

**Query keys correctos:**
```
/api/projects?period=2025-08           → ['projects', '2025-08']
/api/projects/5/complete-data?...      → ['projects', 5, 'complete-data', '2025-08', 'operativa']
/api/projects/5/time-tracking?...      → ['projects', 5, 'time-tracking', '2025-08']
```

**✅ GO:**
- Query keys incluyen `period` y `view`
- Cambiar período → nueva request automática
- Sin recálculos de KPIs en código JS (solo display)

**❌ NO-GO:**
- Query keys estáticos sin período
- Frontend calcula `markup = revenue / cost` (debería venir del backend)

---

**Empty states:**

Crear proyecto sin datos RC:
```sql
INSERT INTO fact_labor_month (project_id, period_key, person_key, target_hours, asana_hours, billing_hours, hourly_rate_ars, cost_ars, cost_usd, fx)
VALUES (99, '2025-09', 'test_user', 10, 8, 8, 5000, 40000, 29.63, 1350);
```

**✅ GO:**
```json
{
  "projectVM": {
    "revenue": 0,
    "cost": 29.63,
    "budgetUtilization": null,
    "markup": null,
    "margin": null
  }
}
```

Nunca `undefined`, siempre valores explícitos (`null` o `0`)

---

### **✅ 10. FLAGS VISIBLES (auditoría)**

**Query:**
```sql
SELECT 
  project_id,
  person_key,
  flags,
  CAST(asana_hours AS NUMERIC) as asana_h,
  CAST(billing_hours AS NUMERIC) as billing_h,
  CAST(cost_ars AS NUMERIC) as cost_ars
FROM fact_labor_month
WHERE period_key = '2025-08'
  AND (
    flags @> ARRAY['anti_x100_asana']
    OR flags @> ARRAY['anti_x100_billing']
    OR flags @> ARRAY['anti_x100_cost_ars']
    OR flags @> ARRAY['fallback_billing']
    OR flags @> ARRAY['fallback_fx']
    OR flags @> ARRAY['rate_provisional']
  )
ORDER BY person_key;
```

**✅ GO:**
- Flags presentes cuando aplicable
- Al menos 1 fila con `anti_x100_asana` (si Sol Ayala: 2692 → 26.92)
- Flags correlacionan con datos (ej: `fallback_billing` → `billing = asana`)

**❌ NO-GO:**
- Horas > 500 sin flag `anti_x100_*`
- `hourly_rate_ars = 0` sin flag `rate_provisional`

---

## 🎯 **RESUMEN EJECUTIVO**

| # | Checkpoint | Comando/Query | Criterio GO |
|---|------------|---------------|-------------|
| 1 | Períodos | `SELECT COUNT(*) FROM dim_period` | >= 36 filas |
| 2 | Tarifas | `SELECT COUNT(*) FROM dim_person_rate` | >= 72 filas |
| 3 | ANTI×100 | `/api/etl/sot/validate` | `anti100Violations = 0` |
| 4 | FX Fallback | Query flags `fallback_fx` | `missing_fx = 0` |
| 5 | Facts | Query fact_labor/fact_rc | Todas columnas pobladas |
| 6 | Aggregates | Query agg_project_month | KPIs calculados correctos |
| 7 | Invariantes | Query labor_sum vs agg | `diff < 0.01` |
| 8 | API | curl endpoints | Contratos JSON válidos |
| 9 | Frontend | DevTools Network | Query keys con period |
| 10 | Flags | Query flags array | Correlación datos↔flags |

---

## 🚦 **DECISIÓN FINAL**

**✅ GO si:**
- `/api/etl/sot/validate` → `status: "HEALTHY"`
- Invariantes matemáticos cumplen (diff < 0.01)
- APIs devuelven datos coherentes (budget_util = cost/price)
- Flags de auditoría presentes y correlacionan

**❌ NO-GO si:**
- Cualquier validation check > 0
- Invariantes violados (Σfacts ≠ agg)
- APIs con valores NULL cuando debería haber datos
- ANTI×100 no aplicado (horas > 500)

---

## 📞 **Troubleshooting**

### Problema: `missingRates > 0`
**Solución:**
```sql
-- Ver detalles
SELECT * FROM dim_person_rate WHERE period_key = '2025-08';

-- Poblar catálogo general si falta
INSERT INTO dim_person_rate (person_id, project_id, period_key, hourly_rate_ars, source)
SELECT id, NULL, '2025-08', hourly_rate_ars, 'baseline'
FROM personnel
WHERE hourly_rate_ars IS NOT NULL;
```

### Problema: `anti100Violations > 0`
**Solución:** Re-ejecutar ETL con fix:
```bash
curl -X POST http://localhost:5000/api/etl/sot/run \
  -d '{"scopes": {"periods": ["2025-08"]}, "recomputeAgg": true}'
```

### Problema: `invariantViolations > 0`
**Solución:** Forzar recálculo de aggregates:
```bash
curl -X POST http://localhost:5000/api/etl/sot/recompute-aggregates
```

---

**Autor:** Sistema SoT Star Schema  
**Versión:** 1.0  
**Fecha:** Octubre 2025
