# Revisión completa del feedback acumulado — 29/10/2026

Fuente: PDF recibido el 29/10, 138 páginas; SHA-256 `76586428265786e79e271cfbb21ade3d1a59f2f7d67196d0fa512f2f81c0d810`. Se releyó el texto completo y se consolidaron los pedidos repetidos. El [mapa por fecha y página](feedback-mind-28-10-implementation.md) conserva las 17 rondas. Esta matriz agrega el seguimiento por comportamiento; no cuenta repeticiones como funcionalidades nuevas.

## Qué corrige esta segunda pasada

La publicación 1.14.13/14 cubrió siete puntos nuevos del 28/10. Esa publicación no certificaba por sí misma el resto de las 138 páginas. La reauditoría encontró dos brechas anteriores: la API de promedios omitía `area`, y moneda/TC existían en el cotizador pero se editaban recién en Inversión. Ambas se reproducen y tienen corrección y regresión nueva.

**Cómo leer la evidencia:** una fila con código/regresión indica implementación localizada y pruebas del comportamiento o del contrato señalado. HTTP indica un recorrido nuevo contra esquema PostgreSQL real en una base local sólo sintética. Navegador indica el recorrido expresamente descrito. Las evidencias visuales anteriores se identifican por versión: no se presenta una repetición manual de todas las capturas del historial como si se hubiera hecho hoy.

## Configuración y tarifas

Regresiones relevantes: `tests/feedback-mind-v2.test.ts; tests/feedback-mind-v2-9-domains.test.ts; tests/feedback-mind-v2-11.test.ts; tests/feedback-mind-v2-13.test.ts`.

| ID | Pedido consolidado | Implementación actual | Evidencia y alcance |
|---|---|---|---|
| CFG01 | Sync del Máster, refresco y propagación de tarifas | server/services/personnel-cost-sync.ts; server/jobs/daily-sot-sync.ts; client/src/pages/admin-fixed.tsx | Código y regresión; llamada externa no ejecutada en esta base sintética. |
| CFG02 | Sueldo = tarifa × horas; ARS/USD independientes | shared/utils/personnel-cost.ts; server/routes.ts: costos históricos | HTTP nuevo: 123,45 × 160 = 19.752 ARS; 2,5 × 160 = 400 USD; salario enviado por cliente no reemplaza el derivado. |
| CFG03 | Tabla mensual única, pasado/futuro y horas de cada período | client/src/components/admin/HistoricalCostsTable.tsx | HTTP nuevo: editar horas de un período no cambia otro mes ni el contrato actual; suite de grilla. |
| CFG04 | Nivel vigente, subnivel, rol viejo y áreas | shared/utils/personnel-classification.ts; client/src/components/admin/inline-edit-personnel.tsx | Código y regresión de taxonomía, importación y formularios. |
| CFG05 | Promedios por nivel/subnivel/área, sin freelancers ni bajas | server/services/role-rate-averages.ts; client/src/components/admin/inline-edit-role.tsx | BRECHA CORREGIDA: API omitía área; HTTP y PostgreSQL nuevos con dos áreas, baja, freelance y tarifa futura. |
| CFG06 | Tarifa vigente más reciente y conversión USD del período | server/services/role-rate-averages.ts; server/domain/personnel-rate.ts | PostgreSQL nuevo + tests de moneda y resolución de tarifas; defaults manuales conservados. |
| CFG07 | Unificar Valor hora estimada con Personal | client/src/pages/estimated-rates.tsx; server/routes.ts | Ruta antigua retirada y referencia a Personal; regresión V2. |
| CFG08 | TC observado vs estimado, REM 2027 y sync Blue separado | server/services/fxSync.ts; shared/utils/master-fx.ts; shared/utils/fx-periods.ts | Regresión de parser, fuentes, meses cerrados y no sobreescritura. No se convierte una estimación a real sólo porque pasó el mes. |
| CFG09 | Verificación del TC en vivo con errores accionables | server/services/liveFx.ts; client/src/components/optimized/basic-info.tsx | Código y tests de fuentes; consulta externa no usada como una tarifa inventada en QA. |
| CFG10 | Inflación antigua fuera del pricing activo | client/src/components/optimized/inflation-adjustment-card.tsx; server/content/feedback-mind-v2-9-definitions.md | Decisión histórica registrada y regresión V2-11; no se fuerza otro flujo financiero. |
| CFG11 | Cumpleaños editables y personas sólo cumpleaños | client/src/pages/admin-fixed.tsx; server/routes.ts: /api/birthdays | Validación de fecha, bajas y CRUD; tests feedback-final-closure y 9-10. |
| CFG12 | Acciones de Personal visibles y con autorización de administración | client/src/pages/admin-fixed.tsx; server/routes.ts | HTTP nuevo: colaborador no edita tarifas ni ejecuta preview de sync; tests followup-personnel-auth y followup-sync-auth. |

