# 📊 Documentación Completa del Flujo de Datos - Epical Digital Platform

## 🎯 Visión General

El sistema obtiene datos de **Excel MAESTRO (Google Sheets)** y los procesa a través de un pipeline ETL para poblar una arquitectura **Star Schema** en PostgreSQL. Los datos fluyen desde Google Sheets → ETL → Base de Datos → API → Frontend.

---

## 📍 ORIGEN DE DATOS: Google Sheets "Excel MAESTRO"

### Ubicación
- **Archivo**: Excel MAESTRO (Google Sheets)
- **Conexión**: API de Google Sheets v4
- **Credenciales**: OAuth2 con refresh token
- **Archivo de servicio**: `server/services/googleSheetsWorking.ts`

### Hojas Principales

#### 1️⃣ **Hoja "Rendimiento Cliente"** 
**Propósito**: Datos financieros mensuales por cliente y proyecto

**Columnas clave**:
- `Cliente` (columna A): Nombre del cliente
- `Proyecto` (columna B): Nombre del proyecto
- `Mes` (columna C): Mes en formato texto (ej: "Enero")
- `Año` (columna D): Año (ej: 2025)
- `Facturación` (columna E): Ingresos en moneda original
- `Moneda` (columna F): ARS o USD
- `Tipo de cambio` (columna G): Cotización USD
- `Costos` (columna H): Costos directos
- `Pasado/Futuro` (columna I): Estado del proyecto ("Real", vacío, etc.)

**Ubicación en código**: `server/etl/rendimiento-cliente.ts`

#### 2️⃣ **Hoja "Ventas Tomi"**
**Propósito**: Datos de ventas y proyectos activos

**Ubicación en código**: `server/etl/ventas-tomi.ts`

#### 3️⃣ **Hoja "Costos directos e indirectos"**
**Propósito**: Desglose de horas por persona y proyecto

**Columnas clave**:
- Horas objetivo (target)
- Horas Asana (tracked)
- Horas facturables (billing)

**Ubicación en código**: Procesado en `server/etl/sot-etl.ts` (Team Breakdown)

---

## 🔄 PROCESO ETL COMPLETO

### Fase 1: Extracción desde Google Sheets

**Archivo**: `server/services/googleSheetsWorking.ts`

```javascript
// Función principal de conexión
async function getGoogleSheetsClient()

// Obtiene datos de una hoja específica
async function getSpreadsheetData(spreadsheetId, range)
```

**Configuración**:
- Spreadsheet ID: Almacenado en variable de entorno
- Autenticación: OAuth2 con tokens de acceso/refresco
- Rate limiting: Respeta límites de API de Google

### Fase 2: Transformación - Rendimiento Cliente ETL

**Archivo**: `server/etl/rendimiento-cliente.ts`

**Función principal**: `importRendimientoClienteData()`

#### Paso 2.1: Lectura de datos raw
```javascript
const data = await getSpreadsheetData(spreadsheetId, 'Rendimiento Cliente!A2:Z')
```

#### Paso 2.2: Filtrado de filas válidas

**IMPORTANTE - FIX APLICADO**:
```javascript
// Detecta si hay columna "Pasado/Futuro"
const pasadoFuturoIndex = headers.findIndex(h => 
  h?.toString().toLowerCase().includes('pasado')
);

// Si la columna existe, evalúa su valor
if (pasadoFuturoIndex !== -1) {
  const statusFlag = row[pasadoFuturoIndex]?.toString().trim();
  const hasPasadoFuturo = statusFlag && statusFlag !== '';
  
  // LÓGICA CLAVE:
  // - Si está vacía o whitespace → acepta (proyecto confirmado)
  // - Si tiene valor pero NO es "real" → rechaza
  if (hasPasadoFuturo && statusFlag.toLowerCase() !== 'real') {
    continue; // Salta esta fila
  }
}
```

**Razón del fix**: Las filas con "Pasado/Futuro" vacío son proyectos confirmados, no estimaciones.

#### Paso 2.3: Normalización de moneda

```javascript
// Determina la moneda del proyecto
const currencyStr = row[headers.indexOf('Moneda')]?.toString().toUpperCase();
const isUSD = currencyStr?.includes('USD');
const currency = isUSD ? 'USD' : 'ARS';

// Extrae el tipo de cambio
const fxRateRaw = row[headers.indexOf('Tipo de cambio')];
const fxRate = parseFloat(fxRateRaw?.toString() || '1');
```

