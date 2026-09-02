---
version: 2.22.0
updatedAt: 2026-09-02
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
## Addendum — Feedback Mind V2-13 (ronda 27-8)

Las rondas 23-7 a 20-8 quedaron cerradas en las versiones 2.9.x a 2.11.x. Esta versión
resuelve la ronda del 27 de agosto de 2026, que no había sido procesada. No altera la
identidad ni el conteo de las 70 entradas originales.

| ID | Estado | Definición y resolución |
|---|---|---|
| F27-01 | Implementado | Personal expone una sola taxonomía. Nivel, Subnivel y Área son la clasificación canónica; `personnel.role_id` se deriva del nivel en el servidor y deja de pedirse en el formulario. La resolución reutiliza la fila ya asignada cuando sigue representando el mismo nivel, después un rol homónimo, después cualquier rol legacy equivalente, y sólo entonces materializa el nivel. |
| F27-02 | Implementado | El promedio de tarifa por Rol + Subnivel excluye a los freelancers. Su valor hora está por encima de la escala fija y desplazaba el promedio del nivel. |
| F27-03 | Implementado | "Proyectado" significa siempre "mes que todavía no terminó". Los valores del Máster se registran como observados, retiran la estimación REM del mismo período y toman `end_of_month` cuando el mes ya cerró. Una importación REM no puede crear estimaciones de meses cerrados y cada sincronización retira las proyecciones vencidas que ya tienen dato observado. |
| F27-04 | Implementado | Los campos de lista de Alcance (Mercados, Marcas, Competidores, Fuentes) y Objetivos se editan como texto libre y se parsean al salir del campo. Parsear en cada tecla borraba la coma, el espacio final y el Enter en el mismo keystroke. |
| F27-05 | Implementado | La cantidad de un entregable admite cero: un entregable previsto por la receta que este cliente no contrata deja de aportar horas sin reescribir la receta. La cadencia es editable. |
| F27-06 | Implementado | Al asignar una persona a un puesto, los candidatos se ordenan por afinidad con el nivel del rol cotizado y se muestran agrupados. No se filtra en duro para no dejar sin candidatos a un puesto sin perfiles de ese nivel. |
| F27-07 | Requiere definición | "Account Director" no existe en la escala vigente: son Leads. Unificar el catálogo de roles de receta con los cinco niveles canónicos requiere decisión funcional. |
| F27-08 | Implementado | Una tarea de la Home abre su proyecto en `/tasks/projects/:id`. Sin proyecto asociado degrada a texto plano en vez de a un enlace muerto. |
| F27-09 | Implementado | Las cargas se corrigen y se eliminan desde el reloj de la fila, sin entrar a la tarea. |
| F27-10 | Implementado | La prioridad editada en la fila invalida también el detalle de la tarea. El panel lee `["/api/tasks", id]` con `staleTime` infinito y `"/api/tasks/project"` no es prefijo suyo. |
| F27-11 | Implementado | Las horas cargadas desde la fila invalidan la lista del proyecto, que es la fuente de `loggedHours` de esa misma fila. |
| F27-12 | Implementado | La carga rápida atribuye por defecto al responsable de la tarea: lo que rige es el dueño, no quien carga. |
| F27-13 | Implementado | La duración admite minutos reales (`45m`, `1h30`, `1:30`, `2,5`) con un mínimo de un minuto, y se redondea al minuto en vez de al cuarto de hora. La razón social puede crearse desde el propio cotizador. |

Las decisiones diferidas PRO-12, TAR-16, F14-10 y F14-13 no se modifican. F14-10 (Kanban de
proyectos) se implementó en 2.10.0 con las cinco etapas y sin exponer importes.

### Revisión 2.13.1 — cruce de la auditoría contra el código desplegado

Re-auditar lo implementado contra `main` encontró tres resoluciones incompletas
de la propia versión 2.13.0. Se corrigen acá.

