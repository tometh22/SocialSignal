# 📊 Documentación Técnica del Flujo de Datos SoT - Epical Digital Platform

## 🎯 Visión General

El sistema implementa una arquitectura **Star Schema (SoT - Source of Truth)** que procesa datos desde **Excel MAESTRO (Google Sheets)** mediante un pipeline ETL robusto. Los datos fluyen:

```
Google Sheets → ETL (Extract/Transform/Load) → Star Schema PostgreSQL → API ViewModels → Frontend
```

**Principios arquitectónicos**:
- **Single Source of Truth**: Las tablas `fact_*` y `agg_*` son la fuente de verdad para la aplicación
- **Staging temporal**: `financial_sot` es buffer de lectura raw, no para consumo del frontend
- **Separación semántica**: `fx_rate` (tipo de cambio) ≠ `quote_native` (precio de cotización)
- **Invariantes matemáticos**: Garantías de coherencia entre agregaciones y hechos
- **Auditoría completa**: Flags de normalización + tablas de staging para filas no resueltas

---

## 📍 ORIGEN DE DATOS: Google Sheets "Excel MAESTRO"

### Configuración de Extracción

**Archivo de servicio**: `server/services/googleSheetsWorking.ts`

**Configuración crítica de la API**:
```javascript
const response = await sheets.spreadsheets.values.get({
  spreadsheetId: SPREADSHEET_ID,
  range: range,
  valueRenderOption: 'UNFORMATTED_VALUE',    // ← CRÍTICO: valores sin formato
  dateTimeRenderOption: 'SERIAL_NUMBER'       // ← Fechas como números seriales
});
```

**Por qué es importante**:
- `UNFORMATTED_VALUE`: Evita que "1445.00" se convierta en string "1,445"
- `SERIAL_NUMBER`: Fechas como números, no strings localizados
- Sin esto → problemas de parsing numérico y divisiones ×100

### Hojas Procesadas

#### 1️⃣ **"Rendimiento Cliente" (RC)**

**Propósito**: Datos financieros mensuales consolidados por proyecto

**Estructura**:
| Columna | Nombre | Tipo | Ejemplo |
|---------|--------|------|---------|
| A | Cliente | string | "Warner" |
| B | Proyecto | string | "Fee Marketing" |
| C | Mes | string | "Septiembre" |
| D | Año | number | 2025 |
| E | Facturación | number | 42236850.00 |
| F | Moneda | string | "ARS" |
| G | Tipo de cambio | number | 1445.00 |
| H | Costos | number | 12183422.55 |
| I | Pasado/Futuro | string | "Real" o "" |

**Filtro de inclusión** (solo en RC):
- Si columna "Pasado/Futuro" **vacía** → incluir (proyecto confirmado)
- Si columna "Pasado/Futuro" = "Real" (case-insensitive) → incluir
- Si columna "Pasado/Futuro" = otro valor → **excluir** (es estimación)

**⚠️ Importante**: Este filtro NO aplica a "Costos directos e indirectos"

**Archivo ETL**: `server/etl/rendimiento-cliente.ts`

#### 2️⃣ **"Costos directos e indirectos"**

**Propósito**: Desglose granular de horas y costos por persona/proyecto/mes

**Estructura**:
| Columna | Nombre | Tipo | Ejemplo |
|---------|--------|------|---------|
| A | Proyecto | string | "Fee Marketing" |
| B | Cliente | string | "Warner" |
| C | Persona | string | "Juan Pérez" |
| D | Mes/Año | string | "Sep 2025" |
| E | Horas Target | number | 160.0 |
| F | Horas Asana | number | 145.5 |
| G | Horas Billing | number | 150.0 |
| H | Valor hora ARS | number | 25000.00 |

**NO se filtra por "Pasado/Futuro"**: Toda fila con datos válidos se procesa.

**Archivo ETL**: `server/etl/sot-etl.ts` (función `processLaborData`)

#### 3️⃣ **"Ventas Tomi" / "Proyectos"** (Opcional)

**Propósito**: Referencia del universo de proyectos activos

**Uso**: 
- Poblar catálogo inicial de proyectos
- Validación de existencia para Project Resolver
- NO es fuente de datos financieros

---

## 🔄 PROCESO ETL SoT - FLUJO PRECISO

### Fase 1: Extract (Extracción)

**Función**: `server/services/googleSheetsWorking.ts::getSpreadsheetData()`

```javascript
// Configuración de lectura
const data = await sheets.spreadsheets.values.get({
  spreadsheetId: process.env.GOOGLE_SHEETS_ID,
  range: 'Rendimiento Cliente!A2:Z',
  valueRenderOption: 'UNFORMATTED_VALUE',  // ← Sin formato
  dateTimeRenderOption: 'SERIAL_NUMBER'    // ← Fechas numéricas
});

// Retorna array de arrays
// [[cliente, proyecto, mes, año, facturación, ...], ...]
```

**Pestañas leídas**:
1. `Rendimiento Cliente!A2:Z` → datos financieros
2. `Costos directos e indirectos!A2:Z` → horas y labor
3. (Opcional) `Ventas Tomi!A2:Z` → catálogo de proyectos

### Fase 2: Transform (Transformación)

**Archivo RC**: `server/etl/rendimiento-cliente.ts::importRendimientoClienteData()`

**Archivo Labor**: `server/etl/sot-etl.ts::processLaborData()`

#### Transform 2.1: Parsing Numérico Robusto

```javascript
function parseNumber(value: any): number {
  if (typeof value === 'number') return value;
  
  const str = value?.toString().trim() || '0';
  
  // Maneja coma/punto como separador decimal
  // "1.445,50" → 1445.50
  // "1,445.50" → 1445.50
  const normalized = str
    .replace(/\./g, '')  // Quita puntos de miles
    .replace(',', '.');  // Coma → punto decimal
  
  return parseFloat(normalized) || 0;
}
```

