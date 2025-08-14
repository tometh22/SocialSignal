# Auditoría de Nomenclatura e Inconsistencias de Base de Datos
*Análisis realizado: 14 de Agosto 2025*

## 🔍 **Problema Identificado**

### **Inconsistencias Críticas de Nomenclatura**
Las referencias en el código NO coinciden con los nombres reales de las columnas en la base de datos.

## 📊 **Inconsistencias Encontradas**

### **1. Campos de Personnel - Costos Históricos**

**❌ En el código (camelCase):**
```typescript
jan2025HourlyRateARS, feb2025HourlyRateARS, mar2025HourlyRateARS...
jan2025MonthlySalaryARS, feb2025MonthlySalaryARS, mar2025MonthlySalaryARS...
```

**✅ En la base de datos (snake_case):**
```sql
jan_2025_hourly_rate_ars, feb_2025_hourly_rate_ars, mar_2025_hourly_rate_ars...
jan_2025_monthly_salary_ars, feb_2025_monthly_salary_ars, mar_2025_monthly_salary_ars...
```

### **2. Campos de Foreign Keys**

**❌ En el código:**
```typescript
clientId, projectId, personnelId, categoryId, quotationId, roleId
```

**✅ En la base de datos:**
```sql
client_id, project_id, personnel_id, category_id, quotation_id, role_id
```

### **3. Campos de Fechas en Active Projects**

**❌ En el código:**
```typescript
startDate, expectedEndDate, actualEndDate
```

**✅ En la base de datos:**
```sql
start_date, expected_end_date, actual_end_date
```

## 🗂️ **Archivos Afectados**

### **Backend (server/)**
- `routes.ts` - Múltiples referencias incorrectas
- `storage.ts` - Esquemas de inserción incorrectos
- `chat.ts` - Uso de projectId en lugar de project_id

### **Frontend (client/)**
- `components/admin/inline-edit-personnel.tsx` - Campos históricos incorrectos
- `pages/admin-fixed.tsx` - Referencias a campos incorrectos
- `pages/active-projects-modern.tsx` - Filtros con nombres incorrectos
- `components/layout/sidebar-fixed.tsx` - Referencias hardcoded

### **Schema (shared/)**
- `schema.ts` - Definiciones que no coinciden con la DB real

## 🎯 **Impacto del Problema**

### **Funcionalidades Afectadas:**
1. **Gestión de Personal** - Campos históricos de costos no funcionan
2. **Filtros de Proyectos** - Referencias a campos inexistentes
3. **Consultas de Base de Datos** - Errores en SELECT/UPDATE/INSERT
4. **Validaciones** - Esquemas Zod incorrectos

### **Síntomas Observados:**
- Campos que retornan NULL cuando deberían tener datos
- Errores en actualizaciones de base de datos
- Filtros que no funcionan correctamente
- Validaciones que fallan inesperadamente

## 📋 **Plan de Corrección**

### **Paso 1: Corregir Schema Principal**
- Actualizar `shared/schema.ts` con nombres correctos
- Regenerar todos los esquemas Zod

### **Paso 2: Corregir Backend**
- Actualizar `server/routes.ts` con nombres de campos correctos
- Corregir `server/storage.ts` con las referencias apropiadas

### **Paso 3: Corregir Frontend**
- Actualizar componentes con referencias correctas
- Corregir filtros y consultas

### **Paso 4: Verificación**
- Ejecutar pruebas de todas las funcionalidades
- Verificar que no hay referencias perdidas

## ⚠️ **Riesgo de la Corrección**
- **Alto**: Cambios masivos en múltiples archivos
- **Mitigation**: Corrección sistemática y pruebas exhaustivas
- **Rollback**: Disponible através del sistema de checkpoints

## 🔧 **Estado Actual**
- **Identificado**: ✅ Completo
- **Planificado**: ✅ Completo
- **En Corrección**: 🟡 En Progreso
- **Verificado**: ❌ Pendiente