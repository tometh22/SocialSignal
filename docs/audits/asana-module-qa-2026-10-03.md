# Auditoría de Mind V2 y QA del módulo de tareas — 1.10.13

Fecha: 3 de octubre de 2026. Cotejo de las 24 páginas originales contra frontend, backend, contratos de API y pruebas. Se conservan las 67 observaciones: 66 funcionales/visuales y una remisión a otro punto.

## Resultado y alcance

- Las funcionalidades de los feedbacks tienen implementación conectada entre frontend y backend. Las ocho brechas cerradas en 1.10.11 conservan sus pruebas y compatibilidad. Este cotejo no equipara existencia de código con ausencia de bugs.
- La QA del módulo operativo reprodujo 19 comprobaciones fallidas en 65 casos iniciales. Se corrigieron y se amplió la cobertura con escenarios de jerarquía, concurrencia, permisos, fechas, horas, plantillas y cierre.
- Las pruebas mutables se ejecutaron exclusivamente en PostgreSQL local, con usuarios y proyectos sintéticos. Producción se consulta en modo de lectura para verificar despliegue e integridad del Excel.
- No se importan proyectos históricos de Asana, no se recalculan precios comerciales existentes y no se borran físicamente datos productivos. No requiere migración SQL.

## Errores corregidos

| Área | Error reproducido / riesgo confirmado | Corrección |
|---|---|---|
| Permisos | El resumen personal incluía estimaciones de otros colaboradores y proyectos privados. | Estimaciones y capacidad personal con el mismo alcance que las horas reales. |
| Horas | El detalle redondeaba un minuto a quince; el timer perdía precisión. | Parser común y precisión de un minuto en carga, edición y timer. |
| Totales | Se sumaban acumulados de padres y sus descendientes, duplicando horas. | Total de proyecto desde el libro de cargas y totales de sección sin duplicar nodos. |
| Calendario | Último día del rango excluido; fechas antiguas podían desplazarse; una fecha única se repetía en otros días. | Rango inclusivo, fechas civiles y un solo día para tareas con un único extremo. |
| Fechas | Días imposibles y rangos invertidos podían normalizarse/aceptarse. | Validación civil común en creación, edición, filtros, cargas y planificación semanal. |
| Semana | El domingo se atribuía al lunes siguiente. | Agrupación en la semana del lunes precedente. |
| Resumen | Proyectos y colaboradores homónimos se combinaban en tablas. | Identidad por ID en agregados y matriz del frontend. |
| Jerarquía | Mover un padre o reordenarlo dejaba las subtareas en otra sección. | Propagación a todos los niveles dentro de una transacción. |
| Concurrencia | Dos cambios podían crear un ciclo o invalidar un rango. | Bloqueo por proyecto y validación de la versión actual dentro de la transacción. |
| Duplicación | Copia desde frontend parcial, de un nivel y con riesgo de carga real heredada. | Endpoint atómico para toda la jerarquía; conserva planificación y limpia horas reales/estado. |
| Búsqueda | Un resultado de subtarea tenía conteo pero no se mostraba sin sus padres. | Ancestros conservados, expansión al filtrar y representación recursiva de niveles profundos. |
| Miembros y PM | Roles ofrecidos por frontend rechazados por backend; PM sin gestión/filtro correcto. | Contrato común de seis roles y gestión/filtro para owner o pm. |
| Miembros | Quitar a una persona asignada dejaba tareas que luego no se podían editar. | Respuesta 409 con instrucción de reasignar antes de quitar. |
| Actualización | Cambios no refrescaban todas las vistas; cerrar/anular podía dejar tarjeta en Kanban. | Invalidación por predicado de todas las consultas relacionadas y cierre de cartera. |
| Progreso | Canceladas contaban como completadas. | Conteo explícito de done en listado y detalle, usado por frontend. |
| Temporizador | Carga rápida perdía reloj al cambiar de vista y no sincronizaba con widget global. | Estado persistido común, notificación en la pestaña y entre pestañas; no reemplaza otro reloj activo. |
| Cierre | Las cargas de Tareas no aplicaban la protección de cierre de las cargas legacy. | Mismo middleware para crear, editar y eliminar horas; conserva excepción administrativa existente. |
| Errores de UI | Respuestas 403/500 podían tratarse como datos y ocultar el error. | Queries que rechazan errores, reintento visible y avisos de fallo en movimientos. |
| Comentarios | Papelera ofrecida sobre comentarios que el usuario no podía borrar; datos inválidos daban 500. | Capacidad de borrado entregada por backend y validación de contenido. |
| Primera tarea | Agregar tarea en un proyecto vacío o desde Tablero no abría el formulario. | Alta inline en el estado vacío y cambio a Lista desde el botón. |
| Controles por rol | Se ofrecían gestión de secciones y borrado de tarea a miembros sin permiso. | Capacidades del backend condicionan esos controles. |