#### Paso 2.4: Cálculo de valores USD

**ANTI×100 NORMALIZATION** aplicada aquí:

```javascript
import { normalizeIfOver100 } from '../utils/number';

// Normaliza facturación
const rawRevenue = parseFloat(row[revenueIndex]?.toString() || '0');
const revenueNormalized = normalizeIfOver100(rawRevenue, 'revenue');

// Convierte a USD
const revenueUSD = currency === 'USD' 
  ? revenueNormalized 
  : revenueNormalized / fxRate;

// Lo mismo para costos
const rawCost = parseFloat(row[costIndex]?.toString() || '0');
const costNormalized = normalizeIfOver100(rawCost, 'cost');
const costUSD = currency === 'USD'
  ? costNormalized
  : costNormalized / fxRate;
```

**Función ANTI×100**: `server/utils/number.ts`
```javascript
export function normalizeIfOver100(value: number, context: string): number {
  // Si el valor es > 100,000 → probablemente está ×100
  if (value > 100_000) {
    console.warn(`🔧 ANTI×100: ${context} ${value} → ${value/100}`);
    return value / 100;
  }
  return value;
}
```

#### Paso 2.5: Inserción en tabla `financial_sot`

```javascript
await db.insert(financialSot).values({
  clientName: clientName,
  projectName: projectName,
  monthKey: `${year}-${monthNum}`, // ej: "2025-09"
  year: year,
  month: monthNum,
  revenueUsd: revenueUSD.toString(),
  costUsd: costUSD.toString(),
  currency: currency,
  quotation: fxRate.toString(), // TIPO DE CAMBIO
  // NO confundir con quote_native (precio de cotización)
}).onConflictDoUpdate(...);
```

**⚠️ SEPARACIÓN SEMÁNTICA CRÍTICA**:
- `quotation` → Tipo de cambio ARS/USD (FX rate)
- `quote_native` → Precio de cotización del proyecto (en su moneda)

### Fase 3: Construcción del Star Schema

**Archivo**: `server/etl/sot-etl.ts`

**Función principal**: `runCompleteSotEtl()`

#### Dimensión: Períodos (`dim_period`)

```sql
INSERT INTO dim_period (month_key, year, month, quarter, semester)
SELECT DISTINCT
  month_key,
  year,
  month,
  CEIL(month::numeric / 3) as quarter,
  CEIL(month::numeric / 6) as semester
FROM financial_sot
```

#### Dimensión: Tasas de Personas (`dim_person_rate`)

```javascript
// Calcula costos horarios por persona desde activeProjects
const personRates = await db.select({
  personName: sql`unnest(${activeProjects.team})`,
  personCost: sql`unnest(${activeProjects.teamCosts})`
}).from(activeProjects);

// Inserta en dim_person_rate
await db.insert(dimPersonRate).values({
  personName: name,
  hourlyCost: avgCost
});
```

#### Hecho: Labor Mensual (`fact_labor_month`)

**Fuente**: Hoja "Costos directos e indirectos"

```javascript
// ANTI×100 aplicado a horas Asana
const hoursAsanaNormalized = normalizeIfOver100(rawHoursAsana, 'hoursAsana');

await db.insert(factLaborMonth).values({
  projectId: project.id,
  monthKey: monthKey,
  personName: personName,
  targetHours: targetHours,
  hoursAsana: hoursAsanaNormalized, // Horas reales trackeadas
  hoursBilling: hoursBilling,       // Horas para facturar
  costUsd: costForPerson
});
```

#### Hecho: RC Mensual (`fact_rc_month`)

**Fuente**: Tabla `financial_sot`

```javascript
await db.insert(factRcMonth).values({
  projectId: resolvedProjectId, // ← Resuelto por Project Resolver
  clientId: clientId,
  monthKey: row.monthKey,
  revenueNative: revenueNative,
  revenueUsd: row.revenueUsd,
  costUsd: row.costUsd,
  currency: row.currency,
  fxRate: row.quotation, // Tipo de cambio
  quoteNative: quoteNative // Precio de cotización
});
```

