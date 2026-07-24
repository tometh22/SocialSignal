# Auditoría final de implementación — Feedback Mind V2

Fecha: 2026-07-24
Base original: `origin/main` en `d77d0956`

## Resultado ejecutivo

- Puntos implementados en frontend y backend: **31/31**
- TypeScript: **aprobado**
- Suite automatizada: **88 aprobados, 11 omitidos por depender de datos de integración**
- Build de producción: **aprobado**
- Migración `0031_feedback_mind_v2.sql`: **aprobada dos veces consecutivas**
- Smoke autenticado con PostgreSQL: **aprobado**
- Errores de whitespace: **0**

La implementación no conserva faltantes de código conocidos respecto del PDF. Hay dos
limitaciones externas registradas: la credencial disponible para Google Sheets devuelve
`invalid_grant: Invalid JWT Signature`, por lo que no se pudo ejecutar una sincronización
real del Máster; y el navegador integrado no estuvo disponible para un smoke visual. Los
contratos, persistencia y recorridos protegidos sí se probaron contra PostgreSQL efímero.

## Registro de los 31 puntos

| # | Estado | Resultado implementado | Validación |
|---:|:---:|---|---|
| 1 | ✅ | `personnel_historical_costs` es la única fuente operativa. Personal expone tarifa ARS/USD, sueldo, período e historial normalizados; sync preview/apply lee y escribe esa tabla. Los aliases legacy se reconstruyen desde el historial y nunca filtran valores viejos. | DTO y persistencia aprobados en smoke. Sync real pendiente únicamente por credencial Google inválida. |
| 2 | ✅ | Proyección de tarifas permanece como selector compacto. | TypeScript y build. |
| 3 | ✅ | Cotizaciones resuelven ARS/USD y mes seleccionado desde el mismo historial canónico, incluyendo cambios de moneda, proyección y promedio anual. | DTO canónico y guardado de cotización aprobados. Comparación contra Máster real bloqueada por credencial. |
| 4 | ✅ | Números normalizados; cotización y equipo se guardan en una transacción; referencias inválidas devuelven paths por integrante y no insertan la cotización. | Smoke: guardado completo y rollback ante `personnelId` inválido. |
| 5 | ✅ | Gestión de cotizaciones agrupada Cliente > Proyecto. | Revisión de código y build. |
| 6 | ✅ | Proyectos internos se fuerzan a Epical en frontend y backend, sin cotización y con subtipo interno. La migración crea Epical/General interno y migra proyectos propios. | Migración idempotente y arranque de producción probados. |
| 7 | ✅ | “Solo con actividad” filtra una respuesta normalizada sin disparar otro contrato; métricas vacías tienen defaults estables. | TypeScript/build; dataset original no disponible. |
| 8 | ✅ | Proyectos recién creados cuentan como activos durante la ventana inicial aunque no tengan movimientos. | Regresión automatizada. |
| 9 | ✅ | Navegación y rangos de enero usan fechas civiles/locales y respuestas sin datos estables. | Regresión `2026-01-01 → 2026-01-31`. |
| 10 | ✅ | Se retiró “Tareas que asigné”. | Búsqueda estática y build. |
| 11 | ✅ | Home de Tareas muestra horas propias de semana y mes desde `/api/tasks/my-hours`. | Smoke: `2.5h` en ambos totales. |
| 12 | ✅ | Toda tarea raíz exige proyecto y sección; subtareas heredan ambos al crear y al cambiar de padre. La migración repara históricos y agrega FK/check. | Smoke: tarea huérfana rechazada; migración aprobada. |
| 13 | ✅ | “Mis tareas” usa email autenticado normalizado e incluye responsable o colaborador. | Smoke autenticado: tarea asignada visible. |
| 14 | ✅ | Home y hub de Tareas agrupan Cliente > Proyecto. | Revisión de código y build. |
| 15 | ✅ | No existe creación de proyectos desde Tareas/sidebar; el endpoint legacy sólo permite unirse a uno existente y devuelve `410` si se intenta crear. | Búsqueda de rutas y CTAs. |
| 16 | ✅ | Estado de proyecto es de lectura en Tareas; el backend rechaza su modificación desde ese módulo. | Revisión frontend/backend. |
| 17 | ✅ | Calendario reutiliza exactamente el conjunto de “Mis tareas”. | Smoke del endpoint compartido y revisión de UI. |
| 18 | ✅ | Calendario es sólo lectura. | Búsqueda de acciones de creación. |
| 19 | ✅ | Creación y edición soportan inicio/fin; frontend y backend rechazan inicio posterior a fin. | Revisión de contrato y smoke de tarea con rango. |
| 20 | ✅ | Horas pertenecen al usuario autenticado, no al responsable ni al ID enviado por cliente; se informa si el usuario no está vinculado a Personal. | Smoke: se envió `personnelId=2`, se guardó `personnelId=1`, tarifa ARS 25.000 y costo ARS 62.500. |
| 21 | ✅ | Múltiples estimaciones semanales con upsert por tarea/semana. | Smoke con `10h + 6h`. |
| 22 | ✅ | Selectores y API permiten responsables/colaboradores sólo entre miembros del proyecto, sin fallback. | Revisión frontend/backend. |
| 23 | ✅ | Un solo editor de estado visible en la lista; panel y menú quedaron sin editor duplicado. | Revisión de componentes y build. |
| 24 | ✅ | Rentabilidad se retiró del proyecto interno de Tareas. | Búsqueda de accesos. |
| 25 | ✅ | Unique/FK de miembros y alta idempotente con `ON CONFLICT`. | Migración dos veces; dos altas dejaron una sola fila. |
| 26 | ✅ | Panel de Horas consume las cargas de tareas con identidad/costo correctos. | Persistencia autenticada aprobada y contrato del panel revisado. |
| 27 | ✅ | Tareas exponen total y semana; muestran `0h / Nh`; Capacidad lee y edita `task_weekly_estimates`, incluido borrar con `0`. | Smoke: total `16h`, semana actual `10h`. |
| 28 | ✅ | Cierre suma horas reales de ambas fuentes y toma tarifa/FX canónicos; backend ignora tarifa/total manipulados por cliente. | Smoke: payload con tarifa/total `1` cerró con ARS 25.000/h, ARS 4.000.000 y FX 1.250. |
| 29 | ✅ | Se eliminó la tabla editable `estimated_rates`; Configuración > Personal administra el único historial. Ruta antigua es lectura compatible y rechaza escrituras. | Migración y búsqueda de navegación. |
| 30 | ✅ | Feriados usan SQL `date` y transportan `YYYY-MM-DD` sin UTC. | Regresión y smoke: `2026-08-17` se devolvió como día 17. |
| 31 | ✅ | Importador usa encabezados exactos, parser ES/US, conserva ARS/USD/FX y normaliza el total USD. La migración repara saldos inconsistentes. | Regresiones monetarias y migración idempotente. Reimportación real bloqueada por credencial Google. |

