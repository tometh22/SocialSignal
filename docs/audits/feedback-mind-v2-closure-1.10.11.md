# Cierre de feedback Mind V2 — 1.10.11

Documentos originales: Feedback Mind V2-2 (25-9, 14 páginas) y Feedback Mind V2 (11-9, 10 páginas). Se conservan las 67 observaciones de la auditoría original, incluidas repeticiones y una remisión a Tareas.

## Resultado

- Las ocho brechas funcionales identificadas (10 observaciones repetidas) tienen implementación y pruebas.
- Las seis observaciones visuales fueron comprobadas: Portfolio, Equipo, Inversión y Gestión; se corrigieron el marcador/alineación de Portfolio y el desborde de controles de Equipo en anchos intermedios.
- Las otras 50 observaciones conservan su implementación cotejada en la auditoría original; una observación es una referencia a otro punto.
- Verificación: suite completa (700 pruebas aprobadas, 11 omitidas por condiciones existentes), typecheck, build, 15 comprobaciones de API con PostgreSQL local y revisión visual 390/1024/1440 px.
- No se requiere migración SQL: los campos nuevos viven en snapshots JSON y se resuelven de forma compatible. No se recalculan precios comerciales guardados en lote.
- Datos productivos: verificación de lectura antes y después del despliegue de los 9 proyectos y 6 cotizaciones del Excel, vínculos e importes; sin tareas fuente de Asana activas añadidas.
- Carolina Moreno conserva la clasificación provisional y condición freelance; su tarifa sigue pendiente del dato del usuario. El producto conserva el costo desconocido sin inventarlo.

## Cierre de las brechas

- **G1**: Criterios y umbrales compartidos visibles por factor, incluido el tratamiento uniforme de las primeras 3 preguntas y +5% por adicional. Fórmula multiplicativa y redondeo explicados.
- **G2**: outputLevel y visualIdentity separados en snapshot/brief/UI. Lectura compatible de designLevel sin alterar factores históricos; formato del archivo editable independientemente sin cambiar horas por sí solo.
- **G3**: Fórmula y significado del signo visibles. Distingue esfuerzo por SLA, calibración histórica y ajuste del equipo; porcentaje negativo no equivale a descuento comercial.
- **G4**: Volumen editable en Alcance; Inversión permite volver a editar los factores. Recalcula el equipo sugerido sin un segundo cargo por complejidad de receta.
- **G5**: Resumen consume el escenario efectivo, con nombre, horas y precio iguales a la tabla; selector explícito para múltiples alternativas. Edición de horas comprobada en navegador; asignación de roles compartida preserva todas las funciones.
- **G6**: Totales ARS y USD calculados por cotización con su snapshot de FX, luego FX legacy y actual. Conversión faltante explícita; layout verificado en escritorio y móvil.
- **G7**: Endpoint integra time_entries y task_time_entries de todos los proyectos válidos del contrato. Deduplica espejos uno a uno y excluye proyectos anulados/cancelados. Costos sin tarifa permanecen desconocidos; 15 comprobaciones reales de API.
- **G8**: Responsable en fila propia; semáforo y fecha en grid adaptable y popover limitado al viewport. Nombre largo y fecha comprobados en 390 y 1440 px, sin desborde.

## Cotejo punto por punto

### Documento 25-9

