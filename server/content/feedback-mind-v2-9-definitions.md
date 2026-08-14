---
version: 2.9.3
updatedAt: 2026-08-14
feedbackCount: 70
---

# Definiciones de producto — Feedback Mind V2-9

Este documento es la fuente canónica y versionada de las reglas funcionales cerradas por Feedback Mind V2-9. La aplicación lo distribuye dentro del bundle del servidor y lo expone sólo a usuarios Admin. Todo cambio de una regla requiere modificar este archivo, incrementar su versión y aprobarlo junto con el código.

## Estado final de las 70 entradas

| ID | Estado | Definición final |
|---|---|---|
| CFG-01 | Implementado | Sincronizar los valores del Máster y reflejarlos en Personal y Cotizaciones. |
| CFG-02 | Implementado | “Refrescar Datos” replica realmente los datos del Máster e invalida sus consumidores. |
| CFG-03 | Implementado | Mantener coherentes sueldo, valor hora y horas: valor hora y horas son canónicos y sueldo = valor hora × horas del período, por moneda. |
| CFG-04 | Implementado | Reemplazar el historial entrada-por-entrada por una única tabla mensual comparable y editable. |
| CFG-05 | Implementado | La tabla de costos permite períodos pasados y futuros y se presenta como historial/proyección. |
| CFG-06 | Implementado | Mostrar y sincronizar Rol vigente y Subnivel; para freelancers usar Rol Viejo. |
| CFG-07 | Implementado | Unificar “Valor hora estimada” con Configuración > Personal y retirar la fuente paralela. |
| COT-01 | Implementado | Mantener Proyección de tarifas como selector del wizard. |
| COT-02 | Implementado | Usar tarifas actualizadas del historial y soportar correctamente contratos USD y mixtos. |
| COT-03 | Implementado | Permitir guardar con errores útiles y sin cotizaciones, equipo o variantes parcialmente insertados. |
| COT-04 | Implementado | Gestión ofrece lista y carpetas Cliente > Proyecto, contraídas por defecto. |
| COT-05 | Implementado | Información básica queda centrada dentro del contenedor responsivo común. |
| COT-06 | Implementado | Mes salarial y Proyección de tarifas quedan centrados y alineados. |
| COT-07 | Implementado | La información de cada integrante del equipo queda centrada y alineada. |
| COT-08 | Implementado | KPIs, escenario/moneda y tarjetas de Gestión de cotizaciones comparten alineación consistente. |
| COT-09 | Implementado | Mostrar sólo “Foto del mes seleccionado” y “Promedio anual estimado”. |
| COT-10 | Implementado | Elegir la moneda al comienzo y conservarla durante todo el armado. |
| COT-11 | Implementado | Definir el tipo de cambio editable al comienzo y guardarlo como snapshot. |
| COT-12 | Implementado | Eliminar la segunda selección/ajuste de moneda y TC del final del wizard. |
| COT-13 | Implementado | Cotizaciones USD calculan y muestran USD, aceptan coma decimal y no reutilizan montos ARS como si fueran USD. |
| COT-14 | Implementado | Hacer coincidir exactamente escenarios, comparativa, revisión, resumen y payload mediante un motor único. |
| COT-15 | Implementado | Propagar el markup elegido a variantes, revisión, resumen y persistencia sin estados locales divergentes. |
| COT-16 | Implementado | Una cotización finalizada queda approved, aparece inmediatamente y puede originar un proyecto. |
| PRO-01 | Implementado | Permitir proyectos internos sin cliente/cotización, asociados a Epical. |
| PRO-02 | Implementado | Quitar “Sólo con actividad” sin provocar errores en la cartera. |
| PRO-03 | Implementado | Mostrar inmediatamente los proyectos nuevos activos. |
| PRO-04 | Implementado | Evitar loop o error al navegar a enero. |
| PRO-05 | Implementado | Crear proyectos desde un único lugar: Vista de proyectos. |
| PRO-06 | Implementado | Gestionar el estado sólo en Vista de proyectos; Tareas lo muestra en lectura. |
| PRO-07 | Implementado | Usar jerarquía Cliente > Proyecto, vista lista/carpeta y carpetas cerradas por defecto. |
| PRO-08 | Implementado | Colaboradores ven sólo proyectos activos asignados; Operaciones ve todos con filtro. |
| PRO-09 | Implementado | Separar los destinos por intención: Ops/Admin conservan /active-projects para cartera financiera; /tasks/projects y su detalle son la superficie operativa tipo Asana para todos los usuarios autorizados. |
| PRO-10 | Implementado | Reflejar costo y horas del proyecto después de altas, ediciones y bajas de tiempo. |
| PRO-11 | Implementado | Reflejar la actividad del módulo Tareas dentro del proyecto. |
| PRO-12 | Diferido | Evaluar retirar de Vista de proyectos la actividad propia de Gestión de tareas; no hubo decisión funcional autorizada. |
| TAR-01 | Implementado | Retirar “Tareas que asigné” de la Home. |
| TAR-02 | Implementado | Mostrar las horas propias de la semana y del mes. |
| TAR-03 | Implementado | Impedir tareas raíz sueltas: toda tarea pertenece a un proyecto y una sección. |
| TAR-04 | Implementado | Una tarea asignada aparece en Home, Mis tareas y Calendario. |
| TAR-05 | Implementado | Calendario es de sólo lectura; las tareas se crean dentro del proyecto. |
| TAR-06 | Implementado | Inicio y fin se editan como período y permanecen visibles sin hover. |
| TAR-07 | Implementado | Permitir registrar horas aunque falte costo histórico, con advertencia no bloqueante. |
| TAR-08 | Implementado | Soportar múltiples estimaciones semanales y visualización semanal coherente. |
| TAR-09 | Implementado | Responsables y colaboradores se eligen únicamente entre miembros del proyecto. |
| TAR-10 | Implementado | Mantener un único editor de estado consistente. |
| TAR-11 | Implementado | Retirar rentabilidad de la vista interna de Tareas. |
| TAR-12 | Implementado | Permitir agregar y quitar miembros del proyecto según permisos. |
| TAR-13 | Implementado | Cargar horas desde la fila con presets, ingreso manual y temporizador. |
| TAR-14 | Implementado | Home muestra gráfico mensual por proyecto y lista de tareas sin horas. |
| TAR-15 | Implementado | Mostrar el proyecto en cada fila de tarea. |
| TAR-16 | Diferido | No cambiar todavía la clasificación Próxima/En curso/Vencida; el feedback pidió expresamente no aplicar cambios. |
| TAR-17 | Implementado | Operaciones puede cargar horas para un tercero y toda atribución recae en esa persona. |
| TAR-18 | Implementado | Dejar un solo reloj por tarea y mostrar el resumen de cargas. |
| TAR-19 | Implementado | Permitir editar horas, fecha y descripción de una carga. |
| TAR-20 | Implementado | ProjectOverviewPanel es la única fuente del resumen de Gestión. |
| TAR-21 | Implementado | El gráfico usa márgenes responsivos y etiquetas seguras. |
| TAR-22 | Implementado | Finalizadas de la semana usa completedAt y semana civil de Buenos Aires. |
| TAR-23 | Implementado | Sólo el checklist puede completar o reabrir tareas y subtareas. |
| TAR-24 | Implementado | La prioridad se edita inline con actualización optimista y rollback. |
| TAR-25 | Implementado | Se eliminó la tarjeta duplicada Por sección. |
| TAR-26 | Implementado | Equipo del proyecto usa miembros reales y estadísticas por persona. |
| OPS-01 | Implementado | Panel de horas incluye las cargas realizadas desde Tareas. |
| OPS-02 | Implementado | Capacidad lee estimaciones semanales sin perderlas al cambiar de día. |
| OPS-03 | Implementado | Cierre mensual respeta horas reales y la atribución de cargas a terceros. |
| OPS-04 | Implementado | Agregar “Día Epical” como tipo de ausencia. |
| OPS-05 | Implementado | Evitar corrimiento de fecha en feriados y alertar duplicados. |
| OPS-06 | Implementado | Descontar feriados hábiles en capacidad sin doble descuento con ausencias. |
| OPS-07 | Implementado | Permitir eliminar un status custom con confirmación y compatibilidad histórica. |
| OPS-08 | Implementado | Autoservicio de ausencias: solicitud, aprobación/rechazo, cancelación, alertas, saldos y privacidad por rol. |
| FIN-01 | Implementado | Corregir Activo/Pasivo inflados normalizando parsing y conversión ARS/USD. |

