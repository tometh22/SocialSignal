# 📊 DATOS DETALLADOS POR PESTAÑA - VISTA PROYECTO

## 🔍 ANÁLISIS ESPECÍFICO DE CADA SECCIÓN

### 1. **PESTAÑA "RESUMEN EJECUTIVO"** (dashboard)

#### **Fuentes de Datos:**
- **Hook principal**: `useCompleteProjectData(projectId, timeFilter)`
- **Datos base**: `costSummary` extraído de `completeData`
- **Filtrado**: Por período temporal seleccionado

#### **Métricas Mostradas:**

**Card 1: MARKUP**
- **Valor**: `costSummary.markup.toFixed(1)x`
- **Cálculo**: `totalAmount / totalCost`
- **Badge**: Excelente (≥2.5x), Bueno (≥1.8x), Aceptable (≥1.2x), Crítico (<1.2x)

**Card 2: PROGRESO DE HORAS**
- **Valor**: `costSummary.hoursProgress.toFixed(1)%`
- **Cálculo**: `(filteredHours / targetHours) * 100`
- **Detalle**: `${filteredHours}h / ${targetHours}h`
- **Progress Bar**: Visual con valor del porcentaje

**Card 3: USO DEL PRESUPUESTO**
- **Valor**: `costSummary.budgetUtilization.toFixed(1)%`
- **Cálculo**: `(totalCost / targetBudget) * 100`
- **Detalle**: `$${totalCost.toLocaleString()}`
- **Progress Bar**: Visual con valor del porcentaje

**Card 4: REGISTROS TOTALES**
- **Valor**: `costSummary.totalEntries`
- **Cálculo**: Conteo de `timeEntries` filtrados por período
- **Badge**: Con estado basado en actividad

---

### 2. **PESTAÑA "ANÁLISIS DE EQUIPO"** (team-analysis)

#### **Fuentes de Datos:**
- **Hook principal**: `useCompleteProjectData(projectId, timeFilter)`
- **Datos equipo**: `teamStats` extraído de `completeData`
- **Componente**: `TeamDeviationAnalysis` con filtros

#### **Métricas Mostradas:**

**Sección 1: RESUMEN OPERATIVO**
- **Miembros Activos**: `teamStats.length`
- **Horas Trabajadas**: `costSummary.filteredHours.toFixed(1)h`
- **Progreso**: `((filteredHours / targetHours) * 100).toFixed(0)%`
- **Promedio por Miembro**: `(totalHours / teamStats.length).toFixed(1)h`

**Sección 2: ANÁLISIS DE DESVIACIONES**
- **Componente**: `TeamDeviationAnalysis`
- **Props**: `projectId` y `dateFilter` (startDate/endDate)
- **Datos**: Tabla con comparativa por miembro vs objetivos

**Sección 3: REPORTES**
- **Exportar CSV**: Genera reporte con datos del equipo
- **Historial**: Navegación a `/time-entries/project/${projectId}`

---

### 3. **PESTAÑA "REGISTRO DE TIEMPO"** (time-management)

#### **Fuentes de Datos:**
- **Hook principal**: `useCompleteProjectData(projectId, timeFilter)`
- **Datos adicionales**: `baseTeam` de `/api/projects/${projectId}/base-team`
- **Entries**: `timeEntries` filtradas por `filterTimeEntriesByDateRange`

#### **Métricas Mostradas:**

**Sección 1: MÉTRICAS COMPACTAS**
- **Total Registrado**: `(filteredHours / targetHours * 100).toFixed(2)%`
- **Miembros Activos**: `teamStats.filter(member => member.hours > 0).length`
- **Promedio Diario**: `(filteredHours / diasPeriodo).toFixed(1)h`

**Sección 2: REGISTROS RECIENTES**
- **Datos**: `timeEntries` filtrados por `dateFilter`
- **Cálculo**: `filterTimeEntriesByDateRange(timeEntries)`
- **Mostrar**: Últimas 10 entradas con fecha, miembro, horas, costo

**Sección 3: EQUIPO BASE**
- **Componente**: `ProjectTeamSection`
- **Datos**: `baseTeam` con horas estimadas vs trabajadas
- **Cálculo**: `getTimeWorkedByMember(member.personnelId)`

---

### 4. **PESTAÑA "ANÁLISIS MENSUAL"** (details)

#### **Fuentes de Datos:**
- **Hook principal**: `useCompleteProjectData(projectId, timeFilter)`
- **Componente**: `ProjectSummaryFixed`
- **Props**: `projectId`, `timeFilter`, `isLoading`

#### **Métricas Mostradas:**

**Las 6 Tarjetas KPI:**
1. **Score de Salud**: `healthScore` calculado en backend
2. **Proyección Financiera**: `markup` con color coding
3. **Eficiencia del Equipo**: `budgetUtilization` porcentaje
4. **Indicadores Operacionales**: `totalEntries` conteo
5. **Progreso del Proyecto**: `hoursProgress` porcentaje
6. **Calidad de Entregables**: `deliverableQuality` promedio

**Sección Análisis Avanzado:**
- **Componente**: `TrendCharts`
- **Datos**: Gráficos de tendencias filtrados
- **Componente**: `DeviationAnalysis`
- **Datos**: Análisis de desviaciones filtradas

---

## 🔧 SISTEMA DE FILTRADO TEMPORAL

### **Mapeo de Filtros:**
```javascript
const getTimeFilterForHook = (filter) => {
  if (filter.label.includes('Mes pasado')) return 'last_month';
  if (filter.label.includes('Este mes')) return 'current_month';
  if (filter.label.includes('Trimestre pasado')) return 'last_quarter';
  if (filter.label.includes('Este trimestre')) return 'current_quarter';
  if (filter.label.includes('Semestre pasado')) return 'last_semester';
  if (filter.label.includes('Este semestre')) return 'current_semester';
  if (filter.label.includes('Año')) return 'current_year';
  return 'all';
};
```

### **Aplicación del Filtro:**
- **Hook**: `useCompleteProjectData(projectId, getTimeFilterForHook(dateFilter))`
- **Endpoint**: `/api/projects/${projectId}/complete-data?timeFilter=${mappedFilter}`
- **Backend**: Filtra `timeEntries` por rango de fechas
- **Always-On**: Ajusta objetivos proporcionalmente

---

## 📊 CÁLCULOS ESPECÍFICOS

### **Markup:**
```javascript
markup = quotation.totalAmount / totalWorkedCost
```

### **Progreso de Horas:**
```javascript
hoursProgress = (totalWorkedHours / adjustedEstimatedHours) * 100
```

### **Utilización Presupuesto:**
```javascript
budgetUtilization = (totalWorkedCost / adjustedBaseCost) * 100
```

### **Score de Salud:**
```javascript
efficiency = (totalWorkedHours / adjustedEstimatedHours) * 100
healthScore = 100 - Math.max(0, efficiency - 100)
```

### **Horas Ajustadas (Always-On):**
```javascript
if (projectType === 'always-on') {
  adjustedEstimatedHours = (estimatedHours / 12) * monthsInFilter
  adjustedBaseCost = (baseCost / 12) * monthsInFilter
}
```

---

## ✅ CONSISTENCIA GARANTIZADA

**Todas las pestañas usan:**
- Mismo endpoint: `/api/projects/${projectId}/complete-data`
- Mismo filtro temporal aplicado
- Mismos cálculos de backend
- Misma estructura de datos `completeData`

**Resultado:**
- **Markup idéntico** en todas las pestañas
- **Horas filtradas consistentes** en todas las vistas
- **Costos uniformes** en todos los componentes
- **Progreso sincronizado** entre secciones