**🔍 Project Resolver V2**: Sistema de 3 etapas

**Etapa 1: Match determinístico**
```sql
SELECT project_id FROM dim_project_alias 
WHERE alias_name = 'Fee Marketing' AND client_id = 34
```

**Etapa 2: Match fuzzy con Fuse.js**
```javascript
const fuse = new Fuse(projectList, {
  keys: ['name'],
  threshold: 0.3
});
const matches = fuse.search('Marketing Fee');
```

**Etapa 3: Aprendizaje automático**
```javascript
// Si hay match, crea alias automático
await db.insert(dimProjectAlias).values({
  projectId: foundProject.id,
  aliasName: 'Marketing Fee',
  source: 'auto_learned'
});
```

**Filas no resueltas** → `rc_unmatched_staging` para auditoría

#### Agregación: Proyecto Mensual (`agg_project_month`)

```javascript
await db.insert(aggProjectMonth).values({
  projectId: project.id,
  monthKey: monthKey,
  revenueUsd: totalRevenue,
  costUsd: totalCost,
  targetHours: sumTargetHours,
  hoursAsana: sumHoursAsana,
  hoursBilling: sumHoursBilling,
  profitUsd: totalRevenue - totalCost,
  marginPercent: ((totalRevenue - totalCost) / totalRevenue) * 100
});
```

### Fase 4: Ejecución Automática

**Archivo**: `server/cron.ts`

```javascript
import cron from 'node-cron';

// Ejecuta ETL todos los días a las 3 AM
cron.schedule('0 3 * * *', async () => {
  console.log('🔄 Iniciando sincronización automática ETL...');
  await runCompleteSotEtl();
});
```

**También se puede ejecutar manualmente**:
```bash
npm run etl:sync
```

---

## 🗄️ ARQUITECTURA DE BASE DE DATOS

### Tablas Dimensionales (Dimension Tables)

#### `dim_period`
```sql
- month_key (PK): '2025-09'
- year: 2025
- month: 9
- quarter: 3
- semester: 2
```

#### `dim_person_rate`
```sql
- person_name (PK): 'Juan Pérez'
- hourly_cost: 25.50
- last_updated: timestamp
```

#### `dim_client_alias`
```sql
- id (PK)
- client_id (FK → clients.id)
- alias_name: 'Warner Bros'
- source: 'auto_learned' | 'manual'
```

#### `dim_project_alias`
```sql
- id (PK)
- project_id (FK → activeProjects.id)
- client_id (FK → clients.id)
- alias_name: 'Fee Marketing'
- source: 'auto_learned' | 'manual'
```

### Tablas de Hechos (Fact Tables)

#### `fact_labor_month`
**Granularidad**: Proyecto × Mes × Persona

```sql
- id (PK)
- project_id (FK)
- month_key (FK → dim_period)
- person_name (FK → dim_person_rate)
- target_hours: 160.0
- hours_asana: 145.5    ← Con ANTI×100
- hours_billing: 150.0
- cost_usd: 3637.50
```

#### `fact_rc_month`
**Granularidad**: Proyecto × Mes

```sql
- id (PK)
- project_id (FK)
- client_id (FK)
- month_key (FK → dim_period)
- revenue_native: 42,236,850.00  ← En moneda original
- revenue_usd: 29,230.00         ← Convertido
- cost_usd: 8,431.37
- currency: 'ARS'
- fx_rate: 1445.00               ← Tipo de cambio
- quote_native: 42,236,850.00    ← Cotización del proyecto
```

#### `agg_project_month`
**Granularidad**: Proyecto × Mes (agregado)

```sql
- id (PK)
- project_id (FK)
- month_key (FK)
- revenue_usd: 29,230.00
- cost_usd: 8,431.37
- target_hours: 320.0
- hours_asana: 291.0
- hours_billing: 300.0
- profit_usd: 20,798.63
- margin_percent: 71.15
```

### Tabla Fuente (Source of Truth)

#### `financial_sot`
**La tabla raw de importación desde Google Sheets**

```sql
- id (PK)
- client_name: 'Warner'
- project_name: 'Fee Marketing'
- month_key: '2025-09'
- year: 2025
- month: 9
- revenue_usd: '29230.00'
- cost_usd: '8431.37'
- currency: 'ARS'
- quotation: '1445.00'  ← FX Rate
```