## Las 21 correcciones cerradas

Se consideran parte indivisible de esta versión: CFG-03, CFG-04, COT-05, COT-06, COT-07, COT-08, COT-11, COT-12, COT-13, COT-14, COT-15, COT-16, PRO-09, TAR-20, TAR-21, TAR-22, TAR-23, TAR-24, TAR-25, TAR-26 y OPS-08 (workflow transversal de Ausencias/Notificaciones). El cierre no modifica PRO-12 ni TAR-16.

## Addendum — revisión visual Feedback 14-8

Este addendum registra las diez capturas recibidas el 14 de agosto de 2026. No altera la identidad ni el conteo de las 70 entradas originales; documenta su verificación posterior y separa propuestas nuevas de defectos del alcance aprobado.

| ID | Estado | Definición y resolución |
|---|---|---|
| F14-01 | Implementado | Configuración conserva una sola entrada a la tabla mensual; se retiró el enlace “Ver costos históricos” cuyo administrador legacy ya no existe. |
| F14-02 | Implementado | Rol vigente, Subnivel y Rol viejo se descubren por encabezados desde la tabla independiente de Personal del Máster y se combinan por nombre normalizado con las tarifas. No dependen de que esas columnas estén en “Valor Hora Real y Estimada”. |
| F14-03 | Implementado | Información básica usa un bloque de formulario centrado y el contexto del cliente queda debajo, dentro del mismo ancho canónico. |
| F14-04 | Implementado | Mes salarial y Proyección de tarifas usan contenido, texto y selectores centrados en desktop, tablet y móvil. |
| F14-05 | Implementado | Tarifas y montos USD muestran siempre dos decimales en Equipo, Revisión, Variantes y Gestión; ARS conserva presentación sin centavos. |
| F14-06 | Implementado | Los cuatro KPIs de Revisión comparten alto, centrado y alineación interna. |
| F14-07 | Implementado | Las variantes automáticas permiten ajustar horas por persona, recalculan con el motor canónico y comparan el resultado efectivo contra la cotización base. |
| F14-08 | Implementado | “Seleccionar todo” y “Nueva variante” usan el mismo tamaño de control. |
| F14-09 | Implementado | En Gestión, badges y datos de cotización permanecen en flujo responsivo y no se superponen ni desplazan. |
| F14-10 | Requiere definición | La propuesta de un Kanban global de proyectos con cinco etapas es un producto nuevo: requiere definir si sustituye o complementa cartera, permisos, estados canónicos y reglas de transición. No se agrega dentro de este cierre. |
| F14-11 | Implementado | La cartera financiera incluye proyectos que tengan sólo hechos de labor, usa nombre propio para proyectos sin cotización y publica costo y horas reales tras cada reconstrucción. |
| F14-12 | Diferido existente | Retirar actividad de Tareas de la vista financiera sigue siendo PRO-12; no hay autorización funcional para cambiarlo. |
| F14-13 | Requiere definición | Sustituir el gráfico mensual por un donut es una propuesta de visualización nueva. Se conserva el gráfico actual ya corregido hasta definir qué dimensión representa el porcentaje y cuál es su denominador. |
| F14-14 | Implementado | La pestaña Finalizadas sólo incluye `completedAt` de la semana civil vigente en Buenos Aires. |
| F14-15 | Implementado | Una carga realizada por Operaciones para un tercero guarda `personnelId` del tercero y `createdBy` del operador; panel, capacidad, cierre y cartera agregan por la persona atribuida. |
| F14-16 | Implementado | `done` no está disponible en desplegables ni drag; el checklist y el endpoint de finalización son el único contrato. |
| F14-17 | Implementado | Prioridad se edita inline con `low`, `medium`, `high`, `urgent`, actualización optimista y rollback. |
| F14-18 | Implementado | La tarjeta duplicada “Por sección” fue retirada. |
| F14-19 | Implementado | “Equipo del proyecto” reemplaza “Personas involucradas” y usa miembros reales con estadísticas por persona. |
| F14-20 | Implementado | Un status custom puede eliminarse con confirmación mediante su endpoint dedicado. |
| F14-21 | Implementado | El cierre mensual suma las cargas de Tareas por `personnelId`, incluidas las realizadas por Operaciones para otra persona. |
| F14-22 | Implementado | Ausencias dispone de autoservicio, aprobación/rechazo, cancelación, cupos separados y notificaciones. |
| F14-23 | Implementado | Todo enlace de proyecto originado en Home o Tareas abre `/tasks/projects/:id`; `/active-projects` queda reservado a la intención financiera de Ops/Admin. |

