# Implementación del feedback de Mind del 23 de octubre

Versión 1.14.5. El [mapa de las once observaciones](feedback-mind-v2-6-plan.md) se implementa sobre `main`, separado del PR 313 de transición financiera. No requiere migraciones ni recalcula datos económicos históricos.

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

- Suite de la versión separada: 976 pruebas aprobadas y 11 omitidas por condiciones existentes, incluyendo PostgreSQL para MCP y Estado actual.
- Chequeo de tipos y build de producción.
- Recorridos reales de API con usuarios y registros sintéticos en base local, sin correos ni integraciones de IA activadas.
- Revisión visual en 390, 768 y 1440 píxeles; menú personal, aceptación externa, alta preseleccionada, calendario expandido y Estado actual. Los calendarios desplazan su contenido dentro de su contenedor en móvil, sin ampliar el ancho de la página.
- Auditoría productiva de solo lectura: cero combinaciones de persona/proyecto con asignaciones activas sin membresía. `scripts/audit-task-memberships.ts` reproduce ese inventario sin otorgar accesos.
- Aplicación del nuevo lector a los perfiles reales de Vanina y Paula en modo de solo lectura: dos y tres proyectos respectivamente y únicamente horas propias. No se alteraron usuarios, membresías ni cotizaciones reales durante estas verificaciones.

## Límites del alcance

El calendario restringido no vuelve privada una tarea dentro de un proyecto compartido: los asuntos sensibles deben estar en proyectos con miembros limitados. Las horas históricas conservan su titular y los próximos pasos anteriores no se eliminan. Los costos adicionales son un importe presupuestado manual, no consumo automático de IA ni un gasto real contabilizado.

La publicación del cierre ampliado y la conciliación financiera del PR 313 siguen su proceso independiente. Esta versión habilita el acceso a las facturas personales existentes.
