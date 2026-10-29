# Feedback acumulado de Mind, julio-octubre de 2026

Fuente recibida el 29 de octubre: `Feedback Mind V2-7.pdf`, 138 páginas, SHA-256 `76586428265786e79e271cfbb21ade3d1a59f2f7d67196d0fa512f2f81c0d810`. Es el documento acumulado, distinto del PDF antiguo de 11 páginas que tiene un nombre similar. Se extrajo el texto de las 138 páginas y se revisaron las capturas del bloque nuevo del 28/10.

## Bloque del 28/10 — implementación 1.14.13

| ID | Página | Pedido | Resultado |
|---|---|---|---|
| T01 | 136 | Todos pueden seleccionar/eliminar tareas, caso Santi | Capacidades de selección/borrado separadas de la administración del proyecto. Cualquier miembro de un proyecto activo puede hacerlo desde lista o detalle. El servidor conserva el alcance por membresía y el rechazo atómico de árboles con horas nativas/importadas. No cambia roles de personas ni permite acceder a proyectos ajenos. |
| T02 | 136 | Todos pueden agregar secciones y tareas | Alta de sección habilitada a miembros, con validación de nombre y duplicados; UI de Nueva sección y Agregar tarea visible. Renombrar/eliminar secciones y gestionar miembros/responsables conserva su autorización existente. |
| H01 | 136-137 | Filtro de secciones sin el traslado histórico de Asana | Opciones obtenidas de proyectos activos y accesibles, intersectadas con persona/proyecto seleccionados. Se conservan entradas y totales históricos; no se borra la importación. |
| C01 | 137 | Pedir corrección habilitado después de cargar TC | El botón abre un diálogo; sólo el envío exige motivo de al menos cinco caracteres. Persisten control de versión, autor, motivo y estados. El titular ve la devolución y puede reenviar el TC. |
| C02 | 137-138 | Agregar USD y Sin factura | Cuatro opciones: ARS, USD, USD+ARS y Sin factura. Este último conserva una moneda de liquidación explícita. USD tiene un único tramo; adicionales ARS se convierten al mismo TC. Sin factura conserva autorización y recibo/TC cuando hay un tramo mixto, omite la carga documental y rechaza intentos de subir una factura. No genera un Pasivo ni un pago por sí mismo: esos registros siguen en Finanzas. El pre-cierre distingue autorizaciones sin factura pendientes. |
| M01 | 138 | Reemplazar USD de referencia por resumen del recorrido | Horas y base ARS de la liquidación publicada, ARS destinados a USD, TC ingresado, total USD y adicionales identificados. Los valores publicados se mantienen aunque luego se carguen más horas operativas. |
| M02 | 138 | Mostrar sobre qué pesos se aplica el TC | Base ARS, porcentaje, TC y bono visibles en el tramo USD; al editar el TC se muestra la conversión y el importe recalculado. Sin estimar dólares con el TC del cierre. |

## Mapa del historial incluido en el PDF

Los textos “PENDIENTE” de rondas anteriores se conservan en el documento fuente aunque haya una implementación posterior. Las referencias siguientes permiten seguir cada grupo sin confundir una marca histórica con una incidencia reproducida hoy. La suite de regresión se ejecuta sobre el conjunto; no se declara una repetición manual de todas las capturas históricas en esta entrega.

| Fecha / páginas | Temas de la ronda | Evidencia de implementación posterior |
|---|---|---|
| 23/7 · 1-15 | Personal/master, cotizaciones, carpetas, proyectos internos, tareas/fechas/horas, miembros, capacidad y feriados | `feedback-mind-v2-implementation.md`, `feedback-mind-v2-final-closure.md`; creación de proyectos revisada nuevamente en 1.14.9. |
| 31/7 · 16-25 | Horas contractuales, historial y roles, ARS/USD, carpetas, tareas personales, carga rápida, semanas y Día Epical | `feedback-mind-v2-7-implementation.md`, `feedback-mind-v2-final-closure.md`; base contractual paga reforzada en 1.14.7. |
| 7/8 · 26-36 | Tabla mensual, clasificación, cotización USD, actividad/costos, gráficos y horas editables, ausencias | `feedback-mind-v2-7-implementation.md`; alcance de ausencias concretado en el cierre posterior y en 1.13.4/1.14.7. |
| 13/8 · 37-45 | Tarifas, moneda/markup/variantes, Kanban, costos, prioridad, Status y ausencias | `feedback-mind-v2-9-code-audit.md`, `feedback-mind-v2-final-closure.md`. |
| 14/8 · 46-52 | Historial/rol, alineación, variantes, Kanban, costos, horas, Status | Mismas auditorías de cotización y cierre V2; motores y componentes compartidos. |
| 18/8 · 53-60 | Promedios por nivel/subnivel, moneda, variantes, salud de proyectos, carga a terceros y cierre | `feedback-mind-v2-closure-1.10.11.md`, `feedback-mind-v2-final-closure.md`; horas por responsable actualizadas en 1.14.4/1.14.5. |
| 20/8 · 61-70 | Roles/áreas, FX/REM, recetas/alcance, validación del equipo y precios, cotizaciones antiguas, calendario y cierre | Auditorías V2/1.10.11; recetas calibrables en 1.13.3; cierre 1.14.7-1.14.12. |
| 27/8 · 71-81 | Promedios sin freelancers, FX 2027, modalidad/recetas, campos de alcance, variantes, refresco de horas y rangos | Auditorías V2 y cierre 1.10.11; mejoras de Tareas y horas en 1.12/1.14.4. |
| 11/9 · 82-91 | Separación de ausencias, FX, esfuerzo/precio, plantillas/PM, Kanban, fechas y Status | `feedback-mind-v2-final-closure.md`; alta con plantillas/PM validada en 1.14.9. |
| 25/9 · 92-105 | Cumpleaños/Home, cupos/traslado/Gantt/OOO, FX, complejidad, cotizaciones/grupos, cartera/plantillas y duplicar secciones | `feedback-mind-v2-final-closure.md`, `feedback-mind-v2-closure-1.10.11.md`; cumpleaños/ausencias refinados en 1.13.4; grupos en 1.14.4. |
| 5/10 · 106-110 | Cumpleaños, Epical, FX, plantillas, alineación/precios/grupos, horas propias y saldos | Auditorías V2; 1.13.4, 1.14.4, 1.14.5 y 1.14.7. |
| 6/10 · 111-118 | Rangos, selección/borrado, color/contexto, fechas de horas, estados, reloj, costos y freelance | `feedback-mind-6-10-implementation.md`; selección/borrado ampliados a miembros en T01 de esta entrega. |
| 9/10 · 119-122 | Arrastrar, contraste, tareas asignadas, capacidad, cumpleaños y saldos/tentativa | Releases 1.13.1, 1.13.4, 1.13.5 y 1.13.6, documentadas en `CHANGELOG.md`. |
| 15/10 · 123-124 | Recurrencias con rango, rango nuevo desde Home y composición de Inicio | Releases 1.14.1, 1.14.2 y 1.14.3. |
| 20/10 · 125-129 | Horas al responsable, cronómetro, expansión semanal, secciones, grupos/aprobaciones y Status | Releases 1.14.4 y 1.14.5; filtro de secciones completado en H01 de esta entrega. |
| 23/10 · 130-135 | Membresías/privacidad, horas propias, calendarios, Objetivos, IA, aceptación externa y Mis facturas | `feedback-mind-23-10-implementation.md`, releases 1.14.5-1.14.12. No se revoca la privacidad para implementar T01/T02. |
| 28/10 · 136-138 | Selección/alta para todos, filtros actuales, corrección del TC, modalidades y resumen | T01-M02 de esta entrega. |