| ID | Estado | Corrección |
|---|---|---|
| F27-05a | Implementado | `isDeliverableSold` es el predicado único de alcance vendido: incluido **y** con unidades. Antes la cantidad en cero quitaba horas y tareas pero el entregable seguía apareciendo en la propuesta que ve el cliente y en los conteos de "N entregables". |
| F27-06a | Implementado | El cruce de candidatos puntúa nivel **y** área. Los roles del catálogo mezclan seniority ("Lead PM") con función ("Data Scientist", "Project Manager", "Content Specialist"): cruzar sólo por seniority no ordenaba nada para la mitad de ellos. El nivel pesa el doble que el área porque es lo que define la tarifa. |
| F27-09a | Implementado | El reloj de la fila sólo ofrece corregir o eliminar cargas que el usuario puede modificar. El servidor ya rechazaba la carga ajena con 403; la UI ofrecía la acción igual. |

### Revisión 2.14.0 — pedidos de la ronda que no se habían mapeado

Un repaso completo del documento original encontró un pedido operativo que se
repitió el 18-8, el 20-8 y el 27-8 y nunca se atendió, más tres preguntas de
producto que quedaron sin devolver.

| ID | Estado | Definición y resolución |
|---|---|---|
| GEN-01 | Implementado | Limpieza de datos de prueba reversible, disponible en producción. Las cotizaciones se archivan (`archivedAt`, con `POST /api/quotations/:id/restore` ya existente) y los proyectos pasan a `voided`, que la cartera ya trata como inactivo. Nada se elimina físicamente. El patrón de nombres sólo sugiere candidatos: archivar exige los ids que una persona eligió de la vista previa. Sólo Admin. Reemplaza a `test-data-reset`, que borraba físicamente y estaba bloqueado justamente en producción, que es donde se prueba el ciclo. |
| GEN-02 | Requiere definición | Unificar Modalidad de servicio con las recetas y reducir el catálogo a One Shot, Fee, Intelligence Event Track y Demo (con Regional como parte de un Fee). El filtrado de recetas por modalidad ya está; la simplificación del catálogo es una decisión de producto. |
| GEN-03 | Requiere definición | Si el tipo de análisis y el compromiso del cliente deben seguir siendo puntos de ajuste de costo, y en qué paso del cotizador corresponden. |
| GEN-04 | Requiere definición | Si conviene mantener el módulo de Inflación. La serie ya se sincroniza sola por IPC, así que dejó de desactualizarse; la pregunta de fondo sigue abierta. |

### Revisión 2.15.0 — roles del cotizador alineados con la escala de Personal

Decisión tomada con Vicky Achabal: *"Tiene que quedar 04 Lead A o 04 Lead B o 03
Senior A, etc. — reflejar la lógica de Roles, para que todo sea consistente. Y
account director no debería aparecer porque no tenemos ese rol. Si ponemos 04
Lead, deberían aparecerme opciones que en Roles tengan esa categorización."*

| ID | Estado | Definición y resolución |
|---|---|---|
| GEN-05 | Implementado | El catálogo de roles del cotizador es la escala de Personal. Un rol canónico guarda nivel, subnivel y área en columnas propias (no se deduce del nombre) y se muestra como "04 Lead A · Operaciones". El área forma parte del rol porque, sin ella, un 04 Lead A de Operaciones y uno de DataTech serían indistinguibles y las recetas no podrían repartir horas por función. La migración materializa sólo las clasificaciones que existen en Personal, no las ~44 combinaciones teóricas. |
| GEN-06 | Implementado | Los roles sin clasificación canónica —"Account Director" entre ellos— se retiran con `is_active = FALSE` en vez de borrarse: dejan de ofrecerse en cotizaciones nuevas y las históricas los siguen resolviendo por id. |
| GEN-07 | Implementado | Al asignar una persona a un puesto sólo se ofrecen quienes coinciden en las dimensiones que el rol define. Un rol que no fija subnivel o área no restringe por esa dimensión. Cuando nadie coincide, la UI lo dice y ofrece ver el resto: filtrar en duro no puede dejar un puesto sin poder completarse. |
| GEN-08 | Requiere validación | `BLUEPRINT_ROLE_PROFILES` traduce cada función de receta (director, pm, analyst, data, tech, design) a un área y un nivel típico. Las áreas se derivan de la función; los niveles son un punto de partida editable y no una regla de negocio aprobada. Al aplicar una receta el equipo queda propuesto y se ajusta a mano. |