## Cotejo punto por punto

### Documento 25-9

| Página | Área / punto | Pedido | Estado | Evidencia frontend | Evidencia backend |
|---|---|---|---|---|---|
| 1 | Home · 1 | Cumpleaños en Personal y Home; bajas automáticas | Implementado en código | client/src/pages/home-dashboard.tsx:49 | server/routes.ts:4543 |
| 1 | Home · 2 | Alinear Señales del portfolio | Verificado en pantalla | client/src/pages/home-dashboard.tsx:355 | server/routes.ts:9243 |
| 1 | Home · 3 | KPI con proyectos operativos, no cartera financiera | Implementado en código | client/src/pages/home-dashboard.tsx:41 | server/routes.ts:24714 |
| 1 | Home · 4 | Tareas en curso: ver ajuste posterior | Referencia | client/src/pages/home-dashboard.tsx:194 | shared/utils/task-date-bucket.ts:7 |
| 1 | Home · 5 | Mostrar rango de inicio y fin de tareas | Implementado en código | client/src/pages/home-dashboard.tsx:456 | server/routes.ts:24140 |
| 1 | Home · 6 | Abrir proyectos en la vista operativa tipo Asana | Implementado en código | client/src/pages/home-dashboard.tsx:497 | server/routes.ts:24883 |
| 2 | Ausencias · 1 | Traslado del año anterior y total de vacaciones en Home | Implementado en código | client/src/pages/home-dashboard.tsx:258 | server/routes.ts:26809 |
| 2 | Ausencias · 2 | Cupo de Aylu aparece en otra persona | Implementado en código | client/src/pages/personnel-absences.tsx:76 | server/routes.ts:26833 |
| 2 | Ausencias · 3 | Operaciones registra solicitudes para terceros en 2026 y 2027 | Implementado en código | client/src/pages/personnel-absences.tsx:170 | server/routes.ts:26605 |
| 2 | Ausencias · 4 | Tentativa/confirmada y edición por colaborador/Operaciones | Implementado en código | client/src/pages/personnel-absences.tsx:135 | server/routes.ts:26656 |
| 2 | Ausencias · 5 | Gantt de ausencias y filtro por persona | Implementado en código | client/src/pages/personnel-absences.tsx:201 | server/routes.ts:26580 |
| 3 | Ausencias · 6 | Separar Mis ausencias y Gestión de ausencias | Implementado en código | client/src/App.tsx:353 | server/routes.ts:26558 |
| 3 | Ausencias · 7 | Advertir al asignar tareas durante OOO sin impedir guardar | Implementado en código | client/src/lib/queryClient.ts:242 | server/routes.ts:23968 |
| 3 | Tipos de cambio · 1 | Falla de sincronización con datos de 2027 | Implementado en código | client/src/components/admin/ExchangeRateManager.tsx:169 | server/services/fxSync.ts:230 |
| 3 | Tipos de cambio · 2 | Enero-julio/agosto deben ser reales al cerrar | Implementado en código | client/src/components/admin/ExchangeRateManager.tsx:278 | server/services/fxSync.ts:154 |
| 3 | Plantillas · Sin número | Revisar utilidad de Plantillas frente a recetas | Implementado en código | client/src/pages/admin-fixed.tsx:1384 | server/routes.ts:5257 |
| 4 | Nueva cotización · 1 | Explicar por qué cobertura/preguntas modifica horas | Cerrado y verificado | client/src/components/quotation/professional-scope-builder.tsx:378 | shared/quotation-professional.ts:187 |
| 5 | Nueva cotización · 2 | Separar tipo de output de diseño/identidad | Cerrado y verificado | client/src/components/quotation/professional-scope-builder.tsx:383 | shared/quotation-professional.ts:60 |
| 5 | Nueva cotización · 3 | Centrar información de Equipo | Verificado en pantalla | client/src/components/optimized/EnhancedTeamConfig.tsx:471 | server/routes.ts:4328 |
| 5 | Nueva cotización · 4 | Alinear Equipo, Complejidad y Multiplicador en Inversión | Verificado en pantalla | client/src/components/optimized/financial-review-final.tsx:285 | shared/utils/quotation-pricing.ts:68 |
| 6 | Nueva cotización · 5 | Incluir personas freelance faltantes | Implementado en código | client/src/components/optimized/EnhancedTeamConfig.tsx:341 | server/routes.ts:4328 |
| 6 | Nueva cotización · 6 | Definir y editar factores de complejidad | Cerrado y verificado | client/src/components/optimized/complexity-factors-card.tsx:77 | shared/quotation-professional.ts:198 |
| 7 | Nueva cotización · 7 | Precio recomendado igual al resumen de la derecha | Cerrado y verificado | client/src/components/quotation/quotation-workspace-summary.tsx:23 | client/src/components/optimized/QuotationVariants.tsx:477 |
| 7 | Gestión de cotizaciones · 1 | Valor total entra en tarjeta y aparece en USD y ARS | Cerrado y verificado | client/src/pages/manage-quotes.tsx:567 | client/src/components/ui/metric-card.tsx:83 |
| 7 | Gestión de cotizaciones · 2 | Alinear información de cotizaciones | Verificado en pantalla | client/src/pages/manage-quotes.tsx:785 | server/routes.ts:6277 |
| 8 | Gestión de cotizaciones · 3 | Precio de venta aparece igual al costo | Implementado en código | client/src/pages/manage-quotes.tsx:914 | shared/utils/quotation-pricing.ts:68 |
| 8 | Gestión de cotizaciones · 4 | + costos no se refleja en Proyectos y origen de costos | Cerrado y verificado | client/src/pages/quotation-detail.tsx:866 | server/routes.ts:8443 |
| 8 | Gestión de cotizaciones · 5 | Grupo PepsiCo no aparece como cotizaciones individuales | Implementado en código | client/src/pages/manage-quotes.tsx:716 | server/routes.ts:5766 |
| 9 | Cartera de proyectos · 1 | Eliminar cartera previa y reemplazar por Excel | Implementado en código | client/src/pages/portfolio-import.tsx:147 | server/routes.ts:11323 |
| 9 | Cartera de proyectos · 2 | Plantillas originales semanal/mensual y one-shot | Implementado en código | client/src/pages/new-project-with-tooltips.tsx:253 | server/services/project-task-templates.ts:8 |
| 9 | Cartera de proyectos · 3 | Elegir miembros/PM al crear y vincular filtro Kanban | Implementado en código | client/src/pages/new-project-with-tooltips.tsx:278 | server/routes.ts:11472 |
| 10 | Tareas Home · 1a | Finalizadas sólo de la semana | Implementado en código | client/src/pages/tasks/tasks-home.tsx:436 | shared/utils/task-date-bucket.ts:20 |
| 11 | Tareas Home · 1b | Editar inicio y fin sin conservar inicio original | Implementado en código | client/src/pages/tasks/tasks-home.tsx:179 | server/routes.ts:24140 |
| 11 | Tareas Home · Comentario | Próximas/En curso según fechas, con retraso | Implementado en código | client/src/pages/tasks/tasks-home.tsx:13 | shared/utils/task-date-bucket.ts:7 |
| 11 | Tareas Proyectos · 1 | Cargar horas para responsable sin selección extra | Implementado en código | client/src/components/tasks/QuickTaskHours.tsx:79 | server/routes.ts:24340 |
| 12 | Tareas Proyectos · 2 | Duplicar secciones para reportes FEE | Implementado en código | client/src/components/tasks/ProjectTaskList.tsx:917 | server/routes.ts:23452 |
| 12 | Status · 1 | Editar y eliminar comentarios | Implementado en código | client/src/pages/status-semanal.tsx:2348 | server/routes-review-rooms.ts:1128 |
| 12 | Status · 2 | Fecha 21-9 aparece 20-9 | Implementado en código | client/src/pages/status-semanal.tsx:1244 | server/routes-review-rooms.ts:992 |
| 13 | Status · 3 | Botón/fecha desalineado al Agregar ítem | Cerrado y verificado | client/src/pages/status-semanal.tsx:1769 | server/routes-review-rooms.ts:992 |
| 13-14 | Cierre mensual · Sin número | Vista colaborador, 90% USD, FX banco, diferencia y aprobación Ops | Implementado en código | client/src/pages/my-invoices.tsx:181 | server/routes.ts:26253 |
### Documento 11-9