| Página | Área / punto | Pedido | Cierre | Evidencia |
|---|---|---|---|---|
| 1 | Home · 1 | Cumpleaños en Personal y Home; bajas automáticas | Implementado en código | Personal permite editar y validar cumpleaños. Home muestra el propio. API excluye personas con baja e impide exponer cumpleaños de terceros a colaboradores. |
| 1 | Home · 2 | Alinear Señales del portfolio | Verificado en pantalla | Revisión visual en escritorio y móvil: alineación y controles visibles. Portfolio y Equipo incluyen corrección específica de layout. |
| 1 | Home · 3 | KPI con proyectos operativos, no cartera financiera | Implementado en código | KPI y listado consultan /api/tasks/projects con status=active y scope=mine. |
| 1 | Home · 4 | Tareas en curso: ver ajuste posterior | Referencia | Remisión a la clasificación por fechas de Tareas. Se coteja allí; no es una funcionalidad adicional. |
| 1 | Home · 5 | Mostrar rango de inicio y fin de tareas | Implementado en código | Home presenta ambos extremos con fechas civiles. Creación/edición persiste startDate y dueDate y valida su orden. |
| 1 | Home · 6 | Abrir proyectos en la vista operativa tipo Asana | Implementado en código | Los enlaces del listado apuntan a /tasks/projects/:id, con API de detalle y permisos de proyecto. |
| 2 | Ausencias · 1 | Traslado del año anterior y total de vacaciones en Home | Implementado en código | Cupo y saldo incluyen vacationCarryoverDays; Home muestra año actual, traslado, usados y disponible. |
| 2 | Ausencias · 2 | Cupo de Aylu aparece en otra persona | Implementado en código | Consulta y PUT están vinculados al personnelId y año seleccionados; formulario reinicia el borrador al cambiar titular/año. Esto corrige el flujo, sin certificar retrospectivamente el registro de la captura. |
| 2 | Ausencias · 3 | Operaciones registra solicitudes para terceros en 2026 y 2027 | Implementado en código | Gestión ofrece selector de persona; servidor autoriza únicamente a Operaciones a cambiar el titular. Fechas y saldos no están limitados a 2027. |
| 2 | Ausencias · 4 | Tentativa/confirmada y edición por colaborador/Operaciones | Implementado en código | planningStatus separado del workflow. Nuevas solicitudes pendientes/tentativas. Colaborador que modifica una aprobada requiere nueva aprobación; Operaciones conserva facultad de corrección. Hay eventos y control concurrente. |
| 2 | Ausencias · 5 | Gantt de ausencias y filtro por persona | Implementado en código | Gestión filtra persona y muestra AbsenceTimeline con barras mensuales/anuales y superposiciones. |
| 3 | Ausencias · 6 | Separar Mis ausencias y Gestión de ausencias | Implementado en código | Rutas /absences y /operations/absences separadas; la segunda requiere operations. API restringe scope=team. |
| 3 | Ausencias · 7 | Advertir al asignar tareas durante OOO sin impedir guardar | Implementado en código | POST/PUT de tareas guarda y devuelve assignmentWarnings para responsable/colaboradores. Cliente muestra aviso; si falla disponibilidad mantiene guardado. Requiere fechas de tarea para detectar solapamiento. |
| 3 | Tipos de cambio · 1 | Falla de sincronización con datos de 2027 | Implementado en código | Blue del día separado de importación futura REM. UI explica usos y muestra error accionable. Parser Máster admite períodos futuros. No se reprodujo la llamada externa fallida de la captura en esta auditoría. |
| 3 | Tipos de cambio · 2 | Enero-julio/agosto deben ser reales al cerrar | Implementado en código | Dato observado retira proyección de igual período; importador REM no sobreescribe observado ni admite mes cerrado. No convierte una estimación en real sin evidencia observada. |
| 3 | Plantillas · Sin número | Revisar utilidad de Plantillas frente a recetas | Implementado en código | Se conserva panel de plantillas de reportes con explicación y CRUD propio, distinto del catálogo de servicios/recetas. No se elimina un uso vigente. |
| 4 | Nueva cotización · 1 | Explicar por qué cobertura/preguntas modifica horas | Cerrado y verificado | Criterios y umbrales compartidos visibles por factor, incluido el tratamiento uniforme de las primeras 3 preguntas y +5% por adicional. Fórmula multiplicativa y redondeo explicados. |
| 5 | Nueva cotización · 2 | Separar tipo de output de diseño/identidad | Cerrado y verificado | outputLevel y visualIdentity separados en snapshot/brief/UI. Lectura compatible de designLevel sin alterar factores históricos; formato del archivo editable independientemente sin cambiar horas por sí solo. |
| 5 | Nueva cotización · 3 | Centrar información de Equipo | Verificado en pantalla | Revisión visual en escritorio y móvil: alineación y controles visibles. Portfolio y Equipo incluyen corrección específica de layout. |
| 5 | Nueva cotización · 4 | Alinear Equipo, Complejidad y Multiplicador en Inversión | Verificado en pantalla | Revisión visual en escritorio y móvil: alineación y controles visibles. Portfolio y Equipo incluyen corrección específica de layout. |
| 6 | Nueva cotización · 5 | Incluir personas freelance faltantes | Implementado en código | Lista de asignación directa incluye freelancers, con etiqueta y advertencia cuando falta tarifa. Candidatos/promedios de rol estándar los excluyen. |
| 6 | Nueva cotización · 6 | Definir y editar factores de complejidad | Cerrado y verificado | Volumen editable en Alcance; Inversión permite volver a editar los factores. Recalcula el equipo sugerido sin un segundo cargo por complejidad de receta. |
| 7 | Nueva cotización · 7 | Precio recomendado igual al resumen de la derecha | Cerrado y verificado | Resumen consume el escenario efectivo, con nombre, horas y precio iguales a la tabla; selector explícito para múltiples alternativas. Edición de horas comprobada en navegador; asignación de roles compartida preserva todas las funciones. |
| 7 | Gestión de cotizaciones · 1 | Valor total entra en tarjeta y aparece en USD y ARS | Cerrado y verificado | Totales ARS y USD calculados por cotización con su snapshot de FX, luego FX legacy y actual. Conversión faltante explícita; layout verificado en escritorio y móvil. |
| 7 | Gestión de cotizaciones · 2 | Alinear información de cotizaciones | Verificado en pantalla | Revisión visual en escritorio y móvil: alineación y controles visibles. Portfolio y Equipo incluyen corrección específica de layout. |
| 8 | Gestión de cotizaciones · 3 | Precio de venta aparece igual al costo | Implementado en código | Precio y costo se leen por separado y cálculo usa motor compartido. Igualdad puede ser precio manual válido; no se deben cambiar contratos confirmados por el usuario. El código no certifica todos los registros históricos. |
| 8 | Gestión de cotizaciones · 4 | + costos no se refleja en Proyectos y origen de costos | Cerrado y verificado | Endpoint integra time_entries y task_time_entries de todos los proyectos válidos del contrato. Deduplica espejos uno a uno y excluye proyectos anulados/cancelados. Costos sin tarifa permanecen desconocidos; 15 comprobaciones reales de API. |
| 8 | Gestión de cotizaciones · 5 | Grupo PepsiCo no aparece como cotizaciones individuales | Implementado en código | Vista de grupos conserva sus propuestas vinculadas y navegación; no equivale a una cotización individual ni obliga a tratar propuestas como borradores. Estado comercial se conserva. |
| 9 | Cartera de proyectos · 1 | Eliminar cartera previa y reemplazar por Excel | Implementado en código | Importador tiene vista previa, mapeo y reemplazo reversible. Verificación productiva previa de esta sesión: 9 proyectos Excel, 6 cotizaciones y vínculos explícitos, sin tareas fuente Asana activas. No se reimportó ni modificó datos durante esta auditoría. |
| 9 | Cartera de proyectos · 2 | Plantillas originales semanal/mensual y one-shot | Implementado en código | Catálogo integrado al alta y copias transaccionales. Fuente original cotejada conserva 22 tareas/5 secciones y 15 tareas/3 secciones, incluidos 3 hitos. Fechas, responsables y horas no se copian indiscriminadamente. |
| 9 | Cartera de proyectos · 3 | Elegir miembros/PM al crear y vincular filtro Kanban | Implementado en código | Alta manda memberIds/projectManagerId; valida personas activas, agrega PM como owner. Kanban filtra por owner. |
| 10 | Tareas Home · 1a | Finalizadas sólo de la semana | Implementado en código | Home y Tareas usan completedAt y semana civil Buenos Aires, no todas las tareas done. |
| 11 | Tareas Home · 1b | Editar inicio y fin sin conservar inicio original | Implementado en código | Selector de rango con ambos extremos. Mutación escribe startDate/dueDate; detalle permite reiniciar rango y backend valida orden. |
| 11 | Tareas Home · Comentario | Próximas/En curso según fechas, con retraso | Implementado en código | Regla compartida: futuro por inicio, vencida por fin pasado, activa por rango vigente; agrega Sin fecha. La decisión histórica de diferir esto quedó reemplazada por el pedido posterior. |
| 11 | Tareas Proyectos · 1 | Cargar horas para responsable sin selección extra | Implementado en código | Carga rápida inicializa persona con assigneeId para Operaciones; backend permite atribución a tercero autorizado. Colaborador conserva restricciones de carga propia. |
| 12 | Tareas Proyectos · 2 | Duplicar secciones para reportes FEE | Implementado en código | UI Duplicar sección; API transaccional copia estructura/jerarquía y conserva únicamente asignaciones a miembros, sin horas realizadas. |
| 12 | Status · 1 | Editar y eliminar comentarios | Implementado en código | Controles de edición/borrado conectados; rutas legacy resuelven a reviews, con permiso de miembro y autorización por autor/rol. |
| 12 | Status · 2 | Fecha 21-9 aparece 20-9 | Implementado en código | Deadline se codifica como día civil al mediodía y se presenta desde componentes año/mes/día; evita desfase UTC en nuevas altas y ediciones. No se auditó cada deadline histórico. |
| 13 | Status · 3 | Botón/fecha desalineado al Agregar ítem | Cerrado y verificado | Responsable en fila propia; semáforo y fecha en grid adaptable y popover limitado al viewport. Nombre largo y fecha comprobados en 390 y 1440 px, sin desborde. |
| 13-14 | Cierre mensual · Sin número | Vista colaborador, 90% USD, FX banco, diferencia y aprobación Ops | Implementado en código | Mis facturas contiene conciliación; se usa proporción del cierre (90% cuando configurada), calcula diferencia, permite envío/reenvío y aprobación/rechazo Ops con historial, versiones y cierre original protegido. |