El catálogo de productos de seis modalidades (GEN-02) sigue pendiente: "Créditos"
y "Fee + créditos" son modelos comerciales nuevos y necesitan definición antes de
poder cotizarse.

### Revisión 2.16.0 — bloqueo simétrico y candidatos reales de limpieza

Dos correcciones a la limpieza de datos de prueba (GEN-01), tras verificar el
impacto de anular un proyecto contra financiero, capacidad y tareas.

| ID | Estado | Definición y resolución |
|---|---|---|
| GEN-09 | Implementado | Archivar un proyecto por Limpieza bloquea cargas nuevas igual que el botón oficial de "Anular proyecto" (`isFinished`, `closedAt`, `closedBy`). Antes sólo cambiaba `status`: el proyecto desaparecía de la vista pero seguía técnicamente abierto a cargas si alguien conservaba el link. |
| GEN-10 | Implementado | `POST /api/admin/cleanup/restore-project` reactiva un proyecto anulado, simétrico al restore de cotizaciones que ya existía. La pestaña Limpieza muestra los últimos 20 anulados con un botón de restaurar. |
| GEN-11 | Implementado | Los candidatos a proyecto ya no se filtran por nombre de prueba: el feedback original ("borrar el histórico de proyectos") no daba ese criterio, a diferencia de cotizaciones ("pruebas, viejas o caducadas"), y filtrar por nombre dejaba afuera exactamente el histórico real que se pedía sacar. Ahora se listan todos los proyectos no terminales con última actividad y horas cargadas, ordenados por candidato más probable (prueba por nombre → sin horas → sin actividad hace más de 6 meses → con actividad reciente); el admin sigue eligiendo uno por uno. |

Verificado: anular un proyecto no altera ningún número financiero histórico.
`financial-aggregator.ts` y `view-aggregator.ts` calculan por fecha desde las
tablas de hechos (`fact_labor_month`, `income_sot`), no desde
`active_projects.status`. Sí deja de contar en "proyectos activos" y saca sus
tareas de "Mis tareas" de un colaborador (comportamiento esperado).

### Revisión 2.17.0 — visibilidad y recuperación de cotizaciones archivadas

Motivada por un reporte de "desaparecieron cotizaciones históricas". Se
investigó el impacto y se confirmó que archivar nunca borra físicamente
(`archivedAt`), pero la app no tenía ninguna pantalla para ver qué estaba
archivado ni recuperarlo sin conocer el id de memoria — un problema
preexistente a la Limpieza, que ya podía archivar por dos caminos: el tacho
individual en Gestión de Cotizaciones (anterior a esta versión) y la Limpieza
de Admin.

| ID | Estado | Definición y resolución |
|---|---|---|
| GEN-12 | Implementado | `GET /api/quotations/archived` lista las cotizaciones archivadas con nombre de cliente, monto y fecha de archivado, con el mismo permiso que ya usan las demás rutas de Gestión de Cotizaciones (no exige Admin). "Ver archivadas" en la cabecera de Gestión de Cotizaciones y una card equivalente en la pestaña Limpieza reutilizan el mismo listado, con restaurar por fila. |
| GEN-13 | Implementado | La ruta se registra antes de `GET /api/quotations/:id`: Express matchea por orden de registro y `:id` habría interceptado `archived` como si fuera un id, dejando el endpoint nuevo inalcanzable. Lo detectó la red de seguridad de `tests/express-route-order.test.ts`, que ahora también cubre esta ruta. |

### Revisión 2.18.0 — un rol de receta no se duplica al caer por fallback

Reporte de Victoria Puricelli probando el cotizador: *"repite lead de leads
más de una vez, y es la misma persona... es normal?"*. No lo era.

| ID | Estado | Definición y resolución |
|---|---|---|
| GEN-14 | Implementado | Al aplicar una receta, cada función (`director`, `pm`, `analyst`, `data`, `tech`, `design`) se resolvía a un rol canónico por separado y generaba su propia fila. Cuando dos funciones distintas caían por fallback en el mismo rol canónico —porque esa área no tiene el nivel exacto que pide `BLUEPRINT_ROLE_PROFILES`—, el resultado eran dos filas idénticas, duplicando el rol y la persona ya asignada. Ahora se agrupa por `role.id` antes de construir el equipo y las horas de funciones que colisionan se suman en una sola fila. |