### Tabla de Auditoría

#### `rc_unmatched_staging`
**Filas que no pudieron resolverse a proyectos**

```sql
- id (PK)
- client_name_raw: 'Warner Bros.'
- project_name_raw: 'Marketing Digital'
- month_key: '2025-09'
- revenue_usd: 5000.00
- reason: 'no_fuzzy_match'
- created_at: timestamp
```

---

## 🚀 CAPA DE API - Backend Routes

### Endpoint Principal: Proyectos

**Archivo**: `server/routes.ts`

#### GET `/api/projects/:id`

**Archivo de lógica**: `server/domain/view-aggregator.ts`

```javascript
async function getProjectViewModel(projectId: number) {
  // 1. Obtiene datos base del proyecto
  const project = await db.select()
    .from(activeProjects)
    .where(eq(activeProjects.id, projectId));
  
  // 2. Obtiene agregados mensuales desde Star Schema
  const monthlyData = await db.select()
    .from(aggProjectMonth)
    .where(eq(aggProjectMonth.projectId, projectId))
    .orderBy(aggProjectMonth.monthKey);
  
  // 3. Obtiene desglose de equipo
  const teamBreakdown = await db.select()
    .from(factLaborMonth)
    .where(eq(factLaborMonth.projectId, projectId));
  
  // 4. Calcula KPIs
  const totalRevenue = monthlyData.reduce((sum, m) => sum + m.revenueUsd, 0);
  const totalCost = monthlyData.reduce((sum, m) => sum + m.costUsd, 0);
  const profitMargin = ((totalRevenue - totalCost) / totalRevenue) * 100;
  
  // 5. Ensambla ViewModel
  return {
    id: project.id,
    name: project.name,
    client: project.clientName,
    totalRevenue,
    totalCost,
    profitMargin,
    monthlyData: monthlyData.map(m => ({
      period: m.monthKey,
      revenue: m.revenueUsd,
      cost: m.costUsd,
      profit: m.profitUsd,
      margin: m.marginPercent,
      hoursTracked: m.hoursAsana,
      hoursBudget: m.targetHours
    })),
    teamBreakdown: teamBreakdown.map(t => ({
      person: t.personName,
      hoursTarget: t.targetHours,
      hoursActual: t.hoursAsana,
      hoursBilling: t.hoursBilling,
      cost: t.costUsd
    }))
  };
}
```

### Endpoint: Dashboard Ejecutivo

#### GET `/api/dashboard/executive`

```javascript
async function getExecutiveDashboard(period: string) {
  // 1. Filtra por período
  const periodFilter = parsePeriod(period); // '2025' | '2025-Q3' | '2025-09'
  
  // 2. Query Star Schema
  const kpis = await db.select({
    totalRevenue: sql`SUM(revenue_usd)`,
    totalCost: sql`SUM(cost_usd)`,
    totalProfit: sql`SUM(profit_usd)`,
    avgMargin: sql`AVG(margin_percent)`
  })
  .from(aggProjectMonth)
  .where(periodFilter);
  
  // 3. Top proyectos por rentabilidad
  const topProjects = await db.select()
    .from(aggProjectMonth)
    .orderBy(desc(aggProjectMonth.marginPercent))
    .limit(10);
  
  return { kpis, topProjects };
}
```

---

## 🎨 FRONTEND - Consumo de Datos

### React Query Setup

**Archivo**: `client/src/lib/queryClient.ts`

```javascript
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutos
      refetchOnWindowFocus: false
    }
  }
});

// Fetcher global
queryClient.setDefaultOptions({
  queries: {
    queryFn: async ({ queryKey }) => {
      const res = await fetch(queryKey[0]);
      return res.json();
    }
  }
});
```

### Componente: Proyecto Detalle

**Archivo**: `client/src/pages/ProjectDetail.tsx`