La verificación de datos del Máster requiere credenciales Google válidas en el entorno desplegado. Un fallo de autenticación nunca se presenta como sincronización exitosa y no aplica cambios parciales.

## Costos de Personal

Valor hora es la fuente canónica. Para cada moneda se calcula de forma independiente:

```text
monthlySalaryARS = hourlyRateARS × monthlyHoursSnapshot
monthlySalaryUSD = hourlyRateUSD × monthlyHoursSnapshot
```

- Valor hora y horas mensuales son editables; sueldo es calculado y de sólo lectura.
- Cada costo histórico conserva `monthlyHoursSnapshot`.
- Si una sincronización entrega valor hora y sueldo incompatibles, prevalece valor hora y se registra advertencia.
- Un freelancer sin horas contractuales conserva sueldo mensual vacío; no se inventan horas.
- La migración histórica usa las horas mensuales vigentes como snapshot inicial, registra antes/después por fila y clave de migración, y es idempotente. Filas sin horas válidas quedan omitidas para corrección administrativa.

## Pricing de cotizaciones

`exchangeRateAtQuote` es un snapshot positivo y obligatorio para pricing versión 2, también en cotizaciones ARS. Acepta coma o punto al ingresarse. Las cotizaciones legacy sin snapshot conservan sus totales hasta que una edición confirme el tipo de cambio.

