# Auditoría de código — Feedback Mind V2-9

Fecha de revisión: 2026-08-13
Fuente: `.context/attachments/T4rtw3/Feedback Mind V2-9.pdf` (49 páginas)
Código contrastado: `08b8bfaa` (`origin/main`)

> **Nota de cierre:** este documento conserva la fotografía inicial contra `origin/main` (47 hechos, 21 por cerrar y 2 diferidos). La implementación de cierre está documentada en la fuente canónica Admin `server/content/feedback-mind-v2-9-definitions.md`: allí los 21 puntos pasan a Implementado y permanecen diferidos únicamente PRO-12 y TAR-16.

## Reauditoría posterior al cierre

Fecha: 2026-08-13. Se releyeron las 49 páginas —incluidas las capturas— y se volvió a contrastar cada uno de los 70 IDs contra UI, API, dominio, migraciones y regresiones. La segunda pasada detectó cinco brechas que la primera implementación había marcado prematuramente como cerradas:

1. **Definiciones Admin desalineadas:** estaban los 70 IDs, pero varias descripciones genéricas no correspondían al pedido original asociado a ese ID. Se reemplazaron por el mapeo exacto, se incrementó la versión a 2.9.1 y se agregó un contrato de 70 asuntos más un ledger append-only versión → SHA.
2. **Contratos mixtos incompletos en la grilla mensual:** sólo se mostraba/editaba una moneda y no se podía corregir `monthlyHoursSnapshot` por período. La grilla ahora administra ARS y USD independientemente, horas por mes y sueldos de sólo lectura; freelancers sin horas muestran la omisión sin inventar sueldo.
3. **Snapshots históricos sobrescritos:** editar una tarifa reutilizaba las horas contractuales actuales y editar horas de un período también cambiaba `personnel.monthly_hours`. Ahora cada período conserva su snapshot; cambiar las horas contractuales crea/actualiza exclusivamente el mes vigente dentro de una transacción.
4. **Sincronización no canónica:** el job periódico tenía una segunda implementación que escribía tarifas sin derivar sueldos y podía borrar la otra moneda. Sync manual, auto-sync, ETL y job usan ahora un único servicio que preserva monedas, deriva sueldos y registra advertencias idempotentes.
5. **Alta/edición de Personal incompleta:** los formularios no permitían cargar valor hora y horas junto con la persona. Alta y edición ya capturan moneda, ARS/USD y horas; el costo vigente se persiste transaccionalmente y el sueldo se presenta calculado.

Después de estas correcciones no quedan brechas funcionales conocidas en los 68 IDs autorizados. PRO-12 y TAR-16 continúan diferidos por definición. La única aceptación aún no certificable es el smoke visual interactivo a 1440/1024/390: el navegador integrado no estuvo disponible en esta sesión; la estructura responsive y sus regresiones estáticas sí fueron revisadas.

## Criterio de estado

- **HECHO**: existe implementación frontend/backend coherente y, cuando aplica, una regresión automatizada.
- **PARCIAL**: hay implementación, pero queda una parte explícita del pedido, falta validación visual/real o el flujo conserva dos comportamientos incompatibles.
- **NO HECHO**: el comportamiento pedido no existe o el código actual conserva expresamente el comportamiento objetado.
- **DIFERIDO**: el propio feedback pide no implementar todavía o plantea una idea sin definición funcional suficiente.

Las marcas `OK` y `PENDIENTE` del PDF se tomaron como contexto histórico, no como evidencia. El estado de abajo surge del código actual.

## Resumen ejecutivo

- Se consolidaron **70 pedidos trazables**: **47 hechos**, **11 parciales**, **10 no hechos** y **2 diferidos por definición de producto**.
- La base funcional pedida el 23/7, 31/7 y 7/8 está mayormente implementada.
- Los faltantes se concentran en la tanda del 13/8: consistencia matemática y de moneda en Cotizaciones, limpieza final de la UX de Tareas, cálculo/semántica del sueldo mensual, cierre del flujo Cotización → Proyecto y el workflow de Ausencias.
- Hay una deuda relevante en Cotizaciones: el contexto calcula el equipo USD en ARS canónicos, pero `financial-review-final.tsx` vuelve a calcular el costo usando la tarifa en la moneda elegida y lo denomina ARS. Esto permite que revisión, variantes y resumen muestren importes distintos.
- Los estilos solicitados de centrado están presentes en varios componentes, pero el PDF del 13/8 vuelve a reportar desalineación y no existe una prueba visual. Esos puntos se consideran parciales, no cerrados.