El segundo síntoma reportado en la misma sesión ("todos los valores hora están
en cero") no se tocó: no está relacionado con el catálogo de roles. Apunta a
`quotationExchangeRate` sin confirmar — `requiresExchangeRateConfirmation` se
activa en cotizaciones con `pricingVersion < 2`, y mientras esté activo el
snapshot de tipo de cambio no se hidrata solo. `resolveQuotationPersonnelRate`
devuelve 0 para cualquier persona cuando el tipo de cambio de la cotización no
es positivo, sin importar la tarifa real de esa persona. Confirmar el tipo de
cambio en el paso de Inversión debería resolverlo; queda pendiente de
verificación directa sobre esa cotización.

### Revisión 2.19.0 — el $0/hora tenía una causa exacta, no era el dato de origen

Segundo síntoma de la misma prueba de Victoria Puricelli: *"todos los
valores hora están en cero, puse a Acha arriba de todo y no me lo toma"*.
Confirmado con el usuario que Configuración → Personal → Ver tabla mensual
tiene los valores correctos. La causa no era el dato: es un único punto de
corte en la fórmula de tarifa, sin ninguna señal visible.

| ID | Estado | Definición y resolución |
|---|---|---|
| GEN-15 | Implementado | `resolveQuotationPersonnelRate` devuelve 0 para cualquier persona, sin leer sus datos de Personal, si el tipo de cambio de esa cotización puntual no es un número positivo confirmado. El paso Equipo (4) se puede alcanzar sin haber pasado por Inversión (5) —el único paso que exige confirmarlo— así que era posible llegar a asignar horas con el tipo de cambio todavía sin confirmar y ver $0 en todas las filas sin ninguna pista de por qué. Equipo ahora muestra un aviso explícito con acceso directo al paso de Inversión cuando falta ese snapshot. |

No se tocó el orden de los pasos ni se adelantó la validación del tipo de
cambio a un paso anterior: eso cambiaría el flujo de armado y no fue lo que
se pidió. La resolución es visibilidad, no bloqueo adicional.

### Revisión 2.20.0 — resolver el tipo de cambio sin salir de Equipo

Pedido explícito de negocio sobre GEN-15: *"para evitar fricción en el uso,
el cotizador debería poder sugerir ahí el tipo de cambio registrado o
permitirle al usuario usar otro."*

| ID | Estado | Definición y resolución |
|---|---|---|
| GEN-16 | Implementado | El aviso de tipo de cambio faltante en Equipo ofrece dos acciones en el lugar: usar el tipo de cambio vigente con un click, o cargar uno manual con la misma tolerancia a coma decimal que el resto de los inputs numéricos. Las dos llaman a `updateQuotationCurrency`, que ya recalcula la tarifa de todo el equipo con el nuevo snapshot en el mismo paso. "Ir a Inversión" queda como tercera opción, no como único camino. |

### Revisión 2.21.0 — auditoría en vivo simulando un usuario de Epical

Incluye dos entradas retroactivas: GEN-17 y GEN-18 se enviaron a producción
en la sesión anterior (commits `1b31fc1b` y `6bf594ba`) pero quedaron sin su
entrada correspondiente en este documento por la presión de contexto de esa
sesión. Se documentan acá para que el registro sea completo, sin volver a
tocar código ya en producción.

GEN-19 y GEN-20 son el resultado del pedido explícito más reciente: *"ahora
simula ser un usuario de epical y hace varias cotizaciones a ver que contras,
para corregir si hay problemas de lógica, ux y ui."* Se armaron cotizaciones
reales sobre datos seedeados (no sólo lectura de código) y aparecieron dos
bugs con causa exacta.

| ID | Estado | Definición y resolución |
|---|---|---|
| GEN-17 | Implementado | Reporte con captura: "Valor total" mostraba ARS 13.719.282.826 para 28 cotizaciones (19 aprobadas) — desproporcionado. La suma incluye todas las cotizaciones sin filtrar por estado (borradores, rechazadas, vencidas), no sólo las vigentes, algo previo a esta sesión y no redefinido acá porque cambiar qué cuenta el KPI no es una decisión de UX. Un total de esa magnitud casi siempre es una sola cotización con un monto mal cargado (frecuente en el histórico de pruebas de esta cuenta); encontrarla exigía revisar las 28 una por una. La tarjeta ahora muestra su mayor contribuyente: nombre del proyecto y monto en ARS-equivalente, con la misma lógica de conversión que ya usaba la suma. |
| GEN-18 | Implementado | Reporte con captura: *"aca seleccione bolsa de creditos por error, quiero des-seleccionar y no anda."* Clickear la tarjeta de una receta ya activa sólo volvía a aplicar la misma receta — no había ningún camino para deshacerla. `clearBlueprintSelection` deshace exactamente lo que `applyDefinition` escribe (id, versión, snapshot, equipo, entregables, plan operativo y la Bolsa de créditos si estaba activa) y evita que el efecto de auto-aplicado la vuelva a poner al desmontar. |
| GEN-19 | Implementado | GEN-16 resuelve el snapshot de tipo de cambio de la cotización puntual (`exchangeRates`), pero el "tipo de cambio vigente" que sugiere ese mismo botón y que usa el resto de la app (`useCurrency`) vive aparte, en `system_config.usd_exchange_rate`. Esa referencia sólo se actualizaba con el botón manual "Sincronizar dólar blue" — la sync automática del Máster (`recordObservedRate`, que corre sola cada vez que se importa un tipo de cambio real del mes) nunca la tocaba. Si nadie clickeaba el botón manual, la sugerencia de Equipo podía quedar vieja aunque el histórico sí estuviera al día. `recordObservedRate` ahora también actualiza `system_config.usd_exchange_rate`, sólo para el mes en curso (`rateType: "daily"`): un cierre histórico que se está cargando no debe pisar la referencia de hoy. |
| GEN-20 | Implementado | Al llegar por primera vez al paso Propuesta, un `useEffect` en `QuotationVariants` dispara la creación de las variantes por defecto (Esencial/Recomendada/Expandida) cuando la cotización todavía no tiene ninguna. Ese efecto depende de `[quotationId, baseCost, totalAmount]`, y `baseCost`/`totalAmount` cambian varias veces mientras el precio termina de asentarse recién asignado el equipo. Sin ningún lock, dos disparos casi simultáneos podían ver "0 variantes" cada uno mientras el primero todavía estaba creando el set por defecto, y los dos terminaban creando variantes — confirmado en vivo con dos filas "Esencial" idénticas (id=1 e id=2) y un hueco en la secuencia (id=4, de una fila creada por la corrida perdedora de la carrera). `fetchVariants` ahora usa un lock por instancia (`useRef`) que descarta cualquier disparo del efecto mientras ya hay una sincronización en curso. |

### Revisión 2.22.0 — el indicador de autoguardado no debe sugerir un guardado en servidor

Continuación de la misma auditoría en vivo. El autoguardado del cotizador
(`optimized-quote-context.tsx`) sólo escribe en `localStorage`; el guardado
real al servidor pasa exclusivamente por el botón explícito "Guardar
borrador". El indicador mostraba "Guardado hace Xs" con ícono y color verde
-- visualmente indistinguible de un guardado real -- y fue exactamente el
tipo de señal que llevó a pensar que cotizaciones "desaparecían": el
navegador decía "guardado" mientras el servidor nunca había recibido nada.
Se confirmó en vivo: `GET /api/quotations` devolvía `[]` con el indicador
mostrando "Guardado hace 3s" repetidas veces, hasta el primer click en
"Guardar borrador".

| ID | Estado | Definición y resolución |
|---|---|---|
| GEN-21 | Implementado | El texto de cada estado de `AutosaveIndicator` ahora aclara "local"/"en este navegador" en vez de un genérico "Guardado"/"Autoguardado activo" que sugería persistencia en servidor. No se cambió el comportamiento de guardado (seguir persistiendo sólo en localStorage hasta el click explícito en "Guardar borrador" es una decisión de producto, no un bug) ni el ícono/color, sólo la honestidad del texto. De paso, `getTimeSinceLastSave` ya no puede mostrar segundos negativos (se vio "hace -1s" cuando el timer de 1s quedaba un tick atrás del momento exacto del guardado). |