## Cotizaciones

Regresiones relevantes: `tests/quotation-*.test.ts; tests/quotation-credit-compat.integration.test.ts; tests/deliverable-name-compatibility.integration.test.ts; tests/feedback-closure-regressions.test.ts; tests/followup-quote-consistency.test.ts`.

| ID | Pedido consolidado | Implementación actual | Evidencia y alcance |
|---|---|---|---|
| COT01 | Guardar cotización con errores de campos y rollback | server/routes.ts: /api/quotations; client/src/lib/api-error.ts | Contratos V2 y pruebas de compatibilidad PostgreSQL; se preservan formatos históricos. |
| COT02 | Lista/carpetas cliente > proyecto, contraídas | client/src/pages/manage-quotes.tsx | Regresión V2-7 y agrupación/archivo; no se repiten propuestas agrupadas como individuales. |
| COT03 | Moneda y TC al comienzo, una referencia durante el recorrido | client/src/components/optimized/basic-info.tsx; client/src/pages/optimized-quote.tsx; client/src/utils/quotation-ux.ts | BRECHA CORREGIDA: estaban en Inversión. Ahora Brief incluye ambos; Inversión muestra snapshot y acceso a edición. Render real y validación nuevos; navegador con coma decimal y TC vacío. |
| COT04 | ARS/USD, coma decimal, dos decimales y conversión única | shared/utils/quotation-pricing.ts; server/domain/personnel-rate.ts | Motor canónico, escenarios y tests de monedas/localización. |
| COT05 | Markups y totales coherentes entre equipo, inversión y propuesta | client/src/context/optimized-quote-context.tsx; shared/utils/quotation-pricing.ts | Regresión de escenarios 2x/3x, costo/precio separados y moneda manual. |
| COT06 | Variantes editables y diferencia contra escenario base | client/src/components/optimized/QuotationVariants.tsx; shared/utils/quotation-variant-preview.ts | Regresión de comparación, horas, recomendación y concurrencia de variantes. |
| COT07 | Datos esenciales, proyección, equipo, inversiones y tarjetas alineadas | client/src/components/optimized/basic-info.tsx; client/src/components/optimized/EnhancedTeamConfig.tsx; client/src/pages/manage-quotes.tsx | Layouts actuales y evidencia visual 1.10.11/1.14; la nueva revisión visual se concentra en Brief/TC. No se declara repetición de todas las capturas históricas. |
| COT08 | Razón social seleccionable y alta sin salir del flujo | client/src/components/optimized/basic-info.tsx: InlineBillingEntity | Regresión V2-13 y alta integrada; selector vacío comunica cómo agregarla. |
| COT09 | Cuatro modalidades y recetas compatibles, sin selección duplicada | shared/quotation-professional.ts; client/src/components/quotation/professional-scope-builder.tsx | Tests remaining: One Shot, Fee, Intelligence Event Track, Demo; Servicio define modalidad/duración. |
| COT10 | Estimación explicada y calibrada con proyectos comparables | shared/quotation-professional.ts; server/routes-proposal-studio.ts | Reglas de esfuerzo, muestras y ajuste acotado; tests V2-11/professional. No se promete aprendizaje sin datos comparables. |
| COT11 | Cobertura, preguntas y SLA explican su impacto | client/src/components/quotation/professional-scope-builder.tsx; shared/utils/quotation-complexity.ts | Reglas/umbrales compartidos, primeras tres preguntas y ajuste operativo; pruebas de cierre 1.10.11. |
| COT12 | Separar output/identidad visual y formato de archivo | shared/quotation-professional.ts; client/src/components/quotation/professional-scope-builder.tsx | Tests de independencia y compatibilidad designLevel; no se cambian precios históricos por migrar etiquetas. |
| COT13 | Objetivo con espacios/enter y listas con coma/espacios | client/src/components/quotation/professional-scope-builder.tsx | Texto local y commit por blur; regresión V2-13 de edición sin truncamiento. |
| COT14 | Entregables cero y cadencia editable | shared/quotation-professional.ts: isDeliverableSold; client/src/components/quotation/professional-scope-builder.tsx | Cero excluye horas/documento/tareas; regresiones de alcance vendido y ciclos. |
| COT15 | Asignar persona a rol sin borrar y rehacer fila | client/src/components/optimized/EnhancedTeamConfig.tsx | Asignación directa y tarifas actuales; tests V2-11 y 27-8. |
| COT16 | Perfiles sugeridos PM/dirección y ajuste por receta | shared/utils/personnel-classification.ts; shared/quotation-professional.ts | Perfil de cada función visible; override por receta, una persona puede cubrir funciones sin perder horas. |
| COT17 | Freelancers directos y tarifa desconocida explícita | client/src/components/optimized/EnhancedTeamConfig.tsx; server/domain/personnel-rate.ts | Se excluyen del promedio estándar, se ofrecen para selección directa; no se inventa tarifa cero como válida. |
| COT18 | Origen de costos reales, sin falsas alertas por falta de horas | shared/utils/quotation-profitability.ts; shared/utils/quotation-margin-drift.ts | Costos de tareas y legacy con deduplicación; cotizado/actual son conceptos distintos; tests de rentabilidad y cierre. |
| COT19 | Desestimar alertas de margen por decisión comercial | client/src/pages/manage-quotes.tsx; shared/utils/quotation-margin-drift.ts | Motivo, reapertura y agravamiento; tests feedback-mind-5-10 y followup-quote-consistency. |
| COT20 | Totales en ARS/USD sin desbordar tarjetas | client/src/pages/manage-quotes.tsx; shared/utils/quotation-portfolio-totals.ts | Conversión por snapshot antes de sumar; regresión y QA visual histórico 1.10.11. |
| COT21 | Grupos PepsiCo, archivadas y costo/precio correctos | client/src/pages/manage-quotes.tsx; server/routes.ts: quotation groups | Tests quotation-group-archive y 5-10; no se vuelve a archivar por nombre ni se alteran precios comerciales. |
| COT22 | Costos adicionales IA/herramientas | client/src/components/optimized/financial-review-final.tsx; shared/utils/quotation-pricing.ts | Monto explícito USD, conversión por snapshot, efecto en margen/precio manual; QA y regresión 23-10. |
| COT23 | Aprobaciones y aceptación fuera de Mind | client/src/components/quotation/commercial-workflow-card.tsx; shared/utils/quotation-external-stage.ts | Fecha/canal/referencia, revisión y versión, idempotencia; tests 23-10 y PostgreSQL credit-compat. |
| COT24 | Cotización aprobada > proyecto > equipo/tareas > horas | server/routes.ts: /api/active-projects; migrations/0090_deliverable_name_compatibility.sql | Regresión PostgreSQL con restricción histórica title NOT NULL y recorridos HTTP de 1.14.9; precios/IA conservados. |