## Configuración — Personal y valor hora

| ID | Págs. | Pedido consolidado | Estado | Evidencia en código |
|---|---:|---|---|---|
| CFG-01 | 2, 18 | Sincronizar los valores del Máster y reflejarlos en Personal y Cotizaciones. | **HECHO** | `client/src/pages/admin-fixed.tsx:215-255` ejecuta auto-apply e invalida Personal, historial, cotizaciones y capacidad; `server/routes.ts:4107-4391` expone el historial canónico. La credencial real de Google sigue siendo una dependencia externa. |
| CFG-02 | 18 | Hacer que “Refrescar Datos” realmente replique los datos. | **HECHO** | El botón llama `/api/personnel/sheets-sync/auto-apply`, muestra resultado/error y refetchea Personal (`admin-fixed.tsx:215-266`). |
| CFG-03 | 18, 42 | Mantener coherentes sueldo mensual, valor hora y horas mensuales; el 13/8 se espera `valorHora × horasMensuales = sueldo`. | **NO HECHO** | La dirección actual es la inversa: `deriveHourlyRatesFromSalary()` calcula `valorHora = sueldo / horas` (`shared/utils/personnel-cost.ts:23-37`). El test también consagra esa dirección (`tests/feedback-mind-v2.test.ts`). No se deriva el sueldo esperado en pág. 42. |
| CFG-04 | 18, 29, 41 | Reemplazar el historial entrada-por-entrada por una tabla mensual comparable. | **PARCIAL** | Existe `HistoricalCostsTable`, pero la vista todavía monta también `PersonnelHistoricalCostsManager` debajo (`client/src/pages/admin-fixed.tsx:1274-1288`), por eso “se sigue viendo el listado”. |
| CFG-05 | 29, 41 | Permitir pasado y futuro, no fijar 2025 y nombrarlo como historial/proyección. | **HECHO** | Selector dinámico con años históricos, actual y futuro (`HistoricalCostsTable.tsx:21-38`) y texto explícito de períodos futuros (`:226`). |
| CFG-06 | 18, 29, 41 | Mostrar/sincronizar Rol vigente y Subnivel; usar Rol Viejo para freelancers. | **HECHO** | Parser y persistencia de `currentRole`, `sublevel`, `legacyRole`; columnas editables en `inline-edit-personnel.tsx:176-249`; tabla mensual usa rol vigente o histórico (`HistoricalCostsTable.tsx:171-179`). |
| CFG-07 | 15 | Unificar “Valor hora estimada” con Configuración > Personal. | **HECHO** | La tabla `estimated_rates` se elimina en migración; la pantalla antigua es informativa y redirige a Personal; POST responde 410 (`client/src/pages/estimated-rates.tsx`, `server/routes.ts:21662-21686`). |

## Cotizaciones