```typescript
function ProjectDetail() {
  const { id } = useParams();
  
  // 1. Fetch datos del proyecto
  const { data: project, isLoading } = useQuery({
    queryKey: [`/api/projects/${id}`],
    // queryFn se usa del default ↑
  });
  
  if (isLoading) return <Skeleton />;
  
  // 2. Renderiza con datos del ViewModel
  return (
    <div>
      <h1>{project.name}</h1>
      <MetricsCard 
        revenue={project.totalRevenue}
        cost={project.totalCost}
        margin={project.profitMargin}
      />
      
      <MonthlyChart data={project.monthlyData} />
      
      <TeamTable breakdown={project.teamBreakdown} />
    </div>
  );
}
```

### Sistema de Multi-Moneda (3 Vistas)

**Archivo**: `client/src/components/CurrencyToggle.tsx`

```typescript
const [view, setView] = useState<'original' | 'operative' | 'usd'>('operative');

// Vista Original: Muestra moneda native
const displayValue = view === 'original' 
  ? project.revenueNative + ' ' + project.currency
  
// Vista Operativa: Moneda native + equivalente USD
  : view === 'operative'
  ? `${project.revenueNative} ${project.currency} (${project.revenueUsd} USD)`
  
// Vista Consolidada: Solo USD
  : `${project.revenueUsd} USD`;
```

---

## 🔄 FLUJO COMPLETO: Ejemplo Concreto

### Caso: Warner - Fee Marketing - Septiembre 2025

#### 1. **Datos en Google Sheets** (Hoja "Rendimiento Cliente")
```
Cliente  | Proyecto      | Mes        | Año  | Facturación    | Moneda | TC    | Costos
Warner   | Fee Marketing | Septiembre | 2025 | 42,236,850.00  | ARS    | 1445  | 12,183,422.55
```

#### 2. **ETL Extracción** (`rendimiento-cliente.ts`)
```javascript
const row = [
  'Warner',           // Cliente
  'Fee Marketing',    // Proyecto
  'Septiembre',       // Mes
  '2025',            // Año
  '42236850',        // Facturación
  'ARS',             // Moneda
  '1445',            // TC
  '12183422.55',     // Costos
  ''                 // Pasado/Futuro (VACÍO → aceptar)
];
```

#### 3. **ETL Transformación**
```javascript
// Paso A: Normalización ANTI×100
const rawRevenue = 42236850;
const normalized = normalizeIfOver100(rawRevenue, 'revenue');
// → 42236850 (no aplica, < 100,000)

// Paso B: Conversión a USD
const currency = 'ARS';
const fxRate = 1445;
const revenueUSD = normalized / fxRate;
// → 29,230.00 USD

// Paso C: Lo mismo para costos
const rawCost = 12183422.55;
const costUSD = rawCost / fxRate;
// → 8,431.37 USD
```

#### 4. **ETL Carga** → Tabla `financial_sot`
```sql
INSERT INTO financial_sot VALUES (
  client_name: 'Warner',
  project_name: 'Fee Marketing',
  month_key: '2025-09',
  year: 2025,
  month: 9,
  revenue_usd: '29230.00',
  cost_usd: '8431.37',
  currency: 'ARS',
  quotation: '1445.00'
);
```

#### 5. **Star Schema ETL** → Tabla `fact_rc_month`

**Paso A: Project Resolver**
```javascript
// Match determinístico en dim_project_alias
const alias = await db.select()
  .from(dimProjectAlias)
  .where(and(
    eq(dimProjectAlias.aliasName, 'Fee Marketing'),
    eq(dimProjectAlias.clientId, 34) // Warner
  ));
// → Encuentra project_id = 127
```

**Paso B: Inserción en fact_rc_month**
```sql
INSERT INTO fact_rc_month VALUES (
  project_id: 127,
  client_id: 34,
  month_key: '2025-09',
  revenue_native: '42236850.00',
  revenue_usd: '29230.00',
  cost_usd: '8431.37',
  currency: 'ARS',
  fx_rate: '1445.00',
  quote_native: '42236850.00'
);
```

#### 6. **Agregación** → Tabla `agg_project_month`
```sql
INSERT INTO agg_project_month VALUES (
  project_id: 127,
  month_key: '2025-09',
  revenue_usd: 29230.00,
  cost_usd: 8431.37,
  profit_usd: 20798.63,  -- 29230 - 8431.37
  margin_percent: 71.15   -- (20798.63 / 29230) * 100
);
```