| Página | Área / punto | Pedido | Estado | Evidencia frontend | Evidencia backend |
|---|---|---|---|---|---|
| 1 | Ausencias · 1 | Solicitante personal y aprobación/gestión en Operaciones | Implementado en código | client/src/pages/personnel-absences.tsx:45 | server/routes.ts:26558 |
| 1 | Roles · 1 | Promedios incluyen part/full time; excluyen freelancers como Mari | Implementado en código | client/src/pages/admin-fixed.tsx:1012 | server/routes.ts:4328 |
| 1 | Tipos de cambio · 1 | Sincronización falla con 2027 | Implementado en código | client/src/components/admin/ExchangeRateManager.tsx:169 | server/services/fxSync.ts:230 |
| 2 | Tipos de cambio · 2 | Real/proyectado de meses cerrados | Implementado en código | client/src/components/admin/ExchangeRateManager.tsx:278 | server/services/fxSync.ts:154 |
| 2 | Nueva cotización · 1 | Explicar impacto cobertura/preguntas en esfuerzo | Cerrado y verificado | client/src/components/quotation/professional-scope-builder.tsx:387 | shared/quotation-professional.ts:187 |
| 3 | Nueva cotización · 2 | Entender Ajuste operativo -10,5% y cada KPI | Cerrado y verificado | client/src/components/quotation/professional-scope-builder.tsx:420 | shared/quotation-professional.ts:200 |
| 3 | Nueva cotización · 3 | Alinear Equipo | Verificado en pantalla | client/src/components/optimized/EnhancedTeamConfig.tsx:471 | server/routes.ts:4328 |
| 4 | Nueva cotización · 4 | Calcular horas/costo al iniciar y modificar horas | Implementado en código | client/src/components/optimized/EnhancedTeamConfig.tsx:332 | client/src/context/optimized-quote-context.tsx:620 |
| 4 | Nueva cotización · 5 | Equipo no permite avanzar | Implementado en código | client/src/pages/optimized-quote.tsx:236 | client/src/utils/quotation-ux.ts:64 |
| 4-5 | Nueva cotización · 6 | Editar variantes y que cambien sus precios | Implementado en código | client/src/components/optimized/QuotationVariants.tsx:885 | shared/utils/quotation-pricing.ts:68 |
| 5 | Gestión de cotizaciones · 1 | Alinear información | Verificado en pantalla | client/src/pages/manage-quotes.tsx:785 | server/routes.ts:6277 |
| 6 | Gestión de cotizaciones · 2 | Precio de venta igual al costo en resumen | Implementado en código | client/src/pages/manage-quotes.tsx:914 | shared/utils/quotation-pricing.ts:68 |
| 6 | Gestión de cotizaciones · 3 | + costos no se refleja en proyecto | Cerrado y verificado | client/src/pages/quotation-detail.tsx:866 | server/routes.ts:8443 |
| 6 | Cartera de proyectos · 1 | Opción de eliminar proyectos | Implementado en código | client/src/pages/active-projects-next.tsx:626 | server/routes.ts:11939 |
| 6 | Cartera de proyectos · 2 | Plantillas semanal/mensual y one-shot | Implementado en código | client/src/pages/new-project-with-tooltips.tsx:253 | server/services/project-task-templates.ts:8 |
| 7 | Kanban · 1 | Mostrar sólo activos | Implementado en código | client/src/pages/tasks/projects-kanban.tsx:42 | server/routes.ts:24714 |
| 7 | Kanban · 2 | Bloqueo con motivo y fecha | Implementado en código | client/src/pages/tasks/projects-kanban.tsx:161 | server/routes.ts:24976 |
| 7 | Kanban · 3 | PM puede acceder y filtrar sus proyectos | Implementado en código | client/src/pages/tasks/projects-kanban.tsx:59 | server/routes.ts:24992 |
| 7 | Kanban · 4 | Desaparece al cerrar desde Cartera | Implementado en código | client/src/pages/tasks/projects-kanban.tsx:42 | server/routes.ts:24714 |
| 7 | Tareas Home · 3a | Finalizadas de la semana | Implementado en código | client/src/pages/tasks/tasks-home.tsx:13 | shared/utils/task-date-bucket.ts:20 |
| 8 | Tareas Home · 3b rango | Modificar inicio y fin | Implementado en código | client/src/pages/tasks/tasks-home.tsx:179 | server/routes.ts:24140 |
| 8 | Tareas Home · 3b estado | Modificar estado en esta visualización | Implementado en código | client/src/pages/tasks/tasks-home.tsx:267 | server/routes.ts:24140 |
| 8 | Tareas Home · 3b clasificación | Próximas/En curso por fechas; movidas no desaparecen | Implementado en código | client/src/pages/tasks/tasks-home.tsx:13 | shared/utils/task-date-bucket.ts:7 |
| 8 | Tareas Proyectos · Sin número | Carga rápida por responsable | Implementado en código | client/src/components/tasks/QuickTaskHours.tsx:79 | server/routes.ts:24340 |
| 9 | Calendario · Sin número | Tarea creada no aparece | Implementado en código | client/src/components/tasks/ProjectTaskList.tsx:1346 | server/routes.ts:23242 |
| 9 | Status · Sin número | Editar comentarios | Implementado en código | client/src/pages/status-semanal.tsx:2348 | server/routes-review-rooms.ts:1149 |
| 10 | Cierre mensual · Sin número | Vista propia, 90% USD, FX banco, diferencia y aprobación Ops | Implementado en código | client/src/pages/my-invoices.tsx:181 | server/routes.ts:26253 |