## Proyectos

Regresiones relevantes: `tests/feedback-mind-v2.test.ts; tests/feedback-mind-v2-7.test.ts; tests/feedback-mind-v2-10.test.ts; tests/feedback-mind-v2-13.test.ts; tests/feedback-final-closure.test.ts; tests/asana-module-qa.test.ts`.

| ID | Pedido consolidado | Implementación actual | Evidencia y alcance |
|---|---|---|---|
| PRO01 | Proyectos internos Epical, sin cotización de cliente | client/src/pages/new-project-with-tooltips.tsx; server/routes.ts: /api/active-projects | Alta interna diferenciada y cliente Epical; no exige aprobación comercial ficticia. |
| PRO02 | Activos visibles, filtro canónico y carpetas contraídas | client/src/pages/active-projects-next.tsx; client/src/pages/tasks/projects-hub.tsx | Regresiones V2/V2-7; sin filtro de actividad que esconda un alta nueva. |
| PRO03 | Miembros sólo ven sus proyectos, Ops todos | server/routes.ts; server/routes.ts; client/src/App.tsx | Regresiones 23-10, HTTP del bloque nuevo y lectura productiva anterior de membresías. |
| PRO04 | Cartera financiera separada de gestión operativa | client/src/App.tsx; client/src/pages/tasks/project-tasks-page.tsx | Decisión PRO-12 resuelta por pedidos posteriores: una actividad operativa y enlace desde cartera. |
| PRO05 | Horas/costos reconstruidos y nombres reales de proyectos | server/etl/time-entries-to-fact-labor.ts; server/domain/view-aggregator.ts | Rebuild, períodos anterior/nuevo, costos desconocidos y nombres preferidos; tests V2-7 y project-period-overlay. |
| PRO06 | Horas con decimales y alertas según ingresos/costos aplicables | shared/utils/portfolio-health.ts; server/domain/view-aggregator.ts | No recomienda riesgo de markup para internos sin ingresos; tests 5-10 y portfolio-health. |
| PRO07 | Kanban activo, etapas, bloqueo con motivo/fecha y filtro PM | client/src/pages/tasks/projects-kanban.tsx; server/routes.ts | Etapas separadas del estado financiero, activos y PM/owner; regresión V2-10. |
| PRO08 | Cerrar/archivar quita del Kanban y permite restaurar | server/routes.ts; client/src/pages/active-projects-next.tsx | Bajas recuperables; no se recalculan ni borran finanzas históricas por archivar. |
| PRO09 | Plantillas originales semanal/mensual/one-shot y copia | server/content/asana-project-templates.json; server/services/project-task-templates.ts | Fuentes originales cotejadas, secciones vacías/hitos/orden; regresiones de plantillas. Copia sin horas reales. |
| PRO10 | Miembros y PM al crear, PM vinculado como owner | client/src/pages/new-project-with-tooltips.tsx; server/routes.ts | Validación activa de miembros y PM, apertura del proyecto y vínculo al duplicado; pruebas 1.14.9. |
| PRO11 | Reemplazo inicial por Excel y limpieza del histórico de pruebas | docs/audits/asana-excel-scope-correction-2026-10-02.md; server/routes.ts: archivo recuperable | Pedido de puesta en marcha ya documentado. No se interpreta como orden de borrar toda la cartera productiva de hoy. |