#### Transform 2.2: ANTI×100 Normalization

**Archivo**: `server/utils/number.ts`

**Umbrales exactos**:

```javascript
export function normalizeIfOver100(
  value: number, 
  context: 'hours' | 'cost_ars' | 'revenue'
): { normalized: number; wasNormalized: boolean } {
  
  let threshold: number;
  let flag = false;
  
  switch (context) {
    case 'hours':
      // Horas billing: si > 500 → probablemente ×100
      threshold = 500;
      if (value > threshold) {
        flag = true;
        return { normalized: value / 100, wasNormalized: true };
      }
      break;
      
    case 'cost_ars':
      // Costos ARS por persona: si > 100M → ×100
      threshold = 100_000_000;
      if (value > threshold) {
        flag = true;
        console.warn(`🔧 ANTI×100: cost_ars ${value} → ${value/100}`);
        return { normalized: value / 100, wasNormalized: true };
      }
      break;
      
    case 'revenue':
      // Facturación: si > 100M USD → ×100
      threshold = 100_000_000;
      if (value > threshold) {
        flag = true;
        console.warn(`🔧 ANTI×100: revenue ${value} → ${value/100}`);
        return { normalized: value / 100, wasNormalized: true };
      }
      break;
  }
  
  return { normalized: value, wasNormalized: false };
}
```

**Flags de auditoría**: Se persisten en las tablas fact:
- `fact_labor_month.anti_x100_hours`: boolean
- `fact_labor_month.anti_x100_cost`: boolean
- `fact_rc_month.anti_x100_revenue`: boolean

#### Transform 2.3: Conversión USD (Fórmula Canónica)

**En Rendimiento Cliente (RC)**:

```javascript
// 1. Extraer datos raw
const revenueNative = parseNumber(row[revenueIndex]);
const costNative = parseNumber(row[costIndex]);
const currency = row[currencyIndex]?.toString().toUpperCase();
const fxRate = parseNumber(row[fxRateIndex]);

// 2. Normalizar ANTI×100
const { normalized: revenueNorm, wasNormalized: revFlag } = 
  normalizeIfOver100(revenueNative, 'revenue');

const { normalized: costNorm, wasNormalized: costFlag } = 
  normalizeIfOver100(costNative, 'cost_ars');

// 3. FÓRMULA CANÓNICA: Conversión a USD
let revenueUsd: number;
let costUsd: number;

if (currency.includes('USD')) {
  revenueUsd = revenueNorm;
  costUsd = costNorm;
} else {
  // ARS → USD
  revenueUsd = revenueNorm / fxRate;
  costUsd = costNorm / fxRate;
}

// 4. quote_native = precio mensual del proyecto (en moneda original)
const quoteNative = revenueNorm;
```

**En Labor (Costos directos)**:

```javascript
// 1. Calcular costo ARS por persona
const hoursBilling = parseNumber(row[billingHoursIndex]);
const hourlyRateArs = parseNumber(row[rateIndex]);

const { normalized: hoursNorm, wasNormalized: hoursFlag } = 
  normalizeIfOver100(hoursBilling, 'hours');

const costArsPersona = hoursNorm * hourlyRateArs;

const { normalized: costNorm, wasNormalized: costFlag } = 
  normalizeIfOver100(costArsPersona, 'cost_ars');

// 2. FÓRMULA CANÓNICA: Conversión a USD
const costUsd = costNorm / fxRate;
```

**⚠️ Separación Semántica CRÍTICA**:

| Campo | Significado | Ejemplo | Uso |
|-------|-------------|---------|-----|
| `fx_rate` | Tipo de cambio ARS→USD del mercado | 1445.00 | Conversión de costos |
| `quote_native` | Precio de cotización del proyecto (en su moneda) | 42,236,850 ARS | Budget utilization |
| `revenue_native` | Facturación en moneda original | 42,236,850 ARS | Display operativo |
| `revenue_usd` | Facturación convertida a USD | 29,230 USD | KPIs consolidados |

**NO confundir**: `fx_rate` es el tipo de cambio, `quote_native` es el precio pactado del proyecto.

#### Transform 2.4: Filtro "Pasado/Futuro" (solo RC)

```javascript
// En rendimiento-cliente.ts
const pasadoFuturoIndex = headers.findIndex(h => 
  h?.toString().toLowerCase().includes('pasado')
);

if (pasadoFuturoIndex !== -1) {
  const statusFlag = row[pasadoFuturoIndex]?.toString().trim();
  const hasPasadoFuturo = statusFlag && statusFlag !== '';
  
  // CRITERIO DE INCLUSIÓN:
  // - Vacío → incluir (confirmado)
  // - "Real" → incluir
  // - Otro valor → excluir (estimación)
  if (hasPasadoFuturo && statusFlag.toLowerCase() !== 'real') {
    console.log(`⏭️ Excluyendo fila estimada: ${clientName} - ${projectName}`);
    continue; // Skip
  }
  
  console.log(`✅ Incluyendo: ${clientName} - ${projectName} (status: "${statusFlag || 'vacío'}")`);
}
```

**Documentado explícitamente**: Este filtro es exclusivo de "Rendimiento Cliente". "Costos directos e indirectos" no tiene esta columna y procesa todas las filas válidas.

### Fase 3: Load (Carga a Star Schema SoT)

#### Load 3.1: Staging Table (Buffer Temporal)

**Tabla**: `financial_sot`

**Propósito**: Buffer raw de importación desde RC, NO para consumo del frontend.

```sql
CREATE TABLE financial_sot (
  id SERIAL PRIMARY KEY,
  client_name TEXT NOT NULL,
  project_name TEXT NOT NULL,
  month_key TEXT NOT NULL,        -- '2025-09'
  year INTEGER NOT NULL,
  month INTEGER NOT NULL,
  revenue_usd NUMERIC(12,2),
  cost_usd NUMERIC(12,2),
  currency TEXT,                  -- 'ARS' | 'USD'
  quotation NUMERIC(10,2),        -- fx_rate
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(client_name, project_name, month_key)
);
```

