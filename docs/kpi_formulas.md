# KPI Formulas - Dashboard Ejecutivo

Este documento contiene las fórmulas oficiales de todos los KPIs utilizados en el Dashboard Ejecutivo.

## 1. Vista Operativa

**Propósito:** Productividad del equipo. Solo devengado y costos directos.

### EBIT Operativo
- **Definición:** Resultado operativo puro del equipo
- **Fórmula:** `Devengado - Directos`
- **Ejemplo:** $100,000 - $30,000 = $70,000
- **Fuente:** fact_rc_month.revenue_usd, fact_cost_month.direct_usd

### Margen Operativo
- **Definición:** Porcentaje de rentabilidad operativa
- **Fórmula:** `EBIT Operativo / Devengado * 100`
- **Ejemplo:** $70,000 / $100,000 = 70%
- **Fuente:** Calculado

### Markup
- **Definición:** Multiplicador sobre el costo directo
- **Fórmula:** `Devengado / Directos`
- **Ejemplo:** $100,000 / $30,000 = 3.33x
- **Fuente:** Calculado

### Tarifa Efectiva
- **Definición:** Ingreso promedio por hora facturable
- **Fórmula:** `Devengado / Horas Facturables`
- **Ejemplo:** $100,000 / 1,000h = $100/h
- **Fuente:** fact_rc_month.revenue_usd, fact_labor_month.billing_hours

### % Facturable
- **Definición:** Proporción de horas facturables sobre totales
- **Fórmula:** `Horas Facturables / Horas Totales * 100`
- **Ejemplo:** 800h / 1,000h = 80%
- **Fuente:** fact_labor_month

---

## 2. Vista Económica

**Propósito:** Resultado operativo real. Incluye overhead. Sin provisiones.

### EBIT Económico
- **Definición:** Resultado después de overhead, antes de provisiones
- **Fórmula:** `Devengado - Directos - Overhead`
- **Ejemplo:** $100,000 - $30,000 - $20,000 = $50,000
- **Fuente:** fact_rc_month.revenue_usd, fact_cost_month (direct_usd, indirect_usd)

### Margen Económico
- **Definición:** Rentabilidad después de overhead
- **Fórmula:** `EBIT Económico / Devengado * 100`
- **Ejemplo:** $50,000 / $100,000 = 50%
- **Fuente:** Calculado

### Overhead % Total
- **Definición:** Proporción de overhead sobre costos totales
- **Fórmula:** `Overhead / (Directos + Overhead) * 100`
- **Objetivo:** < 45%
- **Ejemplo:** $20,000 / ($30,000 + $20,000) = 40%
- **Fuente:** fact_cost_month (direct_usd, indirect_usd)

---

## 3. Vista Financiera

**Propósito:** Resultado contable + caja. Incluye provisiones e impuestos.

### EBIT Contable
- **Definición:** Resultado contable real
- **Fórmula:** `Facturado - Directos - Overhead - Provisiones`
- **Ejemplo:** $90,000 - $30,000 - $20,000 - $10,000 = $30,000
- **Fuente:** monthly_financial_summary.facturacion_total, fact_cost_month

### Burn Rate
- **Definición:** Gasto total mensual
- **Fórmula:** `Directos + Overhead + Provisiones`
- **Ejemplo:** $30,000 + $20,000 + $10,000 = $60,000
- **Fuente:** fact_cost_month (direct_usd, indirect_usd, provisions_usd)

### Margen Contable
- **Definición:** Rentabilidad contable
- **Fórmula:** `EBIT Contable / Facturado * 100`
- **Ejemplo:** $30,000 / $90,000 = 33.3%
- **Fuente:** Calculado

### Cash Flow Neto
- **Definición:** Flujo de caja del período
- **Fórmula:** `Cash In - Cash Out`
- **Ejemplo:** $80,000 - $50,000 = $30,000
- **Fuente:** cash_movements (type IN/OUT)

### Caja Total
- **Definición:** Saldo de caja al cierre del período
- **Fórmula:** Snapshot directo del Excel Maestro
- **Fuente:** monthly_financial_summary.caja_total

### Patrimonio
- **Definición:** Valor neto de la empresa
- **Fórmula:** `Activo - Pasivo`
- **Ejemplo:** $200,000 - $50,000 = $150,000
- **Fuente:** monthly_financial_summary (total_activo, total_pasivo)

### Runway
- **Definición:** Meses de operación con caja actual
- **Fórmula:** `Caja Total / Burn Rate`
- **Ejemplo:** $150,000 / $60,000 = 2.5 meses
- **Fuente:** Calculado

---

## Validaciones de Coherencia

Cada mes debe cumplir:

```
EBIT Operativo = Devengado - Directos
EBIT Económico = Devengado - Directos - Overhead
EBIT Contable = Facturado - Directos - Overhead - Provisiones
Burn Rate = Directos + Overhead + Provisiones
Patrimonio = Activo - Pasivo
```

Si algún KPI difiere del cálculo esperado, se reporta error en consola.