## Límites y datos reales

- Las peticiones antiguas de limpiar proyectos/cotizaciones pertenecen a la puesta en marcha: se documentaron archivos recuperables y la importación autorizada desde Excel. No se ejecuta de nuevo un borrado masivo del entorno actual a partir del historial del PDF.
- Esta entrega no cambia las asignaciones ni roles productivos de Santi u otras personas, ni publica condiciones financieras en su nombre. La autorización operacional se aplica en cada endpoint a la membresía ya existente.
- Sin factura es una condición por persona y mes, guardada dentro del workflow existente, con auditoría y sin agregar campos. La migración 0091 actualiza la vista de pendientes según moneda y obligación documental; se instala transaccionalmente antes de servir solicitudes, sin reescribir datos de negocio. Los cambios no alteran publicaciones ya iniciadas; cambiar condiciones conserva los bloqueos por documentos, importes enviados, versión y cierre financiero.
- La transición del Excel maestro, sus datos de cierre reales y PR313 siguen siendo un trabajo separado. No se declara conciliación ni retiro del maestro por publicar este feedback.

## Verificación de esta entrega

- Base local aislada `feedback_october_28_qa`, esquema restaurado sin datos reales y usuarios sintéticos. Notificaciones externas desactivadas.
- HTTP: miembro crea sección/tarea, obtiene las capacidades correctas, elimina una tarea individual y otra selección; proyecto ajeno/miembros ajenos devuelven 403. Selección que mezcla proyectos o incluye una tarea con horas devuelve 409 sin borrado parcial. Administrar secciones y miembros conserva la restricción anterior.
- Horas: las secciones vigentes aparecen; las del proyecto histórico anulado y las de proyectos ajenos no aparecen para el colaborador; Ops conserva las opciones de sus proyectos activos. Manipular persona en Mis horas devuelve 403.
- Liquidaciones: USD-only, ARS y mixto; requerir factura por defecto; sin factura explícito; validación de moneda/booleano; protección de autor, versión y período. Pruebas PostgreSQL de autorización, tramos y carga documental. Un colaborador no puede desactivar su obligación documental enviando un flag.
- Pre-cierre real en la base sintética: una liquidación autorizada sin factura no agrega facturas esperadas; al reabrirla aparece una autorización pendiente y al autorizar vuelve a pasar el control. No se crea un pasivo ficticio.
- Navegador: perfil miembro con selección Shift y botones de alta; resumen bancario; selector de cuatro modalidades; diálogo de corrección con motivo obligatorio, envío, motivo visible al dueño y reenvío del TC con importe recalculado. Vista móvil sin desbordamiento horizontal: viewport y página de 390 px.
- Validación local final: 1.038 pruebas aprobadas y 11 omitidas por la suite existente; chequeo de tipos, build productivo y diff sin errores. Migración 0091 comprobada con PostgreSQL desde SQL y desde el módulo runtime, con repetición idempotente.
- Evidencias y logs locales: `.context/feedback-v2-7-2026-10-29/`. Pruebas, typecheck, build y publicación se registran con sus resultados efectivos en el PR de la entrega.

## Reauditoría posterior del documento completo

La [matriz consolidada del 29/10](feedback-mind-complete-2026-10-29.md) continúa la revisión de las rondas anteriores. Identifica evidencia por comportamiento y tres brechas detectadas después de 1.14.14 (área/cero USD en promedios, moneda/TC al inicio y modalidad al aplicar una receta). El mapa por fechas de esta página no debe confundirse con una certificación manual de todas las pantallas.