#### 7. **API Response** → GET `/api/projects/127`
```json
{
  "id": 127,
  "name": "Fee Marketing",
  "client": "Warner",
  "totalRevenue": 233480.00,
  "totalCost": 78824.71,
  "profitMargin": 66.25,
  "monthlyData": [
    {
      "period": "2025-01",
      "revenue": 13450.00,
      "cost": 7655.65,
      "profit": 5794.35,
      "margin": 43.08
    },
    // ... ene-ago ...
    {
      "period": "2025-09",
      "revenue": 29230.00,
      "cost": 8431.37,
      "profit": 20798.63,
      "margin": 71.15
    }
  ]
}
```

#### 8. **Frontend Render**
```typescript
<MetricsCard
  revenue={29230}
  cost={8431.37}
  profit={20798.63}
  margin={71.15}
/>

<MonthlyChart
  data={[
    { month: 'Ene', revenue: 13450, cost: 7656 },
    // ...
    { month: 'Sep', revenue: 29230, cost: 8431 }
  ]}
/>
```

---

## 🛡️ SISTEMAS DE PROTECCIÓN

### 1. ANTI×100 Normalization
**Ubicación**: `server/utils/number.ts`

**Problema**: Google Sheets a veces envía `4223685000` en lugar de `42236850`

**Solución**:
```javascript
if (value > 100_000) {
  return value / 100; // Autocorrección
}
```

**Aplicado en**:
- Revenue (facturación)
- Costs (costos)
- Hours Asana (horas trackeadas)

### 2. Temporal Consistency Guard (TCG)
**Ubicación**: `server/etl/sot-etl.ts`

**Problema**: Detectar anomalías temporales (ej: costos que caen 90%)

**Solución**:
```javascript
const avgLast3Months = (m1.cost + m2.cost + m3.cost) / 3;
const currentCost = m4.cost;

if (currentCost < avgLast3Months * 0.1) {
  console.error('⚠️ TCG: Anomalía detectada');
  // Autocorrección o alerta
}
```

### 3. Filtro Pasado/Futuro (FIX APLICADO)
**Ubicación**: `server/etl/rendimiento-cliente.ts`

**Problema**: Celdas vacías en "Pasado/Futuro" se descartaban erróneamente

**Solución**:
```javascript
const statusFlag = row[pasadoFuturoIndex]?.toString().trim();
const hasPasadoFuturo = statusFlag && statusFlag !== '';

if (hasPasadoFuturo && statusFlag.toLowerCase() !== 'real') {
  continue; // Solo rechaza si tiene valor Y no es "real"
}
// Celdas vacías → se aceptan
```

---

## 📊 INVARIANTES MATEMÁTICOS

El sistema garantiza estas ecuaciones en todo momento:

### 1. Conservación de Valor
```
SUM(fact_rc_month.revenue_usd WHERE project_id = X) 
= 
agg_project_month.revenue_usd WHERE project_id = X
```

### 2. Profit Coherence
```
profit_usd = revenue_usd - cost_usd
margin_percent = (profit_usd / revenue_usd) * 100
```

### 3. Currency Conversion
```
revenue_usd = revenue_native / fx_rate  (si currency = ARS)
revenue_usd = revenue_native            (si currency = USD)
```

---

## 🔍 DEBUGGING Y AUDITORÍA

### Verificar datos de un proyecto

```sql
-- 1. Ver datos raw en financial_sot
SELECT * FROM financial_sot 
WHERE project_name = 'Fee Marketing' AND year = 2025
ORDER BY month_key;

-- 2. Ver datos en fact_rc_month (post-resolver)
SELECT * FROM fact_rc_month
WHERE project_id = 127
ORDER BY month_key;

-- 3. Ver agregados finales
SELECT * FROM agg_project_month
WHERE project_id = 127
ORDER BY month_key;

-- 4. Ver filas no resueltas
SELECT * FROM rc_unmatched_staging
WHERE created_at > NOW() - INTERVAL '7 days';
```

### Logs de ETL

```bash
# Ver logs del último sync
tail -f logs/etl-sync.log

# Buscar errores
grep "ERROR" logs/etl-sync.log

# Ver estadísticas
grep "📊 Stats" logs/etl-sync.log
```

---

## 🎯 RESUMEN DEL FLUJO