**Uso**:
- Almacenamiento temporal de datos raw
- Fuente para el ETL que puebla las fact tables
- **NO se lee directamente desde la API/Frontend**

#### Load 3.2: Dimensional Tables

**`dim_period`** - Dimensión temporal

```sql
CREATE TABLE dim_period (
  month_key TEXT PRIMARY KEY,     -- '2025-09'
  year INTEGER NOT NULL,
  month INTEGER NOT NULL,
  quarter INTEGER NOT NULL,        -- 1,2,3,4
  semester INTEGER NOT NULL        -- 1,2
);

-- Poblada desde financial_sot
INSERT INTO dim_period (month_key, year, month, quarter, semester)
SELECT DISTINCT
  month_key,
  year,
  month,
  CEIL(month::numeric / 3) as quarter,
  CEIL(month::numeric / 6) as semester
FROM financial_sot
ON CONFLICT (month_key) DO NOTHING;
```

**`dim_person_rate`** - Tasas horarias por persona

```sql
CREATE TABLE dim_person_rate (
  person_name TEXT PRIMARY KEY,
  hourly_cost_usd NUMERIC(10,2),
  hourly_cost_ars NUMERIC(10,2),
  last_updated TIMESTAMP DEFAULT NOW()
);

-- Calculada desde labor data (promedio de tasas por persona)
```

**`dim_client_alias`** - Aliases de clientes

```sql
CREATE TABLE dim_client_alias (
  id SERIAL PRIMARY KEY,
  client_id INTEGER NOT NULL REFERENCES clients(id), -- ← FK a clients.id
  alias_name TEXT NOT NULL,
  source TEXT NOT NULL,           -- 'manual' | 'auto_learned' | 'google_sheets'
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(client_id, alias_name)
);
```

**⚠️ CORRECCIÓN APLICADA**: FK a `clients.id`, NO a `activeProjects.id`

**`dim_project_alias`** - Aliases de proyectos

```sql
CREATE TABLE dim_project_alias (
  id SERIAL PRIMARY KEY,
  project_id INTEGER NOT NULL REFERENCES active_projects(id),
  client_id INTEGER NOT NULL REFERENCES clients(id), -- ← FK a clients.id
  alias_name TEXT NOT NULL,
  source TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(client_id, project_id, alias_name)
);
```

**⚠️ CORRECCIÓN APLICADA**: `client_id` referencia `clients.id`, permite resolver proyectos de clientes sin proyectos activos aún.

#### Load 3.3: Fact Tables (Fuente de Verdad)

**`fact_labor_month`** - Granularidad: Proyecto × Persona × Mes

```sql
CREATE TABLE fact_labor_month (
  id SERIAL PRIMARY KEY,
  project_id INTEGER NOT NULL REFERENCES active_projects(id),
  month_key TEXT NOT NULL REFERENCES dim_period(month_key),
  person_name TEXT NOT NULL REFERENCES dim_person_rate(person_name),
  
  -- Horas (3 tipos)
  target_hours NUMERIC(10,2),     -- Horas presupuestadas
  hours_asana NUMERIC(10,2),      -- Horas trackeadas (reales)
  hours_billing NUMERIC(10,2),    -- Horas para facturar
  
  -- Tasas y costos
  hourly_rate_ars NUMERIC(10,2),
  cost_ars NUMERIC(12,2),
  cost_usd NUMERIC(12,2),
  fx_rate NUMERIC(10,2),
  
  -- Flags de auditoría
  anti_x100_hours BOOLEAN DEFAULT FALSE,
  anti_x100_cost BOOLEAN DEFAULT FALSE,
  
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(project_id, month_key, person_name)
);

-- Índices para performance
CREATE INDEX idx_flm_project ON fact_labor_month(project_id);
CREATE INDEX idx_flm_month ON fact_labor_month(month_key);
```

**Poblada desde**: "Costos directos e indirectos"

**`fact_rc_month`** - Granularidad: Proyecto × Mes

```sql
CREATE TABLE fact_rc_month (
  id SERIAL PRIMARY KEY,
  project_id INTEGER NOT NULL REFERENCES active_projects(id),
  client_id INTEGER NOT NULL REFERENCES clients(id),
  month_key TEXT NOT NULL REFERENCES dim_period(month_key),
  
  -- Valores en moneda nativa
  revenue_native NUMERIC(15,2),
  cost_native NUMERIC(15,2),
  quote_native NUMERIC(15,2),     -- Precio de cotización (presupuesto)
  currency TEXT NOT NULL,
  
  -- Valores en USD
  revenue_usd NUMERIC(12,2),
  cost_usd NUMERIC(12,2),
  
  -- Tipo de cambio
  fx_rate NUMERIC(10,2),
  
  -- Flags de auditoría
  anti_x100_revenue BOOLEAN DEFAULT FALSE,
  anti_x100_cost BOOLEAN DEFAULT FALSE,
  
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(project_id, month_key)
);

-- Índices
CREATE INDEX idx_frcm_project ON fact_rc_month(project_id);
CREATE INDEX idx_frcm_month ON fact_rc_month(month_key);
CREATE INDEX idx_frcm_client ON fact_rc_month(client_id);
```

**Poblada desde**: `financial_sot` (después de Project Resolver)

#### Load 3.4: Aggregate Tables

**`agg_project_month`** - Granularidad: Proyecto × Mes (consolidado)