La unidad interna es ARS. Cada costo extranjero se convierte exactamente una vez y el orden es:

1. Equipo.
2. Complejidad.
3. Markup.
4. Herramientas.
5. Plataforma.
6. Desvío.
7. Descuento.
8. Inflación.

El resultado se redondea a dos decimales con una política única. El precio manual se interpreta en `manualPriceCurrency`; los registros legacy se consideran ARS. Cada variante modifica únicamente equipo, horas o configuración y llama al mismo motor. Guardar borrador produce `draft`; Aprobar y finalizar produce `approved` y persiste cotización, equipo, variantes y pricing como una unidad lógica. Sólo cotizaciones aprobadas pueden originar un proyecto.

## Proyectos y tareas

- Operaciones/Admin administra cartera y finanzas en `/active-projects`. La navegación operativa desde Home/Tareas usa `/tasks/projects` y `/tasks/projects/:id` para todos los roles autorizados; el backend limita colaboradores a proyectos activos donde son miembros o responsables y permite a Operaciones/Admin usar el alcance de equipo.
- Creación, edición financiera y cambios de estado requieren Operaciones/Admin en servidor.
- `/tasks/projects/:id` es la superficie operativa tipo Asana para miembros autorizados y para Operaciones/Admin.
- `ProjectOverviewPanel` es el resumen único. Equipo del proyecto se deriva de miembros reales.
- Una tarea se completa únicamente por `POST /api/tasks/:id/completion`. Marcar checklist establece `done` y `completedAt`; desmarcar establece `todo` y limpia `completedAt`.
- La mutación genérica de estado rechaza `done`; el tablero no permite arrastrar hacia ni desde Finalizadas. El mismo contrato aplica a subtareas.
- Finalizadas de la semana incluye sólo `completedAt` entre lunes 00:00 y domingo 23:59:59 de la semana civil vigente en `America/Argentina/Buenos_Aires`.