## Tareas, horas y calendario

Regresiones relevantes: `tests/feedback-mind-v2.test.ts; tests/feedback-mind-v2-7.test.ts; tests/feedback-mind-v2-9-domains.test.ts; tests/feedback-mind-v2-13.test.ts; tests/feedback-mind-6-10.test.ts; tests/feedback-mind-9-10.test.ts; tests/task-recurrence.test.ts; tests/hours-feedback.test.ts`.

| ID | Pedido consolidado | Implementación actual | Evidencia y alcance |
|---|---|---|---|
| TAR01 | Sin tareas sueltas; tareas y subtareas mantienen proyecto/sección | server/routes.ts: tareas; shared/schema.ts | Validaciones, herencia de subtarea y ciclo de jerarquía; suites de tareas. |
| TAR02 | Mis tareas incluye asignadas/colaboradas y excluye sólo creadas | server/routes.ts: /api/tasks/my-tasks | HTTP nuevo: tarea con rango aparece al consultar un día intermedio; privacidad preservada. |
| TAR03 | Calendarios personales vs calendario global sólo Ops | server/routes.ts: /api/tasks/team-calendar; client/src/App.tsx | HTTP nuevo: 403 a colaborador; calendario personal toma tareas propias. |
| TAR04 | Fechas visibles, inicio-fin nuevo y edición de rango | client/src/components/tasks/TaskDetailPanel.tsx; client/src/components/tasks/ProjectTaskList.tsx; client/src/pages/tasks/tasks-home.tsx | HTTP nuevo: alta y cambio de ambos extremos; tests rangos/Home, día civil sin corrimiento. |
| TAR05 | Próximas/en curso/retrasadas por fecha; finalizadas de la semana | shared/utils/task-workflow.ts; client/src/pages/tasks/tasks-home.tsx | Pedido posterior sustituye el No apliques de agosto; regresiones con semana Buenos Aires. |
| TAR06 | Finalizar por checklist, bloqueo con motivo en tablero | server/routes.ts: completion; client/src/pages/tasks/project-tasks-page.tsx | No hay dos editores contradictorios; grupo personal conserva fechas y bloqueo es visible. |
| TAR07 | Prioridad inline y detalle sincronizados | client/src/components/tasks/ProjectTaskList.tsx | HTTP nuevo: cambio a urgent vuelve en Mis tareas; regresión de invalidación/rollback. |
| TAR08 | Responsables sólo miembros, asignación durante OOO advierte | server/routes.ts: creación/edición tareas; shared/utils/personnel-classification.ts | Servidor valida membresías, permite guardar con advertencia de ausencia; tests y QA histórico. |
| TAR09 | Un reloj por fila, presets/minutos, manual/cronómetro | client/src/components/tasks/QuickTaskHours.tsx | Regresiones de redondeo al minuto y control único; paneles limitados al viewport. |
| TAR10 | Resumen de cargas, fecha editable y corrección/baja | client/src/components/tasks/QuickTaskHours.tsx; server/routes.ts: task time | HTTP nuevo: 45 min guardados, corregidos a 30 min con otra fecha, mismos datos en detalle. |
| TAR11 | Horas para el responsable; terceros autorizados y privacidad | shared/utils/task-hour-owner.ts; server/routes.ts: task time | HTTP nuevo: Ops atribuye al dueño 70003; otro colaborador recibe 403; costos no se exponen en carga propia. |
| TAR12 | Refresco de fila/Home/Capacidad/cierre después de cargar | client/src/lib/task-cache.ts; server/etl/time-entries-to-fact-labor.ts | Invalidación compartida y reconstrucción; suites de caché, períodos y atribución. |
| TAR13 | Múltiples estimaciones semanales, no por un solo día | server/routes.ts: weekly-estimates; shared/utils/taskEstimates.ts | HTTP nuevo: dos semanas 4+6h conservadas; lunes validado; regresión de solapamiento. |
| TAR14 | Recurrencias conservan todo el rango y no se duplican | shared/utils/task-recurrence.ts; server/routes.ts: completion | Tests lunes-miércoles, semanas/meses/años, sucesor único y reabrir/completar. |
| TAR15 | Selección múltiple y borrado desde lista/teclado | client/src/components/tasks/ProjectTaskList.tsx; server/domain/task-delete.ts | HTTP/navegador 1.14.13 con miembro; árboles con horas o selección entre proyectos: 409 sin borrado parcial. |
| TAR16 | Todos los miembros crean tareas y secciones | server/routes.ts: /api/tasks/section; client/src/components/tasks/ProjectTaskList.tsx | HTTP/navegador 1.14.13; no requiere convertir a miembros en PM/admin. |
| TAR17 | Arrastrar tareas entre secciones y duplicar secciones | client/src/components/tasks/ProjectTaskList.tsx; server/routes.ts: sections | Regresiones 9-10/V2-13; duplicación transaccional, conserva estructura y no copia horas. |
| TAR18 | Una Gestión, un equipo y sin Por sección duplicado | client/src/components/tasks/ProjectOverviewPanel.tsx; client/src/pages/tasks/project-tasks-page.tsx | Contrato V2-9 y UI actual: una vista y miembros reales; métricas financieras redactadas según permiso. |
| TAR19 | Referencia cliente/proyecto e iconos visibles sin hover | client/src/pages/tasks/tasks-home.tsx; client/src/components/tasks/ProjectTaskList.tsx | Regresión 6-10/9-10 y componentes actuales. |
| TAR20 | Calendarios con color por cliente, continuidad y expansión semanal | client/src/components/tasks/TaskCalendarView.tsx; client/src/components/tasks/TaskCalendarView.tsx | Carriles estables, títulos y rangos; expansión completa semanal en ambos calendarios, QA 1.14.5. |
| TAR21 | Cronómetro y popover sin tapar controles ni exigir scroll horizontal | client/src/components/tasks/GlobalTimerWidget.tsx; client/src/components/tasks/QuickTaskHours.tsx | Posición adaptable y ancho limitado; revisado 1.14.4/1.14.5 y regresiones de UI. |

