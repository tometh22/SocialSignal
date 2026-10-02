# Cierre de Feedback Mind V2 — 1.10.3

Fecha: 2026-10-02. Fuentes: ambas rondas PDF, Excel «Proyectos y cotizaciones a pasar», código de main y lectura del Máster «Info Tipo de Cambio y REM».

## Cotejo y cierre

| Pedido | Resultado y evidencia |
| --- | --- |
| Cumpleaños en Personal/Home | Campo propio, próximo cumpleaños y validación de fecha. Se corrige el esquema que descartaba el cumpleaños al guardar. |
| Señales y alineación de Home | Contenedores flexibles, búsqueda acotada y área central adaptable. Verificación visual posterior al despliegue. |
| KPI de proyectos operativos | La misma consulta `/api/tasks/projects` alimenta el listado y su conteo. |
| Rango de tareas y acceso a proyectos | Inicio/fin visibles y navegación a la superficie operativa. |
| Solicitud personal vs gestión | `/absences` personal y `/operations/absences` para Operaciones; gestión, solicitud para terceros y cupos separados. |
| Cupo asociado a otra persona | Consulta/guardado por ID, borrador reiniciado al cambiar persona/año y nombre del titular visible. |
| Solicitudes 2026/2027 y traslado | Cupo anual más traslado; solicitud entre años contabilizada por cada año y feriados. |
| Tentativa/confirmada y edición | Certeza independiente del estado. Nuevas pendientes/tentativas; edición del colaborador requiere reaprobación; Operaciones puede corregir. |
| Gantt/persona | Barras por día civil, anual/mensual, carriles para superposición y filtro de persona. |
| Advertencia OOO | El servidor guarda y devuelve advertencias de responsable y colaboradores; no exige permisos de gestión de ausencias para un proyecto accesible. |
| Tipos de cambio reales/proyectados | Parser del Máster admite prefijos numéricos, abreviaturas y miles. Meses cerrados observados y períodos futuros REM separados, sin sobrescribir reales con estimaciones. No usa datos ficticios como fallback. |
| Sincronización/REM 2027 | Blue diario independiente de REM; errores accionables, filas inválidas y períodos repetidos rechazados. Semilla histórica idempotente sin duplicar estimaciones en cada arranque. |
| Panel Plantillas vs recetas | Se conserva: configuración de reportes y recetas de alcance tienen usos distintos, aclarados en el panel. |
| Formato/identidad visual e impacto | Campos separados, reglas y contribuciones de complejidad visibles; motor canónico de precios compartido. Implementado en 1.10.0. |
| Equipo, horas e inversión | Mismo motor de cálculo/revisión/variantes; contenedores adaptables y aclaración de FX. |
| Freelancers directos | Selección directa; exclusión de promedios estándar y advertencia sin tarifa. Carolina confirmada: 3 Senior · A · Operaciones, sin horas fijas, excluida de costos. |
| Costos cotizados vs reales | Origen separado. 1.10.2 corrige costo contractual, moneda, horas desconocidas y margen real sin información. |
| Gestión/grupos de cotizaciones | Monedas y agrupación por cliente. Cotizaciones perdidas ya no aparecen como borradores para continuar. |
| Cartera desde Excel | Nueve proyectos y 132 tareas importadas, incluidas secciones vacías persistidas sin tareas ficticias. Seis cotizaciones; cinco enlaces de proyectos a cotizaciones, cuatro proyectos internos sin cotización y 24 archivados recuperables. |
| Plantillas de proyectos | Bases semanal/mensual/one-shot y copia de estructura de un proyecto accesible, incluidas secciones y subtareas del Excel. Reinicia fechas, horas y estados; conserva asignación sólo para miembros elegidos. |
| PM/miembros | Selección al crear y validación de personas activas; PM como propietario operativo. |
| Kanban | Sólo activos, filtro PM, bloqueo con motivo/fecha y salida al cerrar. Implementado previamente. |
| Tareas por fechas | Home y Tareas usan la misma regla y día de Buenos Aires: Próximas/En curso/Con retraso/Sin fecha. Finalizadas sólo de la semana vigente. |
| Fechas y calendario | Fechas civiles y rangos persistidos; creación/edición invalidan tareas, calendario y listas relacionadas. |
| Horas por responsable | Responsable como valor inicial para Operaciones; registro de horas existente preservado. |
| Duplicar secciones | Transacción única con jerarquía, permisos y conflicto de nombre; sin copiar horas realizadas. |
| Recurrencias del Excel | Reglas explícitas semanales, quincenales y mensuales; completar genera una sola próxima instancia y sus subtareas. Reabrir/completar no vuelve a duplicar. |
| Status/comentarios/fecha | Edición y eliminación autorizadas; presentación de fechas civiles sin desplazamiento de día. Correcciones existentes preservadas. |
| Cierre del colaborador | Tramos ARS/USD según configuración del cierre (incluido 90% cuando corresponda), FX bancario, diferencia redondeada, aprobación/rechazo y reenvío con historial. |
| Inmutabilidad y concurrencia | Cierre original protegido al existir declaración; aprobadas inmutables; revisiones obsoletas rechazadas; cambios de ausencia protegidos por versión PostgreSQL para no confundir microsegundos con cambios reales. |
| Precios PepsiCo | 325/326 rechazadas por indicación del usuario; precios confirmados conservados. 327 sigue independiente. |

## Validación

- Suite de pruebas, typecheck y compilación de producción locales.
- Base PostgreSQL local independiente: permisos, guardado de cumpleaños, advertencias OOO sin bloquear, concurrencia de recurrencias, jerarquías, plantillas, declaración/rechazo/reenvío/aprobación y conservación del cierre.
- FX en base local: reales y REM separados, protección del observado, rechazo de futuros como observados e importación repetible.
- CI de checkout limpio requerida antes del merge. Luego: versión/commit/health de producción, enlaces/precios/tareas del Excel y captura de pantalla.

## Datos externos y alcance exacto

- La tarifa de Carolina sigue pendiente de que el usuario la informe. No se inventa ni se incluye un costo cero como tarifa acordada.
- Los enlaces originales de Asana no ofrecieron sus listas a la auditoría. Las estructuras reutilizables se toman de los proyectos del Excel y las bases editables; no se certifica igualdad con listas privadas de Asana que no se pudieron leer.
- No se informa ausencia absoluta de bugs: se registran los flujos y datos efectivamente comprobados.
