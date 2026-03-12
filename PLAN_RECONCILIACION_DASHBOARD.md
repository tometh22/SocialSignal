# Plan: Reconciliación Dashboard Ejecutivo

## Objetivo
Reemplazar las 3 vistas actuales (Operativo, Económico, Finanzas) por un dashboard unificado con estructura P&L en cascada que coincida exactamente con los números de Looker Studio.

## Problema actual
- 3 vistas con fórmulas diferentes que no se reconcilian entre sí
- Ninguna coincide con Looker (la fuente validada)
- Métricas clave divergen significativamente (EBIT, Markup, Ventas, Cashflow)

## Fuente de verdad
**Looker Studio** lee directamente del Google Sheet "Resumen Ejecutivo" (pestaña), que tiene datos curados manualmente. Estos son los números correctos.

La app ya sincroniza esta pestaña a `monthly_financial_summary`. Esa tabla DEBE ser la fuente primaria para el dashboard ejecutivo.

---

## Fórmulas canónicas (de Looker)

```
Ventas del mes = facturacion_total (sin IVA)
Costos Directos = costos_directos (equipo, incluyendo bonos y ajustes)
EBIT Utilidad Operativa = Ventas - Costos Directos - Costos Indirectos (sin impuestos)
Margen Operativo = EBIT / Ventas × 100
Markup = Ventas / Costos Directos
Beneficio Neto = EBIT - Impuestos (USA + ARG)
Margen Neto = Beneficio Neto / Ventas × 100
Cashflow Neto = cashflow_neto (de monthly_financial_summary)
```

---

## Arquitectura nueva

### Backend: Un solo endpoint `/api/v1/executive/dashboard`

Lee EXCLUSIVAMENTE de `monthly_financial_summary` para las métricas ejecutivas.
Complementa con `fact_labor_month`, `agg_project_month`, `cash_movements` para drill-downs.

```typescript
// Respuesta del endpoint
{
  // === P&L CASCADA (de monthly_financial_summary) ===
  ventasMes: number,           // facturacion_total
  costosDirectos: number,      // costos_directos
  margenBruto: number,         // ventas - directos
  margenBrutoPct: number,      // margenBruto / ventas × 100
  costosIndirectos: number,    // costos_indirectos (overhead)
  ebitOperativo: number,       // ventas - directos - indirectos
  margenOperativoPct: number,  // ebit / ventas × 100
  impuestos: number,           // impuestos_usa + (otros)
  beneficioNeto: number,       // ebit - impuestos
  margenNetoPct: number,       // beneficioNeto / ventas × 100
  markup: number,              // ventas / directos

  // === BALANCE (de monthly_financial_summary) ===
  totalActivo: number,
  totalPasivo: number,
  balanceNeto: number,         // activo - pasivo
  cajaTotalUsd: number,        // caja_total
  inversiones: number,
  cuentasCobrarUsd: number,
  cuentasPagarUsd: number,

  // === CASHFLOW (de monthly_financial_summary + cash_movements) ===
  cashflowNeto: number,        // cashflow_neto de MFS
  cashflowIngresos: number,
  cashflowEgresos: number,

  // === PROYECCIÓN ===
  burnRate: number,            // directos + indirectos + impuestos
  runway: number,              // cajaTotalUsd / burnRate

  // === TENDENCIAS (12 meses) ===
  trends: MonthlyData[],       // Array de MFS para los últimos 12 meses

  // === METADATA ===
  period: string,
  availablePeriods: string[],
  lastSync: string
}
```

### Frontend: Dashboard unificado

**Página 1 - Resumen Ejecutivo**
```
┌─────────────────────────────────────────────────────┐
│  [Selector Período: Ene 2026 ▼]    [↻ Refresh]     │
├─────────────────────────────────────────────────────┤
│                                                     │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐         │
│  │ VENTAS   │  │ EBIT     │  │BENEFICIO │         │
│  │ $41.6k   │  │ $-2.9k   │  │ $-3.5k   │         │
│  │          │  │ -7.03%   │  │ -8.47%   │         │
│  └──────────┘  └──────────┘  └──────────┘         │
│                                                     │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐         │
│  │ MARKUP   │  │ CASHFLOW │  │ CAJA     │         │
│  │ 3.61x    │  │ $105.8k  │  │ $52.2k   │         │
│  └──────────┘  └──────────┘  └──────────┘         │
│                                                     │
│  ═══════════ CASCADA P&L ═══════════               │
│  Ventas del mes           $41,594  ────────── 100% │
│  - Costos Directos       -$11,520                  │
│  = Margen Bruto           $30,074  ──────── 72.3%  │
│  - Costos Indirectos     -$32,997                  │
│  = EBIT Operativo         -$2,923  ──────── -7.0%  │
│  - Impuestos                -$598                  │
│  = Beneficio Neto         -$3,521  ──────── -8.5%  │
│                                                     │
│  ═══════════ BALANCE ═══════════                   │
│  Activo Líquido    $52,229                         │
│  M.P. Crypto        $2,053                         │
│  Balance Neto      $51,688                         │
│                                                     │
│  ═══════════ TENDENCIAS (12m) ═══════════          │
│  [Gráfico línea: Ventas + EBIT]                    │
│  [Gráfico barras: Cashflow]                        │
└─────────────────────────────────────────────────────┘
```

**Navegación lateral (sub-páginas existentes que se mantienen):**
- Activo (detalle) → ya existe parcialmente en Looker
- Pasivo (detalle) → ya existe parcialmente en Looker
- Cash Flow (detalle) → ya existe en la app
- ARR → ya existe en Looker
- Costos (desglose) → directos vs indirectos
- Rendimiento Cliente → ya existe en Looker
- Rendimiento Proyectos → ya existe en Looker

---

## Pasos de implementación

### Paso 1: Nuevo endpoint backend
- Crear `/api/v1/executive/dashboard` que lee de `monthly_financial_summary`
- Usar las fórmulas canónicas de Looker
- Incluir tendencias de 12 meses
- Incluir períodos disponibles

### Paso 2: Nuevo componente frontend
- Crear `UnifiedDashboard.tsx` con la estructura P&L en cascada
- Reusar ChartCard, KpiCard existentes
- Agregar componente WaterfallPnL para la cascada visual

### Paso 3: Reemplazar ruta del dashboard
- `/dashboard` → UnifiedDashboard (en vez de executive-dashboard-new)
- Mantener las 3 vistas anteriores accesibles temporalmente en `/legacy/operativo`, etc.

### Paso 4: Validación cruzada
- Comparar número a número con Looker para cada mes disponible
- Ajustar si hay discrepancias

### Paso 5: Limpieza
- Eliminar endpoints legacy (`/api/v1/executive/operativo`, `/economico`, `/finanzas`)
- Eliminar componentes legacy (OperativoView, EconomicoView, FinanzasView)

---

## Criterio de éxito
Para cada mes con datos en Looker, los siguientes números deben coincidir exactamente:
- [ ] Ventas del mes
- [ ] EBIT Utilidad operativa
- [ ] Beneficio Neto
- [ ] Margen Operativo
- [ ] Margen Neto
- [ ] Markup
- [ ] Cashflow
- [ ] Activo Líquido
- [ ] Balance Neto
- [ ] Activo Total / Pasivo Total