## Inicio y Operaciones

Regresiones relevantes: `tests/feedback-mind-5-10.test.ts; tests/feedback-mind-9-10.test.ts; tests/followup-home-layout.test.ts; tests/hours-feedback.test.ts; tests/feedback-mind-v2-remaining.test.ts`.

| ID | Pedido consolidado | Implementación actual | Evidencia y alcance |
|---|---|---|---|
| HOM01 | Horas semanales/mensuales iguales en Inicio y Tareas | shared/utils/buenos-aires-week.ts; server/routes.ts: /api/tasks/my-hours | Fuentes native/legacy deduplicadas y semana Buenos Aires; regresión V2/6-10. |
| HOM02 | Donut por proyecto, tareas sin horas y KPIs operativos | client/src/pages/tasks/tasks-home.tsx; client/src/pages/home-dashboard.tsx | Donut accesible, valores absolutos/porcentuales y proyectos del módulo operativo. |
| HOM03 | Mi semana con calendario actual, enlace y asignadas opcionales | client/src/pages/home-dashboard.tsx | Calendario personal semanal y Mostrar tareas que asigné opt-in; navegador de esta pasada. |
| HOM04 | Próximos tres cumpleaños, bajas y Sólo cumpleaños | client/src/pages/home-dashboard.tsx; server/routes.ts: birthdays | Regresión 9-10 y fuentes independientes de contratación; sin límite de 30 días. |
| HOM05 | Vacaciones/Epical y cumpleaños alineados | client/src/pages/home-dashboard.tsx | Grid adaptable; regresiones followup-home-layout y 15-10; no se replican datos de terceros. |
| OPS01 | Capacidad semanal, feriados y ausencias sin doble descuento | shared/utils/available-hours.ts; server/routes.ts: capacity/weekly | Regresiones de días hábiles, lunes feriado, persona filtrada y ausencias aprobadas. |
| OPS02 | Capacidad contraíble y estimación junto a tarea | client/src/pages/capacity-dashboard.tsx | Contrato 9-10 y layout actual por proyecto/cliente. |
| OPS03 | Panel de horas suma carga nativa/importada y separa atribución | server/routes.ts: /api/tasks/hours-summary | Regresiones de fuentes/deduplicación y HTTP 1.14.13; consulta propia restringida. |
| OPS04 | Filtro de secciones vigente en Panel y Mis horas | server/routes.ts: hours-summary; client/src/pages/hours-dashboard.tsx | HTTP 1.14.13: intersección activo/accesible/persona/proyecto; no borra historia de Asana. |
| OPS05 | Objetivos ocultos a no Ops y bloque personal simplificado | client/src/App.tsx; client/src/components/layout/sidebar-fixed.tsx | Inicio/Mis ausencias/Mis facturas/Mis horas, guards y MCP; regresión 23-10. |