| ID | Págs. | Pedido consolidado | Estado | Evidencia en código |
|---|---:|---|---|---|
| COT-01 | 2 | Mantener Proyección de tarifas como selector. | **HECHO** | El selector continúa en `EnhancedTeamConfig.tsx:396-428`. |
| COT-02 | 2, 20, 30 | Tomar las tarifas actualizadas del historial y soportar personas con contrato USD (San/Ali). | **HECHO** | Resolver canónico ARS/USD y FX en `server/domain/personnel-rate.ts`; la grilla identifica USD/MIX y convierte una sola vez (`EnhancedTeamConfig.tsx:563-611`). |
| COT-03 | 3 | Permitir guardar y mostrar errores útiles sin inserciones parciales. | **HECHO** | Guardado transaccional/validado en rutas de cotizaciones; regresiones de rollback y error estructurado en `tests/feedback-mind-v2.test.ts`. |
| COT-04 | 3, 21, 31 | Ofrecer lista y carpetas Cliente > Proyecto, contraídas por defecto. | **HECHO** | `quoteView` soporta ambas vistas y `expandedQuoteClients` inicia vacío (`client/src/pages/manage-quotes.tsx:144, 635-671`). |
| COT-05 | 19, 30, 42 | Centrar Información básica. | **PARCIAL** | Hay layout centrado/responsive (`basic-info.tsx:56-60`, `max-w-5xl`), pero el PDF del 13/8 lo sigue reportando y no hay smoke visual automatizado. |
| COT-06 | 19, 30, 43 | Centrar Mes de salarios y Fuente/Proyección de tarifas. | **PARCIAL** | Se usan `md:items-center md:justify-center` y ancho uniforme (`EnhancedTeamConfig.tsx:357-428`), pero el último feedback lo vuelve a marcar pendiente; falta validar render real. |
| COT-07 | 31, 43 | Centrar la información de cada integrante del equipo. | **PARCIAL** | La fila usa grid con `items-center` y bloques centrados (`EnhancedTeamConfig.tsx:671-792`); sin control visual posterior al PDF. |
| COT-08 | 21, 43-45 | Alinear KPIs, escenario/moneda y tarjetas de Gestión de cotizaciones. | **PARCIAL** | Hay varias correcciones responsive (`manage-quotes.tsx:692-906`) y un commit previo de alineación, pero la evidencia visual del 13/8 muestra que el cierre no fue validado. |
| COT-09 | 20 | Dejar sólo “Foto del mes seleccionado” y “Promedio anual estimado”. | **HECHO** | Se retiró “Tarifa estimada proyectada”; regresión en `tests/feedback-mind-v2.test.ts`. |
| COT-10 | 30, 42 | Elegir moneda al principio y mantenerla durante todo el armado. | **HECHO** | “Moneda de cotización” está en Información básica y llama al recálculo común (`basic-info.tsx:174-203`). |
| COT-11 | 42-44 | Definir también el tipo de cambio al comienzo. | **PARCIAL** | La moneda se define al comienzo, pero el TC manual todavía sólo se edita en el paso posterior `CurrencySelection` (`currency-selection.tsx:22-72`); no está en Información básica. |
| COT-12 | 44 | Eliminar la segunda selección/ajuste de moneda-TC si ya se define al comienzo, salvo uso explícito para escenarios. | **NO HECHO** | El paso completo `CurrencySelection` sigue activo, permite volver a cambiar moneda y TC y finaliza la cotización (`currency-selection.tsx`). |
| COT-13 | 30, 43 | Si se elige USD, calcular y mostrar en USD sin reutilizar montos ARS ni fallar por coma decimal. | **PARCIAL** | El contexto convierte equipo USD a ARS canónico correctamente (`optimized-quote-context.tsx:620-640`), pero `financial-review-final.tsx:107-150` vuelve a sumar tarifas en moneda de cotización y trata el resultado como ARS. Quedan dos matemáticas incompatibles. |
| COT-14 | 44 | Hacer coincidir los totales de los tres escenarios, comparativa, pantalla previa y resumen. | **NO HECHO** | `QuotationVariants` recalcula variantes con sus propias fórmulas mientras la revisión usa otro cálculo (`QuotationVariants.tsx:112-182, 485-510`; `financial-review-final.tsx:107-244`). No hay fuente única ni test de igualdad entre pantallas. |
| COT-15 | 44 | Propagar el markup elegido hasta variantes y pantalla final. | **PARCIAL** | `marginFactor` se guarda en contexto y persistencia, pero existen estado local y cálculos derivados duplicados (`financial-review-final.tsx:74-92, 257-262`; `QuotationVariants.tsx:207, 510`). No hay regresión que cubra cambiar 2x→3x y verificar todas las pantallas. |
| COT-16 | 45 | Que la cotización recién generada aparezca al crear un proyecto. | **NO HECHO** | La finalización guarda como `pending` (`QuotationVariants.tsx:459` / revisión), mientras el alta de proyecto lista y acepta sólo `approved` (`new-project-with-tooltips.tsx:121, 234-266`; `server/routes.ts:8347-8352`). El flujo requiere una aprobación intermedia que el feedback no esperaba. |

## Proyectos

