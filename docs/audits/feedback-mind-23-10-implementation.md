# Implementación del feedback de Mind del 23 de octubre

Versiones 1.14.5 y 1.14.6. El [mapa de las once observaciones](feedback-mind-v2-6-plan.md) se implementa sobre `main`, separado del PR 313 de transición financiera. No requiere migraciones ni recalcula datos económicos históricos.

## Resultado por observación

| Punto | Comportamiento implementado | Comprobación |
|---|---|---|
| F01 y F02 | Solo Ops y administración tienen alcance global. PM y analistas necesitan membresía explícita, también por detalle, Kanban, selectores y MCP. Gestionar miembros requiere ser responsable del proyecto; designar o retirar responsables queda en Ops. | HTTP real con Ops, PM, analista y usuario sin vínculo. Proyecto ajeno y asignación sin membresía rechazados. Lector MCP con PostgreSQL. |
| F03 | Horas al responsable o responsable heredado de la subtarea, sin selector de terceros. PM puede registrar al responsable de su proyecto; editar o borrar horas ajenas queda en Ops. | Carga correcta y rechazo de persona manipulada; pruebas de cronómetro y reasignación existentes. |
| F04 | Calendario personal con expansión semanal, tareas completas, rango, proyecto y apertura del detalle. Conserva carriles estables en la vista compacta y el estado de expansión al abrir tareas. | Navegador: expansión de tareas ocultas, apertura del panel y anchos 390/768/1440. |
| F05 | Calendario del equipo exclusivo de Ops en menú, ruta y API. Tareas conserva su calendario personal. | HTTP 403 para no Ops y carga correcta para Ops. |
| F06 | Solo horas y estimaciones propias en resumen, detalle, recordatorios y MCP; se ocultan las cargas ajenas incluso dentro de un proyecto compartido. El panel personal se presenta como Mis horas. | Se manipula personnelId, se consulta una tarea compartida ajena y se verifica que Ops conserva el alcance global. Se cierra también la ruta antigua de otorgamiento global de membresías. |
| F07 | Objetivos solo para Ops y administración. Status conserva sus permisos por sala. | Guard de API, navegación y MCP; las rutas ajenas al router de Objetivos continúan funcionando. |
| F08 | Costos adicionales visible en Inversión, con IA, software y licencias como ejemplos; unidad USD y efecto sobre precio manual y margen explícitos. Usa el campo existente, sin duplicar cargos. | Edición, guardado y reapertura en navegador; conversión y precio manual cubiertos por el motor de pricing. |
| F09 | Selector para registrar etapas realizadas fuera de Mind, incluida aceptación final directa de una cotización histórica. Exige fecha, canal, fundamento y variante cuando corresponde. Conserva revisión, autor, evento y sincronización CRM, sin correo ficticio. Muestra Crear proyecto o Ver proyecto según el vínculo existente. | HTTP y navegador: aceptación externa → proyecto → tarea → horas. Reintentos idempotentes; revisión/versión obsoleta, variante inválida, cliente distinto y proyecto duplicado protegidos. |
| F10 | Lista y Daily comparten Estado actual y una escritura atómica de estado, entrada e historial. Daily lo muestra editable aunque existan comentarios anteriores. Próximo paso permanece como antecedente de lectura. | PostgreSQL: persistencia, sala ajena, limpieza, concurrencia y rollback. Navegador: edición en Daily reflejada en Lista. |
| F11 | Inicio, Mis ausencias, Mis facturas y Mis horas comparten bloque personal; se elimina Mi gestión. Un colaborador task_manager accede a sus importes y comprobantes sin adquirir permiso financiero. | Lectura de facturas, resumen y conciliación propia; descarga privada propia y HTTP 403 para PM u otro colaborador. |

## Validación

- Suite de la versión separada: 979 pruebas aprobadas y 11 omitidas por condiciones existentes, incluyendo PostgreSQL para MCP y Estado actual.
- Chequeo de tipos y build de producción.
- Corrección 1.14.6: el filtro de costos se evalúa al enviar JSON, después de que el guard de autenticación cargue la identidad. Tres pruebas HTTP cubren autenticación tardía, permisos de Ops y facturas propias. API real: resumen de horas propias sin campos de costos/tarifas e importe, moneda y descarga de la factura personal conservados.
- Recorridos reales de API con usuarios y registros sintéticos en base local, sin correos ni integraciones de IA activadas.
- Revisión visual en 390, 768 y 1440 píxeles; menú personal, aceptación externa, alta preseleccionada, calendario expandido y Estado actual. Los calendarios desplazan su contenido dentro de su contenedor en móvil, sin ampliar el ancho de la página.
- Auditoría productiva de solo lectura: cero combinaciones de persona/proyecto con asignaciones activas sin membresía. `scripts/audit-task-memberships.ts` reproduce ese inventario sin otorgar accesos.
- Aplicación del nuevo lector a los perfiles reales de Vanina y Paula en modo de solo lectura: dos y tres proyectos respectivamente y únicamente horas propias. No se alteraron usuarios, membresías ni cotizaciones reales durante estas verificaciones.

