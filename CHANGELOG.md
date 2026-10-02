# Changelog

## 1.10.5 — 2026-10-02

- Agrega importación controlada de proyectos y tareas desde los CSV oficiales de Asana, con vista previa, transacción e identificadores únicos de origen.
- Conserva responsables, fechas civiles, notas, estado y jerarquías resolubles; repetir una importación conserva cambios posteriores de Mind.
- Vincula contratos adicionales y registros históricos sin duplicar horas ni modificar precios.
- Muestra por proyecto y tarea los datos importados y los pendientes, separando los totales de tiempo del CSV de las entradas de horas con fecha y autor.
- Identifica clientes sin confirmar y el costo consumido informado por Excel como pendientes de conciliación.

## 1.10.4 — 2026-10-02

- Reemplaza las estructuras genéricas por las dos plantillas originales de Asana: 22 tareas y cinco secciones para informes recurrentes; 15 tareas y tres secciones para one-shot.
- Conserva nombres, orden, instrucciones y enlaces a briefs del origen; muestra una vista previa antes de crear.
- Agrega hitos de tareas, conserva los tres originales y mantiene la marca al duplicar tareas, secciones o proyectos.
- Crea las estructuras en una transacción, sin arrastrar responsables, fechas ni horas realizadas de las plantillas.

## 1.10.3 — 2026-10-02

- Corrige el guardado y la validación de cumpleaños en Personal.
- Evita alertar markup cero como urgente cuando todavía no hay costos reales del portfolio.
- Unifica Home y Tareas por fechas y semana de Buenos Aires; separa las solicitudes personales de la gestión de ausencias de Operaciones y representa días exactos en el Gantt.
- Guarda asignaciones durante ausencias con una advertencia, también para colaboradores del proyecto.
- Conserva secciones vacías del Excel y permite crearlas, renombrarlas, eliminarlas y copiarlas sin tareas ficticias.
- Duplica secciones y jerarquías en una transacción; permite crear proyectos con la estructura de un proyecto existente, miembros y PM seleccionados.
- Agrega recurrencias semanales, quincenales y mensuales con una sola próxima tarea y sin copiar horas realizadas.
- Conserva cierres y declaraciones aprobadas, protege revisiones concurrentes y registra cada reenvío y decisión de conciliación.
- Corrige el formato y las fechas del Máster FX, separa valores observados de REM 2027 y evita recrear estimaciones históricas en cada reinicio.
- Conserva las fechas vacías del Excel, mejora el diseño adaptable y evita mostrar cotizaciones perdidas como pendientes de configuración.
- Corrige la referencia al proyecto al renombrar uno de varios proyectos vinculados a la misma cotización.

## 1.10.2 — 2026-10-02

- Corrige horas desconocidas, tipos de servicio y moneda en el resumen de cotización de los proyectos; conserva el presupuesto en la moneda de la vista elegida.
- Muestra los fees mensuales con su modalidad correcta y conserva la moneda y los centavos de las cotizaciones archivadas.
- Excluye contratos archivados de las alertas de margen y compara con el costo contractual, conservando los costos adicionales cotizados.
- Agrega los proyectos operativos vinculados a un mismo contrato para calcular rentabilidad y excluye proyectos anulados o cancelados.
- Evita informar 100% de margen real cuando faltan costos o un tipo de cambio válido, y conserva los nombres de personas históricas en los equipos cotizados.
- Agrega cobertura de regresión para los contratos importados del Excel.

## 1.10.1 — 2026-10-01

- Permite elegir la hoja de un Excel al importar la cartera y procesa la estructura de proyectos Asana con secciones, tareas, responsables y subtareas.
- Valida responsables contra Personal y resuelve clientes con un único prefijo coincidente antes de habilitar el reemplazo reversible.

## 1.10.0 — 2026-10-01

- Agrega cumpleaños en Personal y Home, gestión de ausencias para Operaciones con planificación tentativa/confirmada, traslados de vacaciones, solicitudes para terceros y vista anual con filtro por persona.
- Clasifica tareas por fechas, incorpora el grupo Sin fecha, mejora la actualización de Calendario, advierte sobre asignaciones durante ausencias y permite duplicar secciones.
- Agrega templates iniciales semanales, mensuales y one-shot para proyectos, selección de PM y miembros, e importación de cartera con mapeo y vista previa.
- Incorpora la declaración de tipo de cambio bancario del colaborador con cálculo de diferencia, aprobación/rechazo de Operaciones e historial.
- Aclara fórmulas de impacto en cotizaciones, separa formato de entregable e identidad visual, habilita asignación directa de freelancers y distingue costo estimado del costo real.