## Ausencias, Status y cierre

Regresiones relevantes: `tests/feedback-final-closure.test.ts; tests/followup-absence-edit-balance.test.ts; tests/followup-absence-edit-balance.test.ts; tests/status-current-action.integration.test.ts; tests/team-payroll.integration.test.ts; tests/personnel-settlement.test.ts`.

| ID | Pedido consolidado | Implementación actual | Evidencia y alcance |
|---|---|---|---|
| AUS01 | Solicitud propia separada de aprobación/gestión Ops | server/routes.ts: absence-requests; client/src/pages/personnel-absences.tsx | HTTP nuevo: identidad propia, gestión ajena 403, aprobación colaborador 403 y Ops correcta. |
| AUS02 | Día Epical, vacaciones, traslado y adelanto anual | shared/utils/absence-balance.ts; server/routes.ts: absence-allowances | HTTP nuevo: 5+3 trasladados=8, consumo y devolución exactos; tests de deuda/años/feriados. |
| AUS03 | Tentativa/confirmada desde el alta y edición | client/src/pages/personnel-absences.tsx; server/routes.ts: absence-requests | HTTP nuevo: confirmed persistido; editar una aprobada vuelve a pendiente. |
| AUS04 | Cancelación aprobada sigue consumiendo hasta decisión Ops | shared/utils/absence.ts; server/routes.ts | HTTP nuevo: request_cancellation mantiene 2 días, approve_cancellation devuelve saldo. |
| AUS05 | Gantt, filtro persona y desglose de saldos/tipos | client/src/components/tasks/AbsenceTimeline.tsx; client/src/pages/personnel-absences.tsx | Regresión de carriles mensuales/anuales; cupo/usado/disponible/enfermedad/otros separado. |
| AUS06 | Freelancers sin cupo y ausencias visibles para asignación | server/routes.ts; shared/utils/absence-balance.ts | HTTP nuevo: solicitud de 5 días freelance se aprueba sin configurar cupo; allowanceExempt=true. |
| AUS07 | Alertas de solicitud/decisión, historial y concurrencia | server/services/user-notifications.ts; server/routes.ts: absence events | Pruebas de transiciones, claves de eventos y xmin; notificaciones externas apagadas en QA. |
| STA01 | Editar/eliminar comentarios, ítems y salas autorizados | server/routes-review-rooms.ts; client/src/pages/status-semanal.tsx | Regresiones V2-13, status-semanal, edición/archivo, permisos por sala. |
| STA02 | Fechas civiles y botón de fecha alineado | client/src/pages/status-semanal.tsx; server/routes-review-rooms.ts | Normalización civil y layout 1.10.11; no se vuelve a desplazar el deadline por UTC. |
| STA03 | Estado actual único reflejado en Lista y Daily | server/services/status-current-action.ts; client/src/pages/status-semanal.tsx | PostgreSQL: escritura atómica, rollback, concurrencia, permisos; QA 1.14.5. |
| FIN01 | Activo/Pasivo sin inflar importes por separadores o moneda | server/routes-ledger.ts; server/utils/money.ts | Pruebas de parser ES/US y normalización ARS/USD; no se reescriben importes reales como QA. |
| FIN02 | Cierre mensual: corte, fijos por contrato, freelance por horas | server/services/monthly-payroll.ts; server/jobs/team-payroll.ts | PostgreSQL de corte y base contractual; vacaciones/Epical pagas no reducen la remuneración fija. |
| FIN03 | Mis facturas: USD/ARS, TC bancario, bonos y extras | server/services/personnel-settlement-workflow.ts; shared/utils/personnel-settlement.ts; client/src/pages/my-invoices.tsx | Regresiones monetarias y PostgreSQL, revisión de comprobantes y visores privados; QA 1.14.7–1.14.14. |
| FIN04 | Aprobación/devolución y corrección del TC habilitada | client/src/pages/team-settlements.tsx; server/services/personnel-settlement-workflow.ts | Navegador 1.14.13: diálogo con motivo, devolución, motivo visible y reenvío recalculado. |
| FIN05 | Sólo USD y Sin factura explícitos, sin documentos ficticios | shared/utils/settlement-workflow.ts; server/services/personnel-settlement-publication.ts; migrations/0091_payroll_document_modes.sql | USD un tramo; sin factura conserva autorización; mixto exige cobro/TC; Pasivo y pago real siguen en Finanzas. |
| FIN06 | Resumen con horas/base ARS/%/TC/USD y sin USD estimado | client/src/pages/my-invoices.tsx | QA navegador y móvil 1.14.13; base publicada congelada y extras Ops identificados. |
| FIN07 | Facturación anticipada y continuidad hasta revisar comprobante | client/src/pages/team-settlements.tsx; client/src/pages/team-invoice-review.tsx | HTTP/PostgreSQL/navegador 1.14.10–12: motivo/base, horas abiertas, corte conserva factura, acceso al comprobante exacto. |