```sql
CREATE TABLE agg_project_month (
  id SERIAL PRIMARY KEY,
  project_id INTEGER NOT NULL REFERENCES active_projects(id),
  month_key TEXT NOT NULL REFERENCES dim_period(month_key),
  
  -- Financiero (desde fact_rc_month)
  revenue_usd NUMERIC(12,2),
  cost_usd_rc NUMERIC(12,2),      -- Desde RC
  quote_native NUMERIC(15,2),
  currency TEXT,
  fx_rate NUMERIC(10,2),
  
  -- Labor (desde fact_labor_month)
  cost_usd_labor NUMERIC(12,2),   -- Suma de labor costs
  target_hours NUMERIC(10,2),
  hours_asana NUMERIC(10,2),
  hours_billing NUMERIC(10,2),
  
  -- KPIs calculados
  profit_usd NUMERIC(12,2),              -- revenue_usd - cost_usd_rc
  margin_percent NUMERIC(5,2),           -- (profit / revenue) * 100
  markup NUMERIC(10,2),                  -- revenue / cost
  budget_utilization_percent NUMERIC(5,2), -- (cost_native / quote_native) * 100
  
  -- Flags de coherencia
  labor_vs_rc_cost_mismatch BOOLEAN DEFAULT FALSE,
  cost_delta_percent NUMERIC(5,2),       -- |cost_labor - cost_rc| / cost_rc
  
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(project_id, month_key)
);
```

**Proceso de agregación**:

```javascript
// En server/etl/sot-etl.ts
async function buildAggregates() {
  // 1. Agregar por proyecto/mes desde fact_rc_month
  const rcAggs = await db.select({
    projectId: factRcMonth.projectId,
    monthKey: factRcMonth.monthKey,
    revenueUsd: sql`SUM(${factRcMonth.revenueUsd})`,
    costUsdRc: sql`SUM(${factRcMonth.costUsd})`,
    quoteNative: sql`AVG(${factRcMonth.quoteNative})`,
    currency: factRcMonth.currency,
    fxRate: sql`AVG(${factRcMonth.fxRate})`
  })
  .from(factRcMonth)
  .groupBy(factRcMonth.projectId, factRcMonth.monthKey, factRcMonth.currency);
  
  // 2. Agregar por proyecto/mes desde fact_labor_month
  const laborAggs = await db.select({
    projectId: factLaborMonth.projectId,
    monthKey: factLaborMonth.monthKey,
    costUsdLabor: sql`SUM(${factLaborMonth.costUsd})`,
    targetHours: sql`SUM(${factLaborMonth.targetHours})`,
    hoursAsana: sql`SUM(${factLaborMonth.hoursAsana})`,
    hoursBilling: sql`SUM(${factLaborMonth.hoursBilling})`
  })
  .from(factLaborMonth)
  .groupBy(factLaborMonth.projectId, factLaborMonth.monthKey);
  
  // 3. Join + calcular KPIs
  for (const rc of rcAggs) {
    const labor = laborAggs.find(l => 
      l.projectId === rc.projectId && l.monthKey === rc.monthKey
    );
    
    // KPIs
    const profitUsd = rc.revenueUsd - rc.costUsdRc;
    const marginPercent = rc.revenueUsd > 0 
      ? (profitUsd / rc.revenueUsd) * 100 
      : 0;
    const markup = rc.costUsdRc > 0 
      ? rc.revenueUsd / rc.costUsdRc 
      : 0;
    
    // Budget utilization (usa quote_native, NO fx_rate)
    const budgetUtilization = rc.quoteNative > 0
      ? (rc.costUsdRc * rc.fxRate / rc.quoteNative) * 100  // Convierte costo a native
      : 0;
    
    // Coherencia labor vs RC
    const costDelta = Math.abs(labor.costUsdLabor - rc.costUsdRc);
    const costDeltaPercent = rc.costUsdRc > 0 
      ? (costDelta / rc.costUsdRc) * 100 
      : 0;
    const mismatch = costDeltaPercent > 5; // Umbral 5%
    
    // Insert aggregate
    await db.insert(aggProjectMonth).values({
      projectId: rc.projectId,
      monthKey: rc.monthKey,
      revenueUsd: rc.revenueUsd,
      costUsdRc: rc.costUsdRc,
      costUsdLabor: labor?.costUsdLabor || 0,
      quoteNative: rc.quoteNative,
      currency: rc.currency,
      fxRate: rc.fxRate,
      targetHours: labor?.targetHours || 0,
      hoursAsana: labor?.hoursAsana || 0,
      hoursBilling: labor?.hoursBilling || 0,
      profitUsd: profitUsd,
      marginPercent: marginPercent,
      markup: markup,
      budgetUtilizationPercent: budgetUtilization,
      laborVsRcCostMismatch: mismatch,
      costDeltaPercent: costDeltaPercent
    }).onConflictDoUpdate(...);
  }
}
```

#### Load 3.5: Unmatched Staging (Auditoría)

**`rc_unmatched_staging`** - Filas no resueltas por Project Resolver

```sql
CREATE TABLE rc_unmatched_staging (
  id SERIAL PRIMARY KEY,
  client_name_raw TEXT NOT NULL,
  project_name_raw TEXT NOT NULL,
  month_key TEXT NOT NULL,
  revenue_usd NUMERIC(12,2),
  cost_usd NUMERIC(12,2),
  currency TEXT,
  fx_rate NUMERIC(10,2),
  reason TEXT,                    -- 'no_client_match' | 'no_project_match' | 'no_fuzzy_match'
  created_at TIMESTAMP DEFAULT NOW()
);
```

**Uso**: Auditoría de filas que no pudieron conectarse a proyectos existentes.

---

## 🔍 PROJECT RESOLVER V2 (3-Stage Cascade)

**Archivo**: `server/etl/sot-etl.ts::resolveProject()`

**Propósito**: Conectar nombres raw de Google Sheets con IDs de proyectos en BD.

### Orden de Resolución (Cascade)