| ID | Págs. | Pedido consolidado | Estado | Evidencia en código |
|---|---:|---|---|---|
| PRO-01 | 4 | Crear proyectos internos sin cliente/cotización, asociados a Epical. | **HECHO** | Invariante frontend/backend y migración; `server/routes.ts:8318-8343`. |
| PRO-02 | 5 | Quitar “Solo con actividad” sin provocar error. | **HECHO** | El filtro trabaja sobre el view model normalizado y arranca apagado (`active-projects-next.tsx:302-311, 507`). |
| PRO-03 | 6, 32, 36 | Mostrar inmediatamente proyectos nuevos activos. | **HECHO** | Estado inicial Activos, operaciones recibe el scope completo y existe ventana de proyecto reciente; regresiones en ambos archivos de feedback. |
| PRO-04 | 6 | Evitar loop/error al navegar a enero. | **HECHO** | Fechas civiles y resolución estable de enero; regresión `2026-01-01 → 2026-01-31` en `tests/feedback-mind-v2.test.ts`. |
| PRO-05 | 9 | Crear proyectos desde un único lugar: Vista de proyectos. | **HECHO** | Se retiró creación desde Tareas; el endpoint legacy no crea proyectos nuevos. |
| PRO-06 | 10 | Gestionar el estado del proyecto en Vista de proyectos y no duplicarlo en Tareas. | **HECHO** | En el módulo de Tareas el estado se muestra como badge de lectura (`project-tasks-page.tsx:250-265`); la gestión vive en Proyectos. |
| PRO-07 | 8-9, 21-22, 31-32, 35 | Jerarquía Cliente > Proyecto, vista lista/carpeta y carpetas cerradas. | **HECHO** | Home y hub de Tareas soportan las dos vistas y sets vacíos de expansión (`tasks-home.tsx:292-293, 550-622`; `projects-hub.tsx`). |
| PRO-08 | 23-24, 34 | Usuarios comunes: sólo proyectos asignados y activos; Operaciones: todos con filtro. | **HECHO** | Backend fuerza `active` para usuarios comunes y aplica membresía; Operaciones puede pedir scope/estado (`server/routes.ts:20000-20075`). |
| PRO-09 | 24 | Unificar “Visualización Proyectos” y “Panel General” para Operaciones. | **PARCIAL** | Se unificó el scope de datos, pero siguen existiendo dos superficies: `active-projects-next.tsx` y `tasks/projects-hub.tsx`. No hay una única pantalla canónica. |
| PRO-10 | 33, 46 | Reflejar costo/horas después de altas, ediciones y bajas de tiempo. | **HECHO** | Las mutaciones esperan `triggerLaborRebuild`; se reconstruyen mes anterior/nuevo y se eliminan facts huérfanos (`server/routes.ts:19595-19870`, `server/etl/time-entries-to-fact-labor.ts`). |
| PRO-11 | 33, 46 | Reflejar actividad de Tareas dentro del proyecto. | **HECHO** | Las consultas de proyecto consumen tareas nativas y los rebuilds son awaited; la suite V2-7 cubre actualización de hechos. |
| PRO-12 | 46 | Evaluar retirar esa información de actividad de Vista de proyectos por ser propia de Gestión de tareas. | **DIFERIDO** | Es un comentario de producto (“no sé si hace sentido”), no una decisión cerrada. |

## Tareas — Home, proyecto y tiempo

