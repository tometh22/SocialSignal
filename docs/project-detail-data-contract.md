# Contrato de Datos - Vista Única de Proyecto

## Estructura General de `unifiedData`

El componente `project-details-redesigned.tsx` espera recibir un objeto `unifiedData` del endpoint `/api/projects/:id/complete-data` con la siguiente estructura:

```typescript
interface UnifiedData {
  project: ProjectData;
  quotation: QuotationData;
  actuals: ActualsData;
  metrics: MetricsData;
  summary: SummaryData;
  teamBreakdown: TeamMember[];
  ingresos: IncomeEntry[];
  costos: CostEntry[];
  // Legacy fields
  estimatedHours: number;
  workedHours: number;
  totalCost: number;
  totalRealRevenue: number;
}
```

---

## 1. 📊 PESTAÑA: Dashboard

### Datos Requeridos:

#### De `quotation`:
- ✅ **`totalAmountNative`** (number) - Monto total de la cotización en moneda nativa (ARS/USD)
- ✅ **`estimatedHours`** (number) - Horas estimadas del proyecto
- ✅ **`baseCost`** (number) - Costo base de la cotización

#### De `summary`:
- ✅ **`costDisplay`** (number) - Costo real a mostrar en moneda nativa
- ✅ **`revenueDisplay`** (number) - Ingreso a mostrar en moneda nativa
- ✅ **`currencyNative`** (string: 'ARS' | 'USD') - Moneda nativa del proyecto
- ✅ **`markup`** (number) - Ratio de markup
- ✅ **`margin`** (number) - Margen de ganancia
- ✅ **`flags`** (string[]) - Banderas especiales (ej: 'RECONCILER_OVERRIDE')

#### De `metrics`:
- ✅ **`markup`** (number) - Ratio de markup calculado
- ✅ **`margin`** (number) - Margen calculado
- ✅ **`efficiency`** (number) - Eficiencia del equipo (porcentaje)
- ✅ **`budgetUtilization`** (number) - Utilización del presupuesto

#### De `actuals`:
- ✅ **`totalWorkedHours`** (number) - Horas trabajadas totales
- ✅ **`totalWorkedCost`** (number) - Costo real trabajado
- ✅ **`teamBreakdown`** (array) - Desglose por persona:
  ```typescript
  {
    personnelId: string;
    name: string;
    roleName: string;
    actualHours: number;
    actualCost: number;
    estimatedHours: number;
  }[]
  ```

#### De `project`:
- ✅ **`id`** (number) - ID del proyecto
- ✅ **`clientId`** (number) - ID del cliente
- ✅ **`status`** (string) - Estado del proyecto

### Cards que muestra:
1. **Markup del Proyecto** - Usa `metrics.markup`
2. **Eficiencia** - Usa `metrics.efficiency`
3. **Presupuesto Usado** - Calcula con `costDisplay / totalAmountNative`
4. **Horas Trabajadas vs Estimadas** - Usa `actuals.totalWorkedHours` y `quotation.estimatedHours`
5. **Análisis de Equipo** - Usa `actuals.teamBreakdown`

---

## 2. 👥 PESTAÑA: Equipo (team-analysis)

### Datos Requeridos:

#### De `actuals.teamBreakdown`:
```typescript
{
  personnelId: string;
  name: string;
  roleName: string;  // ⚠️ IMPORTANTE: Debe ser 'roleName' no 'role'
  actualHours: number;
  actualCost: number;
  estimatedHours: number;
  efficiency: number;
  rate: number | null;
}[]
```

#### Endpoint adicional:
- **`/api/projects/:id/deviation-analysis`** - Análisis de desviación del equipo

### Componentes que usa:
- `<TeamDeviationAnalysis>` - Requiere endpoint de desviación

---

## 3. 🔥 PESTAÑA: Performance

### Datos Requeridos:

#### De `project`:
- ✅ **`id`** (number) - ID del proyecto para rankings

#### Endpoint adicional:
- **`/api/projects/:id/performance-rankings`** - Rankings de performance

### Componentes que usa:
- `<EconomicRankings>` - Requiere projectId

---

## 4. ⏱️ PESTAÑA: Tiempo (time-management)

### Datos Requeridos:

#### Básicos:
- ✅ **`projectId`** (number) - ID del proyecto

### Componentes que usa:
- `<TimeTracking>` - Gestión de tiempo del proyecto

---

## 5. 💵 PESTAÑA: Ingresos (income-details)

### Datos Requeridos:

#### De `ingresos`:
```typescript
{
  id: number;
  date: string;
  amount: number;
  description: string;
  currency: string;
}[]
```

#### Básicos:
- ✅ **`projectId`** (number)
- ✅ **`dateFilter`** (objeto) - Filtro temporal actual

### Componentes que usa:
- `<IncomeDashboardTable>` - Tabla de ingresos

---

## 6. 💰 PESTAÑA: Costos (cost-details)

### Datos Requeridos:

#### De `costos`:
```typescript
{
  id: number;
  date: string;
  amount: number;
  description: string;
  currency: string;
  type: string;
}[]
```

#### Básicos:
- ✅ **`projectId`** (number)
- ✅ **`dateFilter`** (objeto) - Filtro temporal actual

### Componentes que usa:
- `<CostDashboard>` - Dashboard de costos

---

## 7. 📈 PESTAÑA: Financiero (financial-analysis)