## Verificación

- Suite automatizada: **759 aprobadas y 11 omitidas por condiciones preexistentes**. Typecheck y build de producción aprobados. Incluye 59 regresiones nuevas y las pruebas existentes de todos los feedbacks.
- API local: **115 comprobaciones aprobadas**, con archivo de resultados por caso; creación con ambas plantillas originales, PM/miembros, OOO sin bloqueo, calendario, permisos, comentarios, estimaciones, horas, duplicación y cierre/reapertura.
- QA visual: lista y búsqueda de tercer nivel, edición de un minuto, duplicación desde móvil, calendario de proyecto, timer global al cambiar de vista, Kanban, filtro de PM, calendario del equipo y primera tarea de un proyecto vacío; anchos normal y 390 px.
- Integridad productiva: 9 proyectos, 6 cotizaciones, precios y vínculos del Excel. Las cotizaciones 342 y 343 no se vinculan a un proyecto inventado. Sin tareas históricas de Asana en proyectos activos.

## Límites y datos externos

- La tarifa de Carolina Moreno sigue pendiente del dato del usuario; conserva condición freelance sin horas fijas y costos desconocidos. No se inventa una tarifa.
- El flujo de cupo por persona/año y el tratamiento Blue/REM están implementados y cubiertos por código/pruebas; esta auditoría no reconstruye el dato histórico de Aylu ni la respuesta externa exacta del error FX original.
- Las seis observaciones visuales comerciales/Status conservan la comprobación de 1.10.11; esta ronda concentra la QA visual nueva en el módulo operativo.
- No se hicieron pruebas de carga masiva ni un pentest. Los recorridos y regresiones descritos pasaron; eso no garantiza ausencia absoluta de errores.

## Hallazgos de la verificación productiva

- Se corrigió la etiqueta semanal que interpretaba la fecha civil en UTC y podía mostrar domingo en Argentina. Las fechas de las entradas también usan el parser civil.
- Las entradas ahora muestran minutos/horas legibles (19m, 1h 9m), sin decimales de coma flotante ni etiquetas de 60 minutos.
- La matriz incluye todos los proyectos del período mediante desplazamiento horizontal; anteriormente sólo mostraba cinco aunque el total incluía los restantes.
- 1.10.12 fue desplegada y verificada en Railway; estas correcciones de presentación se publican como 1.10.13, conservando los datos productivos.