## Ausencias, saldos y capacidad

Estados válidos: `pending`, `approved`, `rejected`, `cancellation_requested`, `cancelled`.

Transiciones permitidas:

```text
pending -> approved | rejected | cancelled
approved -> cancellation_requested
cancellation_requested -> cancelled | approved
```

- Vacaciones y Día Epical tienen cupos únicos e independientes por persona/año.
- Enfermedad y Otros no consumen cupo, pero afectan capacidad cuando están aprobados.
- Sólo `approved` y `cancellation_requested` descuentan saldo y capacidad.
- Se cuentan lunes a viernes, excluidos feriados configurados. Un rango interanual se reparte por año.
- No puede haber superposición con otra solicitud activa de la misma persona.
- Operaciones no puede aprobar sin saldo. Admin puede hacerlo sólo con override y motivo obligatorio; el evento es auditado.
- La aprobación bloquea los cupos anuales dentro de una transacción para evitar doble gasto concurrente.
- Una pendiente puede ser cancelada por su persona. Una aprobada pasa a solicitud de cancelación y continúa descontando hasta la confirmación.
- Notas: visibles sólo para la persona y Operaciones/Admin. Otros consumidores reciben persona, fechas, tipo e indisponibilidad.
- Cada evento de workflow genera notificaciones persistentes con clave idempotente. Cada usuario sólo puede leer o marcar las propias.

## Migración y compatibilidad

- Las ausencias legacy se importan como `approved`, se calculan sus días hábiles y se registra `legacy_import`.
- Si no existe cupo, la UI informa “Cupo no configurado” y muestra consumo histórico; nunca infiere una asignación.
- Tareas legacy `done` sin `completedAt` usan `updatedAt` como backfill inicial.
- Los endpoints legacy de ausencias conservan lectura acotada. Sus mutaciones directas están deprecadas y no pueden evitar el workflow.
- Las migraciones son aditivas e idempotentes y pueden ejecutarse nuevamente sin duplicar auditorías o eventos.

## API pública vigente

- `GET /api/absence-requests?scope=mine|team&year=YYYY`
- `POST /api/absence-requests`
- `POST /api/absence-requests/:id/actions`
- `GET /api/absence-allowances/:personnelId/:year`
- `PUT /api/absence-allowances/:personnelId/:year`
- `GET /api/notifications`
- `PATCH /api/notifications/:id/read`
- `PATCH /api/notifications/read-all`
- `POST /api/tasks/:id/completion`
- `GET /api/admin/product-definitions` (Admin)

## Casos de aceptación obligatorios

1. Migrar una base vacía y una existente dos veces sin duplicar efectos.
2. Validar costos ARS, USD, mixtos, cambios de horas, freelancers y auditoría antes/después.
3. Obtener igualdad exacta de pricing entre revisión, variantes, comparativa, resumen y persistencia.
4. Impedir huérfanos si falla el guardado de una cotización y mostrar inmediatamente la cotización aprobada al crear proyecto.
5. Verificar accesos y redirecciones para colaborador, Operaciones y Admin.
6. Verificar límites de semana, zona horaria, reapertura y que estado/drag no completen tareas.
7. Probar ausencias con feriados, cruce de año, concurrencia, superposición, saldo, override, privacidad, cancelación y legacy.
8. Probar notificaciones sin duplicados y aisladas por usuario.
9. Rechazar endpoint y página documental a todo usuario no Admin.
10. Validar las superficies visuales a 1440 px, 1024 px y 390 px.

## Decisiones diferidas

PRO-12 y TAR-16 permanecen diferidos. Su implementación exige una definición funcional aprobada en una versión futura de este documento.