## 1.9.3 — 2026-09-16

- Corrige los contadores de personas por rol para que respeten el área, excluyan freelancers y no cuenten personas cuyo período activo ya terminó.

## 1.9.2 — 2026-09-16

- Hace visible la bandeja de aprobación de ausencias dentro del módulo Operaciones y aclara en pantalla la diferencia entre solicitar y gestionar.

## 1.9.1 — 2026-09-16

- Excluye freelancers también de los selectores de alta rápida y del configurador legado de equipos, evitando que otra ruta del cotizador los asigne a roles.

## 1.9.0 — 2026-09-16

- Excluye freelancers del selector de personas para asignar roles en nuevas cotizaciones, manteniendo la consistencia con los promedios de la escala vigente.
- Permite registrar en el Kanban el motivo y la fecha de bloqueo de un proyecto, con migración idempotente y edición desde la tarjeta.
- Invalida el calendario al actualizar fechas de tareas desde Home para que las altas y cambios aparezcan sin recarga manual.

## 1.8.0 — 2026-09-15

- Separa definitivamente costo económico y facturación: el costo del equipo se devenga al 100% desde el cierre de Operaciones y no cambia cuando llega, se corrige o se aprueba una factura.
- Mueve la preparación mensual de liquidaciones a Operaciones, que define modalidad ARS, USD o mixta, porcentaje USD, bonos y extras sin intervenir en el matching contable.
- Incorpora una bandeja exclusiva de Administración para comparar cada factura con el importe final publicado y, al aprobarla, crear el Pasivo en el mes real de emisión.
- Divide la facturación mixta en dos documentos independientes: factura USD al cierre del mes y factura ARS por la diferencia luego del cobro, incluso si se emite al mes siguiente.
- Elimina el reparto de facturas entre proyectos: Costos y rentabilidad conservan linealmente la distribución operativa por proyecto o Epical; bonos, extras y comisiones de la factura no alteran esos costos.
- Convierte las facturas faltantes en un control documental de Pasivo que no bloquea el cierre ni el reconocimiento completo del costo del equipo.

## 1.7.0 — 2026-09-14

- Reordena el cierre mensual del equipo según las etapas conocidas del Excel: cierre operativo, preparación de Administración, carga del colaborador y revisión financiera.
- Propone automáticamente la modalidad y el porcentaje USD del último cierre de cada persona, sin arrastrar bonos ni extras variables.
- Permite preparar en un clic todos los borradores que ya tienen cierre operativo y después revisarlos individualmente antes de publicar.
- Agrupa a las personas por la próxima acción requerida y muestra el avance de tipos de cambio, comprobantes y aprobación sin abrir otras pantallas.
- Separa la experiencia del colaborador en los dos momentos reales del proceso: primero calcular la factura USD y, después del cobro, calcular la diferencia ARS.
- Evita que un guardado de borrador modifique silenciosamente una liquidación ya publicada; los cambios publicados requieren una actualización explícita.

## 1.6.1 — 2026-09-14

- Permite elegir la modalidad ARS, USD o USD + ARS por persona y por mes desde la liquidación, sin depender de una configuración fija en Personal.
- Abre la pantalla mostrando primero a quienes ya tienen cierre operativo, para que Administración pueda continuar de inmediato con los datos actuales.

## 1.6.0 — 2026-09-14

- Reemplaza el Excel de liquidación mixta con una sección de carga exclusiva para Administración, separada de reportes.
- Toma horas, valor hora y total ARS del cierre operativo; Administración sólo define el porcentaje USD, el bono USD y los extras ARS de cada persona.
- Guía al colaborador en dos momentos: tipo de cambio bancario al facturar y tipo de cambio/comisión al recibir la transferencia.
- Calcula automáticamente los pesos convertidos a USD, el comprobante USD con bono, la pesificación al cobro y la diferencia final a facturar en ARS.
- Permite adjuntar hasta diez comprobantes privados por liquidación y conserva juntos los documentos USD y ARS para revisión y costo directo por proyecto.

## 1.5.0 — 2026-09-14

