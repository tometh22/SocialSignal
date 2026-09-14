# Changelog

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