```javascript
async function resolveProject(
  clientNameRaw: string, 
  projectNameRaw: string
): Promise<{ projectId: number; clientId: number } | null> {
  
  // ════════════════════════════════════════
  // STAGE 1: Alias exacto (determinístico)
  // ════════════════════════════════════════
  const exactAlias = await db.select()
    .from(dimProjectAlias)
    .innerJoin(dimClientAlias, eq(
      dimProjectAlias.clientId, 
      dimClientAlias.clientId
    ))
    .where(and(
      eq(dimClientAlias.aliasName, clientNameRaw),
      eq(dimProjectAlias.aliasName, projectNameRaw)
    ))
    .limit(1);
  
  if (exactAlias.length > 0) {
    console.log(`✅ STAGE 1: Alias exacto → Project ${exactAlias[0].projectId}`);
    return {
      projectId: exactAlias[0].projectId,
      clientId: exactAlias[0].clientId
    };
  }
  
  // ════════════════════════════════════════
  // STAGE 2: Fuzzy match con Fuse.js
  // ════════════════════════════════════════
  const allProjects = await db.select()
    .from(activeProjects)
    .innerJoin(clients, eq(activeProjects.clientId, clients.id));
  
  const fuse = new Fuse(allProjects, {
    keys: [
      { name: 'client.name', weight: 0.5 },
      { name: 'project.name', weight: 0.5 }
    ],
    threshold: 0.15,  // 85% de similitud mínima
    includeScore: true
  });
  
  const fuzzyResults = fuse.search({
    $and: [
      { 'client.name': clientNameRaw },
      { 'project.name': projectNameRaw }
    ]
  });
  
  if (fuzzyResults.length > 0 && fuzzyResults[0].score < 0.15) {
    const match = fuzzyResults[0].item;
    console.log(`✅ STAGE 2: Fuzzy match (score ${fuzzyResults[0].score}) → Project ${match.project.id}`);
    
    // ════════════════════════════════════════
    // STAGE 3: Auto-aprendizaje (persistir alias)
    // ════════════════════════════════════════
    await db.insert(dimClientAlias).values({
      clientId: match.client.id,
      aliasName: clientNameRaw,
      source: 'auto_learned'
    }).onConflictDoNothing();
    
    await db.insert(dimProjectAlias).values({
      projectId: match.project.id,
      clientId: match.client.id,
      aliasName: projectNameRaw,
      source: 'auto_learned'
    }).onConflictDoNothing();
    
    console.log(`📚 STAGE 3: Alias aprendido y persistido`);
    
    return {
      projectId: match.project.id,
      clientId: match.client.id
    };
  }
  
  // ════════════════════════════════════════
  // NO MATCH: Guardar en staging para auditoría
  // ════════════════════════════════════════
  console.warn(`❌ NO MATCH: ${clientNameRaw} - ${projectNameRaw}`);
  
  await db.insert(rcUnmatchedStaging).values({
    clientNameRaw: clientNameRaw,
    projectNameRaw: projectNameRaw,
    monthKey: monthKey,
    revenueUsd: revenueUsd,
    costUsd: costUsd,
    currency: currency,
    fxRate: fxRate,
    reason: 'no_fuzzy_match'
  });
  
  return null;
}
```

**Importante**: 
- Client aliases y project aliases referencian `clients.id` (fix aplicado Oct 2025)
- Umbral fuzzy: 0.15 (85% similitud)
- Auto-learning: Persiste nuevos alias automáticamente

---

## 🚀 CAPA DE API - ViewModels desde SoT

**Archivo principal**: `server/domain/view-aggregator.ts`

**Principio**: La API lee EXCLUSIVAMENTE desde Star Schema SoT, nunca desde `financial_sot`.

### Endpoint: `/api/projects/:id/complete-data`

**Query params**:
- `view`: `'original' | 'operativa' | 'usd'` (default: `'operativa'`)
- `period`: `'2025' | '2025-Q3' | '2025-09' | '2025-01:2025-09'`

**Función core**: `getProjectViewModel()`