- Agrega un espacio personal para que cada integrante cargue su factura mensual mediante PDF, imagen o captura, con lectura automática y revisión financiera.
- Vincula cada factura con los proyectos trabajados y guarda un reparto auditable que suma 100%.
- Separa la valuación operativa de horas × tarifa de los costos financieros: freelancers usan el costo horario real y contratos fijos usan el importe aprobado de la factura.
- Distribuye el costo real de contratos fijos entre proyectos para la rentabilidad económica, manteniendo horas y tarifas para markup y eficiencia operativa.
- Impide cerrar un período financiero mientras falten facturas requeridas del equipo fijo, importes normalizados o repartos completos.

## 1.4.1 — 2026-09-14

- Habilita la extracción inteligente de capturas y PDFs financieros mediante Anthropic cuando OpenAI no está configurado, conservando las reglas locales como último fallback.
- Configura en producción almacenamiento privado persistente para que la evidencia financiera sobreviva a nuevos despliegues.

## 1.4.0 — 2026-09-14

- Incorpora una sección independiente de Carga financiera para ingresar texto, documentos o capturas directamente en Mind, sin formularios separados ni CSV operativo.
- Extrae y permite revisar facturas, cobros, pagos, extractos, fees, provisiones, impuestos, tipo de cambio, REM e IPC antes de contabilizarlos.
- Crea y concilia registros nativos de Activo, Pasivo, Cashflow, ingresos, costos, provisiones y variables económicas, con evidencia privada, deduplicación y auditoría.
- Agrega cierre financiero por período con pre-cierre, controles críticos, snapshot, bloqueo, revisión y reapertura justificada.
- Alimenta reportes y tableros desde hechos financieros nativos a partir del corte, manteniendo compatibilidad histórica previa.
- Separa en la navegación Carga financiera, Gestión financiera y Reportes financieros, y anticipa en pantalla qué módulos actualizará cada confirmación.

## 1.3.4 — 2026-09-14

- La daily se puede hacer aunque ningún ítem tenga novedad: "Recorrer todos igual", y cada ítem de "Sin novedad" se abre con un clic para dejarle un update.
- Con novedades, aparece "Recorrer todos" para incluir también los ítems al día.

## 1.3.3 — 2026-09-11

- Hace visibles desde la navegación principal la cartera, el Kanban general, las tareas y el calendario de proyectos para Administración y Operaciones.
- Agrega un selector explícito de estado operativo en cada tarjeta del Kanban, manteniendo también el arrastre entre columnas.
- Retira de las pantallas operativas los roles históricos: Administración muestra sólo la taxonomía vigente y la edición rápida de Personal usa Nivel, Subnivel y Área.
- Distingue en la grilla mensual de costos qué períodos son reales cerrados, cuál es el mes actual y cuáles son proyecciones.

## 1.3.2 — 2026-09-11

- Permite renombrar y describir un ítem propio desde el recorrido de la daily.
- Rediseña "Agregar ítem" para la daily: título, qué está pasando (queda como primer update), quién lo lleva, semáforo y deadline; el ítem nace con contexto en vez de caer vacío en NUEVO/SILENCIO.
- Agrega el botón de alta en la agenda de la daily y muestra el owner en los ítems nuevos.

## 1.3.0 — 2026-09-09

- Agrega el Modo Daily en Status: al entrar a un room se muestra qué ítems merecen conversación hoy (rojo, cambió, vence, decisión, silencio, nuevo) y cuáles no tienen novedad.
- Permite recorrer la daily ítem por ítem con atajos de teclado, dictado por voz y un cierre con resumen copiable; lo escrito queda como update real de cada ítem.
- Registra cada daily (duración, ítems revisados, cambios) para mostrar la racha y que el silencio se mida contra la última daily, no contra un plazo fijo.

## 1.2.0 — 2026-09-08

- Unifica el catálogo de nuevas cotizaciones en One Shot, Fee, Intelligence Event Track y Demo, conservando recetas históricas archivadas.
- Elimina la segunda elección de modalidad: servicio y duración se definen juntos desde la receta.
- Versiona y muestra los perfiles de área/nivel sugeridos por cada receta.
- Reemplaza el gráfico mensual de horas por un donut accesible con total, horas y porcentajes por proyecto.
- Cierra y versiona las definiciones pendientes de Feedback Mind V2 como 2.25.0.

## 1.1.0 — 2026-09-01

- Agrega la modalidad comercial de bolsa de créditos Epical.
- Corrige el cálculo de horas y fee mensual para recetas recurrentes.
- Hace visible la justificación de desvíos operativos en el paso Equipo.