### Documento 11-9

| Página | Área / punto | Pedido | Cierre | Evidencia |
|---|---|---|---|---|
| 1 | Ausencias · 1 | Solicitante personal y aprobación/gestión en Operaciones | Implementado en código | Mismo flujo separado y permisos cotejados en 25-9 Ausencias 6. |
| 1 | Roles · 1 | Promedios incluyen part/full time; excluyen freelancers como Mari | Implementado en código | Promedios SQL y asignación estándar excluyen contract_type=freelance y bajas; directo freelance permanece disponible. |
| 1 | Tipos de cambio · 1 | Sincronización falla con 2027 | Implementado en código | Blue diario y REM futuro separados; explicación/error accionable. Se verificó contrato y parser, no disponibilidad externa de esa llamada fallida. |
| 2 | Tipos de cambio · 2 | Real/proyectado de meses cerrados | Implementado en código | Observados retiran estimaciones; futuros se importan REM. No inventa observado al cerrar calendario. |
| 2 | Nueva cotización · 1 | Explicar impacto cobertura/preguntas en esfuerzo | Cerrado y verificado | Criterios y umbrales compartidos visibles por factor, incluido el tratamiento uniforme de las primeras 3 preguntas y +5% por adicional. Fórmula multiplicativa y redondeo explicados. |
| 3 | Nueva cotización · 2 | Entender Ajuste operativo -10,5% y cada KPI | Cerrado y verificado | Fórmula y significado del signo visibles. Distingue esfuerzo por SLA, calibración histórica y ajuste del equipo; porcentaje negativo no equivale a descuento comercial. |
| 3 | Nueva cotización · 3 | Alinear Equipo | Verificado en pantalla | Revisión visual en escritorio y móvil: alineación y controles visibles. Portfolio y Equipo incluyen corrección específica de layout. |
| 4 | Nueva cotización · 4 | Calcular horas/costo al iniciar y modificar horas | Implementado en código | Total horas deriva de miembros; cambio recalcula costo y resultado compartido. Tarifas canónicas por período/moneda. |
| 4 | Nueva cotización · 5 | Equipo no permite avanzar | Implementado en código | Validación informa tarifas/factores faltantes y contexto recalcula. Una tarifa realmente ausente sigue siendo bloqueo intencional; no se certifica el registro original de la captura. |
| 4-5 | Nueva cotización · 6 | Editar variantes y que cambien sus precios | Implementado en código | Ver/ajustar equipo por variante editable; total calcula horas efectivas con motor compartido y guarda equipo por variante. En modo precio manual, mismo precio puede ser intencional; el resumen lateral distinto se mantiene como G5. |
| 5 | Gestión de cotizaciones · 1 | Alinear información | Verificado en pantalla | Revisión visual en escritorio y móvil: alineación y controles visibles. Portfolio y Equipo incluyen corrección específica de layout. |
| 6 | Gestión de cotizaciones · 2 | Precio de venta igual al costo en resumen | Implementado en código | Campos y cálculo separados; no presupone que todo contrato con igualdad sea erróneo, según confirmación del usuario. |
| 6 | Gestión de cotizaciones · 3 | + costos no se refleja en proyecto | Cerrado y verificado | Endpoint integra time_entries y task_time_entries de todos los proyectos válidos del contrato. Deduplica espejos uno a uno y excluye proyectos anulados/cancelados. Costos sin tarifa permanecen desconocidos; 15 comprobaciones reales de API. |
| 6 | Cartera de proyectos · 1 | Opción de eliminar proyectos | Implementado en código | Anular con confirmación y filtro de anulados, preserva historial. Reemplazo Excel también es reversible. |
| 6 | Cartera de proyectos · 2 | Plantillas semanal/mensual y one-shot | Implementado en código | Mismas plantillas originales cotejadas de 25-9 Cartera 2, integradas en alta. |
| 7 | Kanban · 1 | Mostrar sólo activos | Implementado en código | Consulta con status=active; backend aplica alcance y status, excluye archivados. |
| 7 | Kanban · 2 | Bloqueo con motivo y fecha | Implementado en código | Estado bloqueado, motivo editable y fecha de bloqueo persistidos; al salir limpia motivo/fecha. |
| 7 | Kanban · 3 | PM puede acceder y filtrar sus proyectos | Implementado en código | API comprueba pertenencia; filtro de encargado usa miembro owner. PM seleccionado al alta se guarda como owner. |
| 7 | Kanban · 4 | Desaparece al cerrar desde Cartera | Implementado en código | Fuente misma active_projects; consulta active lo excluye tras cierre. |
| 7 | Tareas Home · 3a | Finalizadas de la semana | Implementado en código | completedAt y semana Buenos Aires. |
| 8 | Tareas Home · 3b rango | Modificar inicio y fin | Implementado en código | Selector range y persistencia ambos extremos; fechas civiles. |
| 8 | Tareas Home · 3b estado | Modificar estado en esta visualización | Implementado en código | Fila HomeTaskRow incluye selector todo/in_progress/blocked; completar/reabrir por checklist. |
| 8 | Tareas Home · 3b clasificación | Próximas/En curso por fechas; movidas no desaparecen | Implementado en código | Clasificación compartida y visible grupo Sin fecha; no depende de estado guardado salvo terminadas/canceladas. |
| 8 | Tareas Proyectos · Sin número | Carga rápida por responsable | Implementado en código | Operaciones preselecciona responsable, backend valida y atribuye a persona autorizada. |
| 9 | Calendario · Sin número | Tarea creada no aparece | Implementado en código | Creación/edición invalidan team-calendar y my-tasks. Servidor incluye asignadas/colaborador y propias sin asignar, filtra permisos/proyecto y rango. Tarea sin fechas sigue Sin fecha y no ocupa un día inventado. |
| 9 | Status · Sin número | Editar comentarios | Implementado en código | UI y PATCH con permisos del autor y sala; compatibilidad legacy. |
| 10 | Cierre mensual · Sin número | Vista propia, 90% USD, FX banco, diferencia y aprobación Ops | Implementado en código | Mismo flujo completo descrito en 25-9 Cierre; snapshot, diferencia redondeada, revisión y eventos. |