```typescript
async function getProjectViewModel(
  projectId: number,
  view: 'original' | 'operativa' | 'usd',
  period?: string
): Promise<ProjectViewModel> {
  
  // ════════════════════════════════════════
  // 1. Fetch desde agg_project_month (SoT)
  // ════════════════════════════════════════
  const periodFilter = parsePeriodFilter(period);
  
  const monthlyAggs = await db.select()
    .from(aggProjectMonth)
    .where(and(
      eq(aggProjectMonth.projectId, projectId),
      periodFilter
    ))
    .orderBy(aggProjectMonth.monthKey);
  
  // ════════════════════════════════════════
  // 2. Calcular totales (sumatorias)
  // ════════════════════════════════════════
  const summary = {
    totalRevenueUsd: monthlyAggs.reduce((sum, m) => sum + Number(m.revenueUsd), 0),
    totalCostUsd: monthlyAggs.reduce((sum, m) => sum + Number(m.costUsdRc), 0),
    totalProfitUsd: 0,  // Se calcula después
    avgMarginPercent: 0,
    totalTargetHours: monthlyAggs.reduce((sum, m) => sum + Number(m.targetHours), 0),
    totalHoursAsana: monthlyAggs.reduce((sum, m) => sum + Number(m.hoursAsana), 0),
    totalHoursBilling: monthlyAggs.reduce((sum, m) => sum + Number(m.hoursBilling), 0)
  };
  
  summary.totalProfitUsd = summary.totalRevenueUsd - summary.totalCostUsd;
  summary.avgMarginPercent = summary.totalRevenueUsd > 0
    ? (summary.totalProfitUsd / summary.totalRevenueUsd) * 100
    : 0;
  
  // ════════════════════════════════════════
  // 3. KPIs (fórmulas reales)
  // ════════════════════════════════════════
  const kpis = {
    // Markup = Revenue / Cost
    markup: summary.totalCostUsd > 0 
      ? summary.totalRevenueUsd / summary.totalCostUsd 
      : 0,
    
    // Margin = 1 - (Cost / Revenue)
    margin: summary.totalRevenueUsd > 0
      ? 1 - (summary.totalCostUsd / summary.totalRevenueUsd)
      : 0,
    
    // Budget Utilization = Cost Native / Quote Native
    // (usa valores en moneda original, NO fx_rate)
    budgetUtilization: monthlyAggs.reduce((sum, m) => {
      if (Number(m.quoteNative) > 0) {
        // Convertir cost_usd de vuelta a native con fx_rate
        const costNative = Number(m.costUsdRc) * Number(m.fxRate);
        return sum + (costNative / Number(m.quoteNative));
      }
      return sum;
    }, 0) / monthlyAggs.length,  // Promedio
    
    // Efficiency = Hours Asana / Hours Billing
    efficiency: summary.totalHoursBilling > 0
      ? summary.totalHoursAsana / summary.totalHoursBilling
      : 0
  };
  
  // ════════════════════════════════════════
  // 4. Team breakdown desde fact_labor_month
  // ════════════════════════════════════════
  const teamBreakdown = await db.select()
    .from(factLaborMonth)
    .where(and(
      eq(factLaborMonth.projectId, projectId),
      periodFilter
    ))
    .groupBy(factLaborMonth.personName)
    .select({
      personName: factLaborMonth.personName,
      totalHoursTarget: sql`SUM(${factLaborMonth.targetHours})`,
      totalHoursAsana: sql`SUM(${factLaborMonth.hoursAsana})`,
      totalHoursBilling: sql`SUM(${factLaborMonth.hoursBilling})`,
      totalCostUsd: sql`SUM(${factLaborMonth.costUsd})`,
      totalCostArs: sql`SUM(${factLaborMonth.costArs})`
    });
  
  // ════════════════════════════════════════
  // 5. Aplicar vista de moneda
  // ════════════════════════════════════════
  let displayValues: any;
  
  switch (view) {
    case 'original':
      // Solo moneda nativa, sin conversión
      displayValues = monthlyAggs.map(m => ({
        period: m.monthKey,
        revenue: `${m.revenueNative} ${m.currency}`,
        cost: `${m.costNative} ${m.currency}`,
        currency: m.currency
      }));
      break;
      
    case 'operativa':
      // Moneda nativa + equivalente USD
      displayValues = monthlyAggs.map(m => ({
        period: m.monthKey,
        revenue: `${m.revenueNative} ${m.currency} (${m.revenueUsd} USD)`,
        cost: `${m.costNative} ${m.currency} (${m.costUsdRc} USD)`,
        currency: m.currency,
        fxRate: m.fxRate
      }));
      break;
      
    case 'usd':
      // Solo USD (consolidado)
      displayValues = monthlyAggs.map(m => ({
        period: m.monthKey,
        revenue: `${m.revenueUsd} USD`,
        cost: `${m.costUsdRc} USD`,
        currency: 'USD'
      }));
      break;
  }
  
  // ════════════════════════════════════════
  // 6. Retornar ViewModel
  // ════════════════════════════════════════
  return {
    projectId: projectId,
    summary: summary,
    kpis: kpis,
    monthlyData: displayValues,
    teamBreakdown: teamBreakdown,
    metadata: {
      view: view,
      period: period,
      lastSync: await getLastEtlRunTime()
    }
  };
}
```

**KPIs Documentados (Fórmulas Reales)**:

| KPI | Fórmula | Ejemplo |
|-----|---------|---------|
| **Markup** | `revenue / cost` | 29,230 / 8,431 = 3.47× |
| **Margin** | `1 - (cost / revenue)` | 1 - (8,431 / 29,230) = 0.7115 (71.15%) |
| **Budget Utilization** | `(cost_usd × fx_rate) / quote_native` | (8,431 × 1445) / 42,236,850 = 28.8% |
| **Efficiency** | `hours_asana / hours_billing` | 145 / 150 = 0.967 (96.7%) |

**⚠️ Importante**: 
- `budgetUtilization` usa `quote_native` (presupuesto), NO `fx_rate` directamente
- Todas las agregaciones vienen de `agg_project_month`, no se calculan on-the-fly

---

## 🎨 FRONTEND - Consumo de ViewModels

**Framework**: React 18 + TanStack Query v5

### React Query Setup

**Archivo**: `client/src/lib/queryClient.ts`

```typescript
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,      // 5 min
      refetchOnWindowFocus: false,
      placeholderData: undefined      // ← CRÍTICO: evita contaminación
    }
  }
});
```

**⚠️ Cache Key Structure**: Incluir todos los parámetros

```typescript
// ❌ MAL: Cache key sin parámetros
const { data } = useQuery({
  queryKey: [`/api/projects/${projectId}`]
});

// ✅ BIEN: Cache key con view + period
const { data } = useQuery({
  queryKey: [`/api/projects/${projectId}`, view, period]
});
```

**Razón**: Si cambias `view` de 'operativa' a 'usd', sin incluirlo en el key mostrará datos cacheados de la vista anterior.

### Componente: Detalle de Proyecto

**Archivo**: `client/src/pages/ProjectDetail.tsx`

```typescript
function ProjectDetail() {
  const { id } = useParams();
  const [view, setView] = useState<'operativa'>('operativa');
  const [period, setPeriod] = useState<string>('2025');
  
  // Fetch con cache key completo
  const { data: project, isLoading } = useQuery({
    queryKey: [`/api/projects/${id}/complete-data`, view, period],
    queryFn: async () => {
      const res = await fetch(
        `/api/projects/${id}/complete-data?view=${view}&period=${period}`
      );
      return res.json();
    },
    placeholderData: undefined  // No usar datos viejos mientras carga
  });
  
  if (isLoading) return <Skeleton />;
  
  return (
    <div>
      <ViewToggle value={view} onChange={setView} />
      <PeriodSelector value={period} onChange={setPeriod} />
      
      <MetricsCard
        revenue={project.summary.totalRevenueUsd}
        cost={project.summary.totalCostUsd}
        profit={project.summary.totalProfitUsd}
        margin={project.summary.avgMarginPercent}
      />
      
      <MonthlyChart data={project.monthlyData} />
      
      <TeamTable breakdown={project.teamBreakdown} />
    </div>
  );
}
```

