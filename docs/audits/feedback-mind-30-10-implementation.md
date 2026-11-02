# Feedback Mind del 30/10 — implementación

Fecha: 2026-11-02. Complementa la entrega del 28/10 documentada en `feedback-mind-28-10-implementation.md`.

| Pedido | Cambio |
| --- | --- |
| Los mails de ausencias deben llevar a Gestión de ausencias | Solicitudes, reenvíos y cancelaciones dirigidos a Operaciones usan `/operations/absences`. Los avisos personales conservan `/absences`. Aplica a notificaciones nuevas; no reenvía correos ni cambia enlaces de mails ya entregados. |
| Las conciliaciones para revisar deben abrir Operaciones | El circuito anterior abre `/operations/monthly-closing` con el mes declarado. El circuito nuevo conserva los destinos separados para colaborador, Operaciones y Finanzas. |
| El encabezado de tareas se superpone al seleccionar y hacer scroll | La altura real del encabezado se mide con ResizeObserver; la barra de selección queda debajo, en una capa inferior y con contenido que puede ocupar varias líneas. La cabecera usa fondo opaco. |
| Estimar por tarea, sección o proyecto, con ajustes puntuales | Operaciones elige una modalidad compartida por proyecto desde Capacidad. Cada semana y persona tiene su base por proyecto o sección; las tareas marcadas Extra se agregan una sola vez. Los miembros sólo pueden editar sus propias estimaciones en proyectos asignados. Se incluyen proyectos y secciones vacías. |

## Datos y cálculo

- La migración aditiva 0092 mantiene por defecto la estimación por tarea y conserva todas las estimaciones anteriores. Agrega las bases agrupadas y una marca de extra por tarea y semana. Se instala transaccionalmente antes de servir solicitudes y falla el arranque si no puede aplicarse.
- Cambiar la modalidad conserva las bases de las otras modalidades, pero no las cuenta. La modalidad es del proyecto; no es un snapshot semanal. No modifica horas realizadas, costos ni liquidaciones publicadas.
- Capacidad y Panel de horas consultan la misma vista de estimaciones efectivas. El panel conserva la inclusión por solapamiento de semana y los filtros de persona, proyecto, sección y período. Una base de proyecto no se reparte arbitrariamente entre secciones.
- Renombrar una sección conserva su estimación. Eliminarla mueve y suma sus bases a General, igual que las tareas.
- La API valida persona, membresía, modalidad, sección y lunes válido. Cero elimina una base; importes negativos o no finitos se rechazan. La modalidad y los overrides de capacidad requieren Operaciones.
- La tabla nueva queda excluida explícitamente del catálogo MCP hasta tener una política de consulta equivalente a la titularidad de Capacidad. No se amplía el acceso de conectores existentes.

## Validación

- Suite completa: 1.020 pruebas aprobadas y 69 omitidas por sus condiciones de ejecución existentes, usando PostgreSQL local para las nuevas pruebas de Capacidad.
- Ocho pruebas con PostgreSQL cubren idempotencia, cambios de modalidad sin doble conteo, extras, permisos, semanas, proyectos vacíos, conservación al renombrar/fusionar secciones y solapamiento de períodos. Otra prueba comprueba la igualdad entre SQL de migración y módulo runtime.
- Renderizado de los tres modos y el perfil miembro; validación de entrada y destinos de notificaciones.
- TypeScript sin errores y compilación productiva correcta.
- Chrome local con componentes reales, API de prueba y datos sintéticos: selección de dos tareas y scroll a 1024 px sin superposición del encabezado. Evidencia local: `.context/feedback-audit/tasks-scroll-1024.png`. La comprobación interactiva a 390 px quedó interrumpida por la pérdida de la ventana/captura del navegador; no se declara aprobada.

## Publicación 1.14.20

Publicación autorizada por Tomás el 2/11. Workspace Luanda es responsable de la versión, la migración, el orden de integración, el despliegue y la verificación de producción. VERSION, package.json, package-lock.json y CHANGELOG se actualizan juntos.

La validación descrita arriba corresponde al trabajo previo a publicar, sin notificaciones externas ni cambios de datos productivos. El merge requiere CI desde checkout limpio. Después se verifica el despliegue automático de Railway por SHA exacto, la migración 0092, salud, recursos publicados y acceso sin autenticar. El resultado efectivo de CI y despliegue se registra en el PR.
