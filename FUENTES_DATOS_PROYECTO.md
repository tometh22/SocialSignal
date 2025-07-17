# 📊 FUENTES DE DATOS - VISTA PROYECTO

## 🔍 ANÁLISIS DETALLADO POR PESTAÑA

### 1. **RESUMEN EJECUTIVO** (Tab Principal)

#### **Tarjetas KPI del Header:**
- **Datos origen**: `useCompleteProjectData(project.id, timeFilter)` → `/api/projects/${id}/complete-data?timeFilter=${filter}`
- **Fuente backend**: 
  - `storage.getActiveProject(id)` → Datos base del proyecto
  - `storage.getQuotationTeamMembers(project.quotation.id)` → Horas estimadas (969h)
  - `storage.getTimeEntriesByProject(id)` → Horas trabajadas (filtradas por período)

#### **Cálculos específicos:**
```javascript
// Score de Salud: Basado en eficiencia horaria
efficiency = (totalWorkedHours / adjustedEstimatedHours) * 100
healthScore = 100 - Math.max(0, efficiency - 100)

// Proyección Financiera: Markup calculation
markup = adjustedTotalAmount / totalWorkedCost

// Eficiencia Equipo: Utilización presupuestaria
budgetUtilization = (totalWorkedCost / adjustedBaseCost) * 100

// Indicadores Operacionales: Conteo de registros
totalEntries = timeEntries.length (después de filtrar)
```

### 2. **ANÁLISIS DE EQUIPO** (Tab Equipo)

#### **Mapa de Calor del Equipo:**
- **Fuente**: `useQuery("/api/projects/${projectId}/team-time-data")` → Endpoint personalizado
- **Datos backend**: 
  - `storage.getTimeEntriesByProject(projectId)` → Filtrado por `dateFilter`
  - `storage.getPersonnel()` → Nombres y roles del equipo
  - `storage.getRoles()` → Información de roles

#### **Top Performers:**
- **Cálculo**: Ranking basado en horas trabajadas en el período filtrado
- **Métricas**: Eficiencia, peso del proyecto, uso de horas por persona

### 3. **REGISTRO DE TIEMPO** (Tab Tiempo)

#### **Formulario de Registro:**
- **Fuente**: `WeeklyTimeRegister` component
- **Datos origen**: 
  - `useQuery("/api/projects/${projectId}/base-team")` → Equipo base del proyecto
  - `useQuery("/api/personnel")` → Lista completa del personal
  - `useQuery("/api/roles")` → Roles disponibles

#### **Histórico de Tiempo:**
- **Fuente**: `useQuery("/api/projects/${projectId}/time-entries")` 
- **Filtrado**: Por `dateFilter` en el frontend
- **Datos**: Horas, costos, fechas, personal assignado

### 4. **ANÁLISIS MENSUAL** (Tab Analytics)

#### **6 Tarjetas KPI Principales:**
**TODAS usan el mismo origen consolidado:**
- **Fuente única**: `useCompleteProjectData(project.id, timeFilter)` 
- **Endpoint**: `/api/projects/${id}/complete-data?timeFilter=${filter}`

#### **Lógica de Filtrado Temporal:**
```javascript
// Backend: Filtro de time entries por período
timeEntries = timeEntries.filter(entry => {
  const entryDate = new Date(entry.date);
  return entryDate >= dateRange.startDate && entryDate <= dateRange.endDate;
});

// Para proyectos Always-On: Ajuste proporcional
if (project.quotation?.projectType === 'always-on') {
  adjustedEstimatedHours = (estimatedHours / 12) * monthsInFilter;
  adjustedBaseCost = (baseCost / 12) * monthsInFilter;
}
```

## 🚨 PROBLEMAS IDENTIFICADOS

### **Inconsistencias en las Fuentes:**

1. **Pestaña "Resumen Ejecutivo"**: 
   - ✅ Usa `useCompleteProjectData` (CORRECTO)
   - ✅ Datos filtrados por período

2. **Pestaña "Análisis de Equipo"**:
   - ❌ Usa endpoint separado `/team-time-data` (INCONSISTENTE)
   - ❌ Puede no aplicar filtro temporal correctamente

3. **Pestaña "Registro de Tiempo"**:
   - ❌ Usa endpoints separados para personal y tiempo
   - ❌ Filtrado solo en frontend (no en backend)

4. **Pestaña "Análisis Mensual"**:
   - ✅ Usa `useCompleteProjectData` (CORRECTO)
   - ✅ Filtrado temporal implementado

## 🔧 SOLUCIÓN RECOMENDADA

### **Unificar todas las pestañas para usar la misma fuente:**

```javascript
// EN TODAS LAS PESTAÑAS:
const { data: completeData } = useCompleteProjectData(project.id, timeFilter);

// Esto garantiza:
// 1. Consistencia entre todas las pestañas
// 2. Filtrado temporal uniforme
// 3. Cálculos idénticos
// 4. Single source of truth
```

### **Endpoints que necesitan actualización:**

1. **`/api/projects/${id}/team-time-data`** → Eliminar, usar complete-data
2. **`/api/projects/${id}/time-entries`** → Actualizar para usar filtro temporal
3. **`/api/projects/${id}/base-team`** → Incluir en complete-data response

## 📋 ESTADO ACTUAL (17 Julio 2025 - 7:05 PM)

### ✅ **SISTEMA UNIFICADO IMPLEMENTADO**

**Todas las pestañas ahora usan la misma fuente de datos:**
- **Hook centralizado**: `useCompleteProjectData(projectId, timeFilter)`
- **Endpoint único**: `/api/projects/${id}/complete-data?timeFilter=${filter}`
- **Filtro temporal**: Mapeo automático entre UI y backend

### 🔧 **CAMBIOS IMPLEMENTADOS**

1. **Convertido project-details-redesigned.tsx** para usar hook centralizado
2. **Filtro temporal unificado** con mapeo automático:
   - `Mes pasado` → `last_month`
   - `Este mes` → `current_month`
   - `Trimestre pasado` → `last_quarter`
   - `Este trimestre` → `current_quarter`
   - `Año` → `current_year`
   - `Personalizado` → `all` (con rango específico)

3. **Eliminadas inconsistencias** en fuentes de datos

### 🎯 **RESULTADO ESPERADO**

- ✅ **Consistencia total**: Todas las pestañas muestran métricas idénticas
- ✅ **Filtrado temporal**: Funciona en todas las pestañas
- ✅ **Single source of truth**: No más discrepancias entre pestañas
- ✅ **Cálculos uniformes**: Mismo markup, horas, costos en todas las vistas

### 📊 **FUENTES DE DATOS UNIFICADAS**

**TODAS LAS PESTAÑAS AHORA USAN:**
- `completeData.totalWorkedHours` - Horas trabajadas filtradas
- `completeData.adjustedEstimatedHours` - Horas estimadas ajustadas
- `completeData.totalWorkedCost` - Costo real filtrado
- `completeData.adjustedBaseCost` - Costo estimado ajustado
- `completeData.markup` - Markup calculado consistentemente
- `completeData.teamStats` - Estadísticas del equipo filtradas