```
┌─────────────────────────────────────────────────────┐
│ GOOGLE SHEETS (Excel MAESTRO)                      │
│ ┌─────────────────┐  ┌──────────────────┐          │
│ │ Rendimiento     │  │ Costos directos  │          │
│ │ Cliente         │  │ e indirectos     │          │
│ └─────────────────┘  └──────────────────┘          │
└──────────────┬──────────────────┬───────────────────┘
               │                  │
               ▼                  ▼
┌─────────────────────────────────────────────────────┐
│ ETL PIPELINE                                        │
│ ┌──────────────────────┐  ┌──────────────────────┐ │
│ │ rendimiento-cliente  │  │ sot-etl (Star       │ │
│ │ - Extrae            │  │  Schema Builder)     │ │
│ │ - Normaliza ANTI×100│  │ - Project Resolver   │ │
│ │ - Convierte USD     │  │ - Fact Tables       │ │
│ └──────────────────────┘  └──────────────────────┘ │
└──────────────┬──────────────────┬───────────────────┘
               │                  │
               ▼                  ▼
┌─────────────────────────────────────────────────────┐
│ POSTGRESQL (Star Schema)                            │
│ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ │
│ │ financial_sot│ │ fact_rc_month│ │ agg_project_ │ │
│ │ (raw import) │ │ (normalized) │ │ month        │ │
│ └──────────────┘ └──────────────┘ └──────────────┘ │
│ ┌──────────────┐ ┌──────────────┐                  │
│ │ dim_period   │ │ fact_labor_  │                  │
│ │              │ │ month        │                  │
│ └──────────────┘ └──────────────┘                  │
└──────────────┬──────────────────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────────────────┐
│ EXPRESS API (Backend)                               │
│ ┌──────────────────────────────────────────────┐   │
│ │ view-aggregator.ts                           │   │
│ │ - Ensambla ViewModels                        │   │
│ │ - Calcula KPIs                               │   │
│ │ - Aplica filtros temporales                  │   │
│ └──────────────────────────────────────────────┘   │
└──────────────┬──────────────────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────────────────┐
│ REACT FRONTEND                                      │
│ ┌──────────────────────────────────────────────┐   │
│ │ TanStack Query                               │   │
│ │ - Fetch /api/projects/:id                    │   │
│ │ - Cache & Invalidation                       │   │
│ │ - Optimistic Updates                         │   │
│ └──────────────────────────────────────────────┘   │
│ ┌──────────────────────────────────────────────┐   │
│ │ Components                                   │   │
│ │ - MetricsCard                                │   │
│ │ - MonthlyChart (Recharts)                    │   │
│ │ - TeamTable                                  │   │
│ └──────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────┘
```

---

## 📝 NOTAS IMPORTANTES

1. **Separación Semántica**:
   - `quotation` (financial_sot) = Tipo de cambio FX
   - `quote_native` (fact_rc_month) = Precio de cotización del proyecto

2. **Project Resolver es crítico**:
   - Sin match → datos van a `rc_unmatched_staging`
   - Con match → datos van a `fact_rc_month`

3. **ANTI×100 se aplica en 3 lugares**:
   - Revenue en rendimiento-cliente.ts
   - Cost en rendimiento-cliente.ts
   - Hours Asana en sot-etl.ts

4. **El fix de "Pasado/Futuro"**:
   - Celdas vacías = proyectos confirmados
   - Solo rechaza si tiene valor Y no es "real"

5. **ETL corre automáticamente**:
   - Cron job diario a las 3 AM
   - También manual con `npm run etl:sync`

---

## 🚀 PRÓXIMOS PASOS RECOMENDADOS

1. **Monitoreo de valores status**:
   - Agregar logs de todos los valores únicos de "Pasado/Futuro"
   - Crear allow-list si aparecen nuevos valores válidos

2. **Mejoras al Project Resolver**:
   - Dashboard de auditoría para `rc_unmatched_staging`
   - UI para crear aliases manualmente

3. **Temporal Consistency Guard**:
   - Implementar alertas automáticas
   - Dashboard de anomalías detectadas

4. **Performance**:
   - Índices en month_key para queries más rápidas
   - Materializar vistas frecuentes

---

**Fecha**: Octubre 2025  
**Versión**: 2.0  
**Última actualización**: Fix "Pasado/Futuro" aplicado