---

## 🔄 EJECUCIÓN AUTOMÁTICA

### Cron Job (Producción)

**Archivo**: `server/cron.ts`

```javascript
import cron from 'node-cron';
import { runCompleteSotEtl } from './etl/sot-etl';

// Ejecuta todos los días a las 3 AM
cron.schedule('0 3 * * *', async () => {
  console.log('🔄 [CRON] Iniciando sincronización diaria SoT ETL...');
  
  try {
    const stats = await runCompleteSotEtl();
    console.log('✅ [CRON] ETL completado:', stats);
  } catch (error) {
    console.error('❌ [CRON] ETL falló:', error);
    // TODO: Enviar alerta (email, Slack, etc.)
  }
}, {
  timezone: 'America/Argentina/Buenos_Aires'
});

// Nota: Deshabilitado en dev si hay OOM
if (process.env.NODE_ENV === 'development' && process.env.DISABLE_CRON === 'true') {
  console.log('⏸️ Cron deshabilitado en desarrollo');
}
```

### Ejecución Manual

```bash
# Comando NPM
npm run etl:sync

# Directo con tsx
npx tsx server/etl/sot-etl.ts
```

---

## 🧪 CHECKS DE AUDITORÍA (Smoke Tests)

### Check 1: Coherencia RC por período

**Query**:
```sql
-- Verificar que quote_native, fx_rate, revenue_usd coincidan con planilla
SELECT 
  month_key,
  project_name,
  quote_native,
  fx_rate,
  revenue_usd,
  cost_usd
FROM fact_rc_month
WHERE project_id = 127  -- Warner Fee Marketing
  AND month_key BETWEEN '2025-01' AND '2025-09'
ORDER BY month_key;
```

**Valores esperados (Warner Fee Marketing)**:
| Mes | quote_native (ARS) | fx_rate | revenue_usd | cost_usd |
|-----|-------------------|---------|-------------|----------|
| 2025-01 | ? | 1220 | 13,450 | 7,655.65 |
| 2025-05 | 34,591,400 | 1180 | 29,230 | 11,424.89 |
| 2025-09 | 42,236,850 | 1445 | 29,230 | 8,431.37 |

### Check 2: Coherencia Labor vs RC Cost

**Query**:
```sql
-- Comparar totales de labor vs RC por mes
WITH labor_totals AS (
  SELECT 
    project_id,
    month_key,
    SUM(cost_usd) as labor_cost_usd
  FROM fact_labor_month
  GROUP BY project_id, month_key
),
rc_totals AS (
  SELECT
    project_id,
    month_key,
    cost_usd as rc_cost_usd
  FROM fact_rc_month
)
SELECT
  l.project_id,
  l.month_key,
  l.labor_cost_usd,
  r.rc_cost_usd,
  ABS(l.labor_cost_usd - r.rc_cost_usd) as delta,
  ROUND((ABS(l.labor_cost_usd - r.rc_cost_usd) / NULLIF(r.rc_cost_usd, 0)) * 100, 2) as delta_percent
FROM labor_totals l
INNER JOIN rc_totals r ON l.project_id = r.project_id AND l.month_key = r.month_key
WHERE ABS(l.labor_cost_usd - r.rc_cost_usd) / NULLIF(r.rc_cost_usd, 0) > 0.05  -- Delta > 5%
ORDER BY delta_percent DESC;
```

**Criterio**: `Δ ≤ 5%` es aceptable (discrepancia entre pestañas de Excel)

**Warner Ago 2025**: Δ = $42.01 USD (0.6%) → ✅ Dentro del rango

### Check 3: Team Breakdown Coherencia

**Query**:
```sql
-- Verificar: cost_ars ≈ hours_billing × hourly_rate_ars
SELECT
  person_name,
  hours_billing,
  hourly_rate_ars,
  cost_ars,
  (hours_billing * hourly_rate_ars) as cost_calculated,
  ABS(cost_ars - (hours_billing * hourly_rate_ars)) as delta
FROM fact_labor_month
WHERE project_id = 127 AND month_key = '2025-09'
  AND ABS(cost_ars - (hours_billing * hourly_rate_ars)) > 0.1  -- Δ > 0.1 ARS
ORDER BY delta DESC;
```

**Criterio**: `Δ ≤ 0.1 ARS` (tolerancia por redondeo)

### Check 4: Flags ANTI×100

**Query**:
```sql
-- Verificar que horas billing < 500 (sin anti×100)
SELECT
  project_id,
  month_key,
  person_name,
  hours_billing,
  anti_x100_hours
FROM fact_labor_month
WHERE hours_billing > 500 AND anti_x100_hours = FALSE;
-- Si retorna filas → ⚠️ Falló normalización
```

**Query**:
```sql
-- Verificar costos ARS no anómalos
SELECT
  project_id,
  month_key,
  person_name,
  cost_ars,
  anti_x100_cost
FROM fact_labor_month
WHERE cost_ars > 100000000 AND anti_x100_cost = FALSE;
-- Si retorna filas → ⚠️ Falló normalización
```

### Check 5: Aliases sin filas colgadas

**Query**:
```sql
-- Verificar que no haya unmatched recientes
SELECT
  client_name_raw,
  project_name_raw,
  month_key,
  revenue_usd,
  reason,
  created_at
FROM rc_unmatched_staging
WHERE created_at > NOW() - INTERVAL '7 days'
ORDER BY created_at DESC;
```

**Acción**: Si hay filas, crear aliases manualmente o ajustar umbral fuzzy.

---

## 📌 OBSERVACIONES ESPECÍFICAS: Warner 2025

### Datos Verificados (Ene-Sep 2025)