| ID | Págs. | Pedido consolidado | Estado | Evidencia en código |
|---|---:|---|---|---|
| TAR-01 | 6 | Retirar “Tareas que asigné”. | **HECHO** | No existe en la Home actual. |
| TAR-02 | 6 | Mostrar horas propias de la semana y del mes. | **HECHO** | KPIs desde `/api/tasks/my-hours` (`tasks-home.tsx:425-454`). |
| TAR-03 | 8 | Impedir tareas raíz sueltas, sin proyecto/sección. | **HECHO** | Validación y restricciones de DB; subtareas heredan proyecto/sección. |
| TAR-04 | 8, 22 | Mostrar una tarea asignada en Home, Mis tareas y Calendario. | **HECHO** | Los tres consumen el conjunto autenticado de Mis tareas; responsable y colaboradores se normalizan por email. |
| TAR-05 | 11 | Calendario sólo lectura; creación dentro del proyecto. | **HECHO** | `TaskCalendarView` no expone mutaciones ni acciones de alta. |
| TAR-06 | 12, 24, 33 | Mostrar y editar inicio-fin como período, visible sin hover. | **HECHO** | Picker `mode="range"` en detalle y fila/Home; fechas civiles (`TaskDetailPanel.tsx:770-850`, `tasks-home.tsx:97-166`). |
| TAR-07 | 12, 25 | Permitir registrar horas sin error aun si falta costo histórico. | **HECHO** | La hora se guarda con `costingWarning` no bloqueante (`server/routes.ts:19735-19799`). |
| TAR-08 | 13, 15, 27 | Múltiples estimaciones semanales y visualización semanal coherente. | **HECHO** | `task_weekly_estimates` por tarea/semana; la capacidad consulta `weekStart` y suma solapamientos. |
| TAR-09 | 13 | Responsables/colaboradores sólo entre miembros del proyecto. | **HECHO** | Filtro frontend y validación backend (`ProjectTaskList.tsx:410-414`; `server/routes.ts:19550-19591`). |
| TAR-10 | 13 | Evitar dos editores de estado inconsistentes. | **HECHO** | El detalle quedó de lectura; el editor está en la fila y el tablero cambia por drag (`TaskDetailPanel.tsx:727-741`; regresión automatizada). |
| TAR-11 | 13 | Retirar rentabilidad de la vista interna de Tareas. | **HECHO** | No hay acceso financiero en `project-tasks-page.tsx`; el contrato además redacta campos financieros para no-Operaciones. |
| TAR-12 | 14 | Permitir agregar miembros al proyecto. | **HECHO** | Sheet de Miembros, alta/baja idempotente y permisos (`project-tasks-page.tsx:743+`). |
| TAR-13 | 26, 33-34 | Carga directa en la fila con presets, manual y temporizador. | **HECHO** | `QuickTaskHours` se usa en Home y lista; incluye 15/30/45/60, manual y timer. |
| TAR-14 | 33 | Gráfico mensual por proyecto y lista de tareas sin horas. | **HECHO** | Ambas secciones están en `tasks-home.tsx:456-520`. |
| TAR-15 | 34 | Mostrar proyecto en la fila. | **HECHO** | `HomeTaskRow` muestra `projectName` (`tasks-home.tsx:211-217`). |
| TAR-16 | 34 | No cambiar todavía la clasificación Próxima/En curso/Vencida. | **DIFERIDO** | El documento dice expresamente “No apliques nada”; no se cambió esa lógica. |
| TAR-17 | 35, 47 | Cargar horas para un tercero y atribuir capacidad/cierre/panel a esa persona. | **HECHO** | Operaciones puede enviar `personnelId`; backend valida permisos y persiste `effectivePersonnelId` (`server/routes.ts:19701-19734`). Suite V2-7 lo cubre. |
| TAR-18 | 36 | Dejar un solo reloj por tarea y mostrar resumen de cargas. | **HECHO** | Un único `QuickTaskHours`; muestra “Últimas cargas”. |
| TAR-19 | 37 | Editar horas, fecha y descripción de una carga. | **HECHO** | UI de edición y PATCH protegido (`TaskDetailPanel.tsx`; `server/routes.ts:19802-19870`). |
| TAR-20 | 38 | Unificar Gestión, Panel y Resumen. | **PARCIAL** | Existe una sola pestaña “Gestión”, pero dentro se renderiza `ProjectOverviewPanel` y luego otra segunda tanda de KPIs/progreso/horas (`project-tasks-page.tsx:551-700`), manteniendo contenido duplicado. |
| TAR-21 | 46-47 | Corregir alineación del gráfico de horas por proyecto. | **PARCIAL** | El chart tiene margen izquierdo negativo y eje inclinado (`tasks-home.tsx:470-479`); no existe corrección posterior ni prueba visual. |
| TAR-22 | 47 | Limitar Finalizadas a un marco temporal, por ejemplo esta semana. | **NO HECHO** | `filteredMyTasks` incluye todas las tareas con `status === "done"` sin fecha (`tasks-home.tsx:369-374`). |
| TAR-23 | 48 | Quitar “Completada” del desplegable de estado y completar sólo con checklist. | **NO HECHO** | La fila conserva checklist y, además, el popover enumera `todo`, `in_progress`, `blocked`, `done` (`ProjectTaskList.tsx:448-484`). |
| TAR-24 | 48 | Hacer Prioridad editable desde la fila como desplegable. | **NO HECHO** | La fila sólo muestra un punto de color (`ProjectTaskList.tsx:460`); la edición sigue dentro del detalle (`TaskDetailPanel.tsx:864-885`). |
| TAR-25 | 48 | Quitar “Por sección” de Gestión porque ya existe como filtro. | **NO HECHO** | `ProjectOverviewPanel` todavía calcula y renderiza `sectionBreakdown` y la tarjeta “Por sección” (`ProjectOverviewPanel.tsx:151-156, 300+`). |
| TAR-26 | 48 | Unificar “Equipo del proyecto” con “Personas involucradas”. | **NO HECHO** | La administración de Miembros está en un Sheet separado y Gestión renderiza otra tabla “Personas involucradas” (`project-tasks-page.tsx:743+`; `ProjectOverviewPanel.tsx:221+`). |