## Alcance de datos y aceptación

- Los pedidos antiguos de eliminar la cartera/cotizaciones de prueba pertenecen a la puesta en marcha y a la importación de Excel ya registrada. No se ejecuta otra limpieza masiva de producción por releer el PDF acumulado.
- El servicio de Google y las fuentes de Blue/REM son dependencias externas. Esta revisión local verifica parsers, errores, protección de observados y contratos; no ejecuta una sincronización que modifique tarifas productivas. Una tarifa ausente o un REM no publicado no se sustituye por datos ficticios.
- Tarifas y precios comerciales aprobados, membresías productivas, cupos y liquidaciones reales no se modifican durante QA. La transición del Excel maestro y PR313 conservan su alcance separado.
- La matriz registra implementación y evidencia, no garantiza ausencia absoluta de defectos. La aceptación con registros reales del equipo conserva los controles de permisos y no se simula aprobando documentos productivos.

## Validación de la reauditoría

- Roles: fallo real `area: undefined` reproducido por HTTP antes del cambio; después, áreas distintas correctas. PostgreSQL nuevo verifica tarifas vigentes, exclusión de freelance/baja/futuro y ausencia de escrituras al consultar. Claves de filas UI incluyen área. Una regresión adicional reproduce y corrige cero USD histórico: se convierte la tarifa ARS disponible, sin reescribirla.
- Cotizador: render de formularios iniciales individual/grupo comprueba un único control de TC, asociación accesible de etiquetas y snapshot; validación rechaza ausente/cero/negativo/NaN o no confirmado. En navegador, TC vacío bloquea; `1.450,50` se normaliza y USD persiste al avanzar.
- HTTP adicional: 39 comprobaciones de Personal, snapshots salariales ARS/USD, feriados civiles/duplicados, identidad y permisos de ausencias, traslado, confirmación, edición/reaprobación, cancelación con saldo, freelance, rango de tarea, calendario privado, prioridad, múltiples estimaciones, cargas editables y atribución al responsable. Base `feedback_october_28_qa`, sin datos reales.
- Suite completa con PostgreSQL (finanzas, Status y MCP): 1.044 aprobadas, 11 omitidas por condiciones existentes. Chequeo de tipos aprobado. Build, CI y publicación se registran con resultados efectivos en el PR; no se declara un despliegue sólo por terminar las pruebas locales.
- Navegador: Brief → Servicio → Alcance → Equipo → Inversión, edición de tarifas sin rehacer filas, texto con salto de línea, TC inválido bloqueado y borrador guardado con USD, TC 1.450,50, USD 50 adicionales y total 10.249,91. Lectura SQL local confirma los mismos valores persistidos. Brief a 390 px CSS: una entrada TC, viewport y página de 390 px, sin desborde.