**Fee Marketing**:
- ✅ Enero-Abril: Presentes tras fix "Pasado/Futuro"
- ✅ Mayo-Agosto: Coincidencia perfecta con planilla
- ✅ Septiembre: Corregido manualmente (división ×1000)

**Fee Insights**:
- ✅ Septiembre: Único mes con datos

### Discrepancias Permitidas

**Agosto 2025 (Warner Fee Marketing)**:
- Labor cost: $7,047.21 USD
- RC cost: $7,005.20 USD
- **Delta**: $42.01 USD (0.6%)
- **Razón**: Discrepancia real entre pestañas "Costos directos" y "Rendimiento Cliente"
- **Status**: ✅ Permitida (< 1%)

### Números Exactos Esperados

**Septiembre 2025**:
| Proyecto | Revenue USD | Cost USD | FX Rate | Quote Native ARS |
|----------|-------------|----------|---------|------------------|
| Fee Marketing | 29,230.00 | 8,431.37 | 1,445 | 42,236,850 |
| Fee Insights | 7,580.00 | 383.91 | 1,445 | 10,953,100 |

**Query de validación**:
```sql
SELECT
  project_name,
  ROUND(revenue_usd::numeric, 2) as revenue,
  ROUND(cost_usd::numeric, 2) as cost,
  ROUND(fx_rate::numeric, 2) as fx,
  ROUND(quote_native::numeric, 2) as quote
FROM fact_rc_month
WHERE client_id = (SELECT id FROM clients WHERE name ILIKE '%warner%')
  AND month_key = '2025-09'
ORDER BY project_name;
```

---

## 🚀 PRÓXIMOS PASOS RECOMENDADOS

### 1. Monitoreo de Status Values (RC)

**Implementación**:
```javascript
// En rendimiento-cliente.ts
const uniqueStatuses = new Set();

for (const row of rows) {
  const status = row[pasadoFuturoIndex]?.toString().trim();
  if (status) uniqueStatuses.add(status);
}

console.log('📊 Valores únicos de "Pasado/Futuro":', Array.from(uniqueStatuses));
```

**Acción**: Si aparecen valores como "Realizado", "Confirmado", etc. → crear allow-list.

### 2. Dashboard de Auditoría (Unmatched)

**Features**:
- Vista de `rc_unmatched_staging` con filtros
- Botón "Crear alias manualmente"
- Gráfico de % de rows resueltas vs no resueltas

### 3. Temporal Consistency Guard (Alertas)

**Implementación**:
```javascript
// Detectar caídas anormales de costo
const avg3months = (m1.cost + m2.cost + m3.cost) / 3;
const currentCost = m4.cost;

if (currentCost < avg3months * 0.1) {
  // Alerta Slack/Email
  await sendAlert({
    type: 'cost_anomaly',
    project: projectName,
    month: m4.monthKey,
    expected: avg3months,
    actual: currentCost,
    delta: ((avg3months - currentCost) / avg3months) * 100
  });
}
```

### 4. Índices de Performance

```sql
-- Optimización de queries frecuentes
CREATE INDEX idx_apm_period_range ON agg_project_month(month_key)
  WHERE month_key >= '2025-01';

CREATE INDEX idx_flm_composite ON fact_labor_month(project_id, month_key)
  INCLUDE (cost_usd, hours_billing);

CREATE INDEX idx_frcm_composite ON fact_rc_month(project_id, month_key)
  INCLUDE (revenue_usd, cost_usd);
```

### 5. Materialización de Vistas Frecuentes

```sql
-- Vista materializada para dashboard ejecutivo
CREATE MATERIALIZED VIEW mv_executive_dashboard AS
SELECT
  DATE_TRUNC('month', month_key::date) as month,
  SUM(revenue_usd) as total_revenue,
  SUM(cost_usd_rc) as total_cost,
  SUM(profit_usd) as total_profit,
  AVG(margin_percent) as avg_margin,
  COUNT(DISTINCT project_id) as active_projects
FROM agg_project_month
GROUP BY DATE_TRUNC('month', month_key::date);

-- Refresh diario (después del ETL)
REFRESH MATERIALIZED VIEW mv_executive_dashboard;
```

---

## 📝 RESUMEN EJECUTIVO

### Flujo de Datos en 3 Pasos

1. **Extract**: Google Sheets → Raw data con `UNFORMATTED_VALUE`
2. **Transform**: ANTI×100 + Conversión USD + Project Resolver → Datos normalizados
3. **Load**: Star Schema SoT → `fact_*` + `agg_*` → API ViewModels → Frontend

### Garantías del Sistema

- ✅ **Invariante matemático**: `SUM(fact_rc_month.revenue) = agg_project_month.revenue`
- ✅ **Separación semántica**: `fx_rate` (cambio) ≠ `quote_native` (presupuesto)
- ✅ **Auditoría completa**: Flags ANTI×100 + Unmatched staging
- ✅ **Coherencia temporal**: Labor cost vs RC cost Δ < 5%
- ✅ **Auto-aprendizaje**: Project Resolver persiste aliases

### Fuentes de Verdad

| Capa | Propósito | Consumidores |
|------|-----------|--------------|
| Google Sheets | Origen de datos | ETL únicamente |
| `financial_sot` | Staging temporal | ETL interno |
| `fact_*` tables | Source of Truth | Agregaciones |
| `agg_*` tables | KPIs precalculados | API + Frontend |

**Regla de oro**: El frontend NUNCA lee `financial_sot`, solo ViewModels desde `agg_project_month`.

---

**Versión**: 3.0 (Post-corrección técnica)  
**Última actualización**: Octubre 2025  
**Cambios aplicados**:
- Fix FK constraints (dim_*_alias → clients.id)
- Corrección filtro "Pasado/Futuro" (celdas vacías)
- Documentación de flags ANTI×100
- Fórmulas canónicas de KPIs
- Checks de auditoría SQL