## Validaciones ejecutadas

```text
npm run check
✅ TypeScript sin errores

npm test
✅ 7 archivos: 6 aprobados, 1 omitido
✅ 88 tests aprobados, 11 omitidos

npm run build
✅ Vite y bundle del servidor completados

git diff --check
✅ Sin errores

migrations/0031_feedback_mind_v2.sql
✅ Ejecutada dos veces consecutivas sobre PostgreSQL 16

arranque de la aplicación
✅ Migration OK: 0031 feedback_mind_v2 closure
✅ Aprobado en una base con quotation_id aún NOT NULL y ledger faltante

smoke autenticado
✅ Personal canónico: ARS 25.000, USD 20, sueldo ARS 4.000.000
✅ Tarifa histórica numérica aceptada; duplicado activo rechazado con 409
✅ Tarea sin proyecto rechazada
✅ Miembro idempotente: una fila después de dos altas
✅ Estimaciones: 16h totales, 10h semana actual
✅ Horas: 2.5h atribuidas al usuario autenticado, costo ARS 62.500
✅ Mis tareas y horas propias
✅ Feriado 2026-08-17
✅ Cotización válida y rollback total ante integrante inválido
✅ Cierre mensual recalculado en servidor desde tarifa/FX canónicos
```

Los 11 tests omitidos no son fallos: nueve son golden tests que sólo se habilitan
con `RUN_INTEGRATION_TESTS=1` y datos externos, y dos cubren estados de autenticación
que la suite marca explícitamente como `skip`.

## Migraciones y despliegue

- La migración fuente vive en `migrations/0031_feedback_mind_v2.sql`.
- La copia idempotente de runtime vive en `server/migrations/feedback-mind-v2.ts`.
- El arranque ejecuta la migración antes de inicializar datos, por lo que el despliegue
  no depende de que el directorio fuente de migraciones esté presente en la imagen.
- La reparación incluye Epical/proyectos internos, tareas huérfanas y subtareas,
  estimaciones legacy, unicidad de miembros/tarifas, feriados y ledger Activo/Pasivo.

## Limitaciones externas

1. Google rechazó la credencial adjunta con `invalid_grant: Invalid JWT Signature`.
   Debe rotarse para repetir Máster → Personal → Cotización y reimportar Activo/Pasivo.
2. No hubo navegador integrado disponible para interacción visual; frontend quedó
   cubierto por TypeScript, build y revisión estática, y sus APIs por smoke autenticado.
3. `npm audit --omit=dev` reporta deuda preexistente de dependencias; no se aplicaron
   upgrades mayores fuera del alcance funcional de Feedback Mind V2.