## Operaciones, Status y Finanzas

| ID | Págs. | Pedido consolidado | Estado | Evidencia en código |
|---|---:|---|---|---|
| OPS-01 | 15, 27, 38, 49 | Panel de horas debe incluir cargas de tareas. | **HECHO** | `/api/tasks/hours-summary` une `task_time_entries` y `time_entries`; regresión en `tests/feedback-mind-v2.test.ts`. |
| OPS-02 | 15, 27 | Capacidad debe leer estimaciones semanales, no perderlas al cambiar de día. | **HECHO** | Fuente semanal canónica y agregación por solapamiento; pruebas de semana civil. |
| OPS-03 | 15, 38, 47, 49 | Cierre mensual debe respetar horas reales y atribución a terceros. | **HECHO** | Recalcula en servidor con persona/tarifa/FX canónicos; la atribución de tercero usa `effectivePersonnelId`. |
| OPS-04 | 27 | Agregar tipo de ausencia “Día Epical”. | **HECHO** | UI, validación y capacidad aceptan `epical_day` (`personnel-absences.tsx:16, 104`; `server/routes.ts:21703-21716`). |
| OPS-05 | 16, 27 | Evitar corrimiento del feriado y alertar duplicados. | **HECHO** | Fechas civiles SQL `date`; POST devuelve 409 si la fecha ya existe; regresiones automatizadas. |
| OPS-06 | 38 | Descontar feriados hábiles en capacidad sin doble descuento con ausencias. | **HECHO** | Sets de fechas y exclusión de fines de semana/solapamientos (`server/routes.ts:21799-21828`); test V2-7. |
| OPS-07 | 48 | Poder eliminar un status creado. | **HECHO** | UI con confirmación y DELETE para ítems custom; los proyectos se quitan/ocultan y pueden restaurarse (`status-semanal.tsx:2480-2546, 2980-3030`; `server/routes.ts:21362-21400`). |
| OPS-08 | 39, 49 | Autoservicio de ausencias: solicitud del colaborador, aprobación/rechazo de Ops, alertas y saldo. | **NO HECHO** | La pantalla actual es CRUD administrativo directo, sin estado de aprobación, saldo ni alertas (`personnel-absences.tsx`; `server/routes.ts:21688-21728`). |
| FIN-01 | 16 | Corregir Activo/Pasivo inflados por parsing/mezcla ARS-USD. | **HECHO** | Parser ES/US, normalización a `monto_total_usd`, fallback `ARS / cotización` y reparación de migración (`server/routes-ledger.ts:37-70`; `migrations/0031_feedback_mind_v2.sql:271-326`). |

## Faltantes prioritarios

1. **Cotizaciones — fuente única matemática:** eliminar los recálculos paralelos entre contexto, Revisión, Variantes y Moneda; agregar un test que recorra ARS/USD, TC manual y markup 2x→3x y exija igualdad exacta en todas las pantallas.
2. **Cotización → Proyecto:** decidir si “Finalizar” aprueba o si el alta de proyecto debe explicar/permitir aprobar; hoy una cotización nueva queda `pending` y por eso no aparece.
3. **Personal — sueldo mensual:** confirmar semántica y cambiar la dirección del cálculo para cumplir `valorHora × horas = sueldo`, o renombrar campos si el sueldo debe ser el input canónico.
4. **Tareas — limpieza 13/8:** limitar Finalizadas, retirar `done` del dropdown, prioridad inline, remover “Por sección”, unificar miembros/personas y quitar los KPIs duplicados de Gestión.
5. **Ausencias:** diseñar e implementar solicitud/aprobación/saldo/alertas; hoy sólo existe registro administrativo.
6. **QA visual:** validar de forma interactiva los centrados de Cotizaciones y el gráfico de Home; la revisión estática no contradice las capturas del 13/8.

## Verificación ejecutada

```text
npm ci
✓ 622 paquetes instalados; 0 vulnerabilidades reportadas por npm

npm test -- --run tests/feedback-mind-v2.test.ts tests/feedback-mind-v2-7.test.ts
✓ 2 archivos, 50 tests aprobados

npm run check
✓ TypeScript aprobado
```

Estas regresiones prueban buena parte de las tandas anteriores, pero no cubren los pedidos nuevos del 13/8 enumerados como NO HECHO/PARCIAL.