## Límites del alcance

El calendario restringido no vuelve privada una tarea dentro de un proyecto compartido: los asuntos sensibles deben estar en proyectos con miembros limitados. Las horas históricas conservan su titular y los próximos pasos anteriores no se eliminan. Los costos adicionales son un importe presupuestado manual, no consumo automático de IA ni un gasto real contabilizado.

La publicación del cierre ampliado y la conciliación financiera del PR 313 siguen su proceso independiente. Esta versión habilita el acceso a las facturas personales existentes.


## Corrección del bloqueo reportado el 27 de octubre — 1.14.8

La captura de Vicky Achabal muestra un rechazo real al registrar una etapa comercial: la validación exige todos los campos de `creditProgram`. La migración 0056 convertía NULL en `{}` en cada arranque; el schema interpretaba ese sentinel histórico como un programa incompleto. El QA anterior creaba cotizaciones después del arranque con NULL, por lo que no cubría el formato resultante de reiniciar. La comprobación productiva de sólo lectura confirmó ocho cotizaciones no archivadas con ese objeto vacío, todas de tipos ordinarios.

El schema acepta sólo el objeto vacío como ausencia de programa. Los objetos no vacíos siguen validados; los tipos `credit-pack` requieren un programa habilitado, completo y con vigencia válida. La migración deja de reescribir NULL y no corrige datos históricos en lote. El validador comercial compartido conserva los controles de FX y pricing.

Validación: 1.021 pruebas aprobadas y 11 omitidas, incluyendo regresiones de PostgreSQL con lectura por Drizzle y migración repetida sin cambios de datos. HTTP real local con el formato `{}` para on-demand, fee-mensual y one-shot: aceptación externa, reintento idempotente y continuidad hasta proyecto, tarea y horas propias. Solicitud interna válida y bolsas reales completas; rechazo de programas activos incompletos o bolsas sin programa. Costos IA, precios y evidencia histórica conservados. Sin aprobar ni editar cotizaciones reales durante las verificaciones.

## Corrección del alta de proyectos reportada el 27 de octubre — 1.14.9

La creación de un proyecto con alcance vendido fallaba al insertar sus entregables. Los logs productivos identificaron un `23502` en `deliverables.title`: el código escribe el campo canónico `name`, pero la base conserva además un `title NOT NULL` antiguo que no aparece en el modelo Drizzle. La transacción revertía el proyecto completo. Los perfiles de ambas Vicky tienen acceso de administración; no se modificaron permisos. Los recorridos anteriores no habían materializado un alcance con entregables contra esa restricción histórica y no probaban este caso.

La migración 0090 mantiene compatibles los escritores de `name` y `title`, conserva los títulos históricos existentes y se instala transaccionalmente antes de servir peticiones. No elimina restricciones ni crea proyectos de clientes. El formulario comunica el error de la API, ofrece abrir el proyecto existente ante un duplicado, utiliza el estado canónico de pausa y abre directamente el proyecto recién creado, evitando que un filtro mensual anterior lo oculte. La selección de PM refleja su membresía automática; la carga del equipo usa autenticación y permite reintentar un fallo.

Validación: 1.025 pruebas aprobadas y 11 omitidas; cuatro regresiones nuevas contra PostgreSQL, incluyendo reproducción del fallo exacto y migración repetida. Chequeo de tipos y build aprobados. En una base aislada con el schema histórico real y registros sintéticos se probó por HTTP el alcance de la variante aceptada (anonimizado): presupuesto y costos adicionales conservados, entregables vendidos, equipo/PM, tareas e hitos y carga de horas propias. También alcance mensual con tres ciclos, plantilla Asana, copia de estructura sin horas copiadas, rollback, duplicados y rechazos por permisos/cliente. En navegador, un perfil equivalente al de quien carga cotizaciones creó el proyecto y llegó a sus nueve tareas; el reintento mostró el vínculo al proyecto existente. Formulario revisado a 390 px sin desborde horizontal. Estas comprobaciones no aprobaron cotizaciones ni crearon proyectos reales en producción.