### Datos Requeridos:

#### De `summary`:
- ✅ **`costDisplay`** (number) - Costo en moneda nativa
- ✅ **`revenueDisplay`** (number) - Ingreso en moneda nativa
- ✅ **`currencyNative`** (string) - Moneda nativa
- ✅ **`markup`** (number) - Markup
- ✅ **`margin`** (number) - Margen

#### De `quotation`:
- ✅ **`totalAmountNative`** (number) - Cotización en moneda nativa

### Cards que muestra:
1. **Rendimiento Financiero** - Muestra ingresos y costos
2. **Margen de Ganancia** - Calcula margen
3. **ROI del Proyecto** - Calcula retorno de inversión

---

## 8. ⚙️ PESTAÑA: Operacional (operational-analysis)

### Datos Requeridos:

#### De `actuals`:
- ✅ **`totalWorkedHours`** (number)
- ✅ **`teamBreakdown`** (array)

#### De `quotation`:
- ✅ **`estimatedHours`** (number)
- ✅ **`totalAmountNative`** (number)

#### De `summary`:
- ✅ **`costDisplay`** (number)
- ✅ **`currencyNative`** (string)

### Cards que muestra:
1. **Eficiencia Operativa** - Horas trabajadas vs estimadas
2. **Costo por Hora** - Costo total / horas trabajadas
3. **Productividad del Equipo** - Análisis por persona

---

## 🔒 REGLAS CRÍTICAS

### 1. Consistencia de Moneda
- **NUNCA** mezclar USD y ARS en cálculos
- **SIEMPRE** usar `quotation.totalAmountNative` (no `totalAmount`)
- **SIEMPRE** usar `summary.costDisplay` y `summary.revenueDisplay` (ya en moneda nativa)

### 2. Cálculo de Métricas
```typescript
// ✅ CORRECTO
const budgetUtilization = costDisplay / totalAmountNative;
const markup = totalAmountNative / costDisplay;
const margin = (totalAmountNative - costDisplay) / totalAmountNative;

// ❌ INCORRECTO (mezcla USD y ARS)
const budgetUtilization = costDisplay / totalAmount; // ¡Error!
```

### 3. Campos Requeridos vs Opcionales

#### SIEMPRE Requeridos:
- `summary.costDisplay`
- `summary.currencyNative`
- `quotation.totalAmountNative`

#### Opcionales (con fallback):
- `quotation.estimatedHours` (fallback: -1)
- `metrics.markup` (fallback: 0)
- `metrics.efficiency` (fallback: 0)

---

## 📝 Ejemplo de Respuesta Completa del Backend

```json
{
  "project": {
    "id": 43,
    "clientId": 15,
    "status": "active"
  },
  "quotation": {
    "id": 264,
    "projectName": "Fee mensual",
    "baseCost": 1000,
    "totalAmount": 1000,
    "totalAmountNative": 1345000,  // ⭐ CRÍTICO: En ARS para Coelsa
    "estimatedHours": 120,
    "markupAmount": 0,
    "marginFactor": 2.0
  },
  "actuals": {
    "totalWorkedCost": 411.15,
    "totalWorkedRevenue": 0,
    "totalWorkedHours": 32.02,
    "totalEntries": 2,
    "teamBreakdown": [
      {
        "personnelId": "Gast Guntren",
        "name": "Gast Guntren",
        "roleName": "From Excel MAESTRO",  // ⭐ roleName no 'role'
        "estimatedHours": 0,
        "actualHours": 0,
        "actualCost": 350.07,
        "budgetedCost": 0,
        "rate": null,
        "efficiency": 0
      }
    ]
  },
  "metrics": {
    "efficiency": 59.3,
    "markup": 0.41,
    "margin": -0.59,
    "budgetUtilization": 0.41,
    "hoursDeviation": 0,
    "costDeviation": 0
  },
  "summary": {
    "period": "2025-08",
    "basis": "ECON",
    "activeMembers": 2,
    "totalHours": 32.02,
    "efficiencyPct": 59.3,
    "teamCostUSD": 411.15,
    "revenueUSD": 0,
    "markupUSD": -411.15,
    "costDisplay": 553002,       // ⭐ CRÍTICO: En ARS para Coelsa
    "revenueDisplay": 0,
    "currencyNative": "ARS",      // ⭐ CRÍTICO: Moneda nativa
    "markup": 0.41,
    "margin": -0.59,
    "flags": ["RECONCILER_OVERRIDE"]
  },
  "teamBreakdown": [...],
  "ingresos": [],
  "costos": [],
  "estimatedHours": 0,
  "workedHours": 32.02,
  "totalCost": 411.15,
  "totalRealRevenue": 0
}
```

---

## 🚨 Problemas Comunes y Soluciones

### Error: "Invalid multiplier or base values"
**Causa**: `quotation.totalAmountNative` no está presente o está en USD cuando `currencyNative` es ARS.
**Solución**: Backend debe calcular `totalAmountNative` según `currencyNative`.

### Error: "Property 'role' does not exist"
**Causa**: El backend envía `role` pero el tipo espera `roleName`.
**Solución**: Usar `roleName` en teamBreakdown.

### Error: Métricas incorrectas
**Causa**: Cálculos mezclando USD y ARS.
**Solución**: Usar siempre valores nativos (`totalAmountNative`, `costDisplay`, `revenueDisplay`).
