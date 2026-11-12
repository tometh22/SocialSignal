import { isPublishedTrainingGuide } from "../../shared/training-policy";
import { screenshotsForLesson } from "./training-media";
import type { TrainingLesson } from "../../shared/training";
import { emptyTrainingProgress } from "../../shared/training";

export type AuthoredLesson = Omit<
  TrainingLesson,
  "progress" | "needsUpdate" | "screenshots"
> & {
  /** Current route patterns covered by this guide, including secondary screens. */
  covers: string[];
};

// Stable ids preserve exercise and read history from earlier versions.
// Version 3 consolidates feedback; reading stays optional, without prerequisites.
const authoredTrainingLessons: AuthoredLesson[] = [
  {
    id: "bienvenida",
    version: 3,
    module: "Primeros pasos",
    title: "Conocer Mind",
    access: {
      audience: "authenticated",
    },
    covers: ["/training", "/training/:lessonId"],
    description:
      "Ubicá las funciones de la app y consultá las instrucciones que necesitás.",
    explanation: [
      "Las guías muestran únicamente funciones disponibles para tu cuenta. Podés consultarlas en cualquier orden y abrir la pantalla de trabajo desde cada guía.",
      "Marcar una guía como leída es opcional y guarda una referencia personal entre dispositivos. No necesitás hacerlo para consultar otra guía o usar la app.",
    ],
    example:
      "Lucía necesita recordar cómo registrar horas. Busca “horas” en Capacitación y abre la guía disponible para su perfil.",
    minutes: 1,
    links: [
      {
        label: "Abrir Capacitación",
        href: "/training",
      },
    ],
    instructions: [
      "Ubicá la función que necesitás en el menú lateral. En el celular, abrí primero el menú de la barra superior.",
      "Para consultar una instrucción, entrá a Capacitación o al ícono de ayuda de la barra superior.",
      "Buscá por tarea o función, o filtrá por área. Abrí la guía y seguí sus pasos en la pantalla indicada.",
      "Si una función necesaria no aparece, pedí al administrador que revise tus permisos.",
    ],
    verification:
      "Si el menú no muestra una función necesaria, pedí una revisión de permisos al administrador.",
  },
  {
    id: "inicio",
    version: 3,
    module: "Primeros pasos",
    title: "Inicio",
    access: {
      audience: "internal",
      any: [
        "crm",
        "quotations",
        "projects",
        "status",
        "dashboard",
        "finance",
        "admin",
        "operations",
        "task_manager",
      ],
    },
    covers: ["/"],
    description: "Priorizá tu día desde el resumen personal.",
    explanation: [
      "Abrí Inicio para revisar tu resumen personal y entrar a las tareas o pendientes que necesitás atender. El contenido depende de tus permisos.",
      "Usá los accesos del resumen para abrir el detalle correspondiente. Ver un pendiente no significa que ya esté resuelto: la acción se completa en su pantalla.",
    ],
    example:
      "Tenés una tarea pendiente y una solicitud de ausencia. Abrís cada detalle para conocer su estado antes de actuar.",
    minutes: 1,
    links: [
      {
        label: "Abrir Inicio",
        href: "/",
      },
    ],
    instructions: [
      "Abrí Inicio y revisá el resumen de tus tareas y pendientes para identificar qué requiere atención hoy.",
      "Consultá las horas cargadas del mes y de la semana. Abrí el detalle de horas si necesitás completar o corregir un registro.",
      "Revisá los próximos cumpleaños del equipo para anticipar las fechas.",
      "Usá los accesos a los módulos habilitados para tu perfil. Abrí un pendiente cuando necesites trabajar en él y verificá después su estado."
    ],
    verification: "El resumen y los accesos dependen de tus permisos. Las horas del mes y de la semana representan períodos distintos: verificá cuál estás consultando.",
  },
  {
    id: "notificaciones",
    version: 3,
    module: "Primeros pasos",
    title: "Notificaciones",
    access: {
      audience: "authenticated",
    },
    covers: ["/notifications"],
    description: "Revisá avisos y elegí cómo recibirlos.",
    explanation: [
      "Abrí la campana o Notificaciones para ver los avisos propios y acceder a su contexto. Revisá los filtros cuando busques un aviso anterior.",
      "Configurá los canales y categorías disponibles para tu cuenta. Marcar un aviso como leído no aprueba una solicitud ni completa una tarea.",
    ],
    example:
      "Recibís un aviso de una solicitud actualizada. Abrís el aviso, revisás la solicitud y después la marcás como leída.",
    minutes: 1,
    links: [
      {
        label: "Abrir Notificaciones",
        href: "/notifications",
      },
    ],
    instructions: [
      "Abrí la campana de la barra superior o la pantalla Notificaciones y revisá tus avisos.",
      "Abrí el contexto del aviso para consultar la tarea, solicitud o registro asociado y resolver allí la acción pendiente.",
      "Marcá el aviso como leído cuando lo hayas revisado. Esta marca no aprueba solicitudes ni completa tareas.",
      "En Cómo querés recibirlas, elegí los canales disponibles y ajustá las categorías de avisos que querés recibir.",
      "En Tu actividad, usá Todas o Sin leer para volver a encontrar avisos anteriores, incluidos los leídos."
    ],
    verification: "Lectura y resolución son acciones diferentes.",
  },
  {
    id: "ausencias-personales",
    version: 3,
    module: "Gestión personal",
    title: "Mis ausencias",
    access: {
      audience: "internal",
      any: [
        "crm",
        "quotations",
        "projects",
        "status",
        "dashboard",
        "finance",
        "admin",
        "operations",
        "task_manager",
      ],
    },
    covers: ["/absences"],
    description: "Solicitá días y entendé sus estados y saldos.",
    explanation: [
      "Entrá a Mis ausencias, revisá tus saldos y cargá tipo y fechas. Verificá los días computables y el saldo antes de enviar la solicitud.",
      "Una solicitud pendiente todavía espera aprobación. Si cancelás una aprobada, queda una solicitud de cancelación y sigue descontando hasta que se confirme.",
      "Vacaciones y Día Epical tienen saldos separados. Los días hábiles excluyen los feriados configurados; enfermedad y otros no consumen esos cupos.",
    ],
    example:
      "Una ausencia aprobada ya no es necesaria. Solicitás su cancelación y esperás la confirmación antes de considerar recuperado el saldo.",
    minutes: 1,
    links: [
      {
        label: "Abrir Mis ausencias",
        href: "/absences",
      },
    ],
    instructions: [
      "Entrá a Mis ausencias y revisá el saldo del tipo de ausencia que vas a solicitar.",
      "En Nueva solicitud, elegí el tipo y completá las fechas de inicio y fin.",
      "Verificá los días computables y el saldo disponible; después enviá la solicitud.",
      "Consultá su estado. Esperá la aprobación antes de considerar confirmada la ausencia.",
    ],
    verification:
      "Revisar saldo y fechas antes del envío evita solicitudes incorrectas.",
  },
  {
    id: "facturas-personales",
    version: 3,
    module: "Gestión personal",
    title: "Mis facturas",
    access: {
      audience: "internal",
    },
    covers: ["/my-invoices"],
    description: "Seguí tu base, autorizaciones y comprobantes del mes.",
    explanation: [
      "Elegí el período y revisá la base publicada por Operaciones. Seguí la etapa habilitada: enviar importe, esperar autorización y cargar el comprobante cuando corresponda a tu modalidad.",
      "Si cobrás una parte en USD, ingresá el TC bancario solicitado para ese tramo. Después del cobro, confirmá recepción y el segundo TC antes de avanzar al tramo ARS. Si tu modalidad es solo ARS, no se exige ese TC.",
      "Revisá los adicionales ya incluidos por Operaciones para no duplicarlos. Agregá únicamente extras nuevos con su motivo. Un importe enviado no equivale a una factura aprobada.",
    ],
    example:
      "Operaciones ya incluyó ARS 5.000 de adicionales. Tu reintegro nuevo es ARS 800: declarás solo 800 y explicás el motivo.",
    minutes: 4,
    links: [
      {
        label: "Abrir Mis facturas",
        href: "/my-invoices",
      },
    ],
    instructions: [
      "Operaciones prepara y publica tu base del mes: horas, tarifa, porcentaje a cobrar en USD y adicionales. Cuando recibas el aviso, abrí Mis facturas y elegí ese período. Si falta la base, pedí su revisión a Operaciones.",
      "Revisá la base publicada, la modalidad de cobro y los bonos o extras ya incluidos. Si detectás una diferencia, consultala antes de enviar importes.",
      "Si hay tramo USD y emitís factura, ingresá el tipo de cambio comprador más bajo de tu banco del día en que vas a facturar. Si tu modalidad no exige factura, usá el TC de conversión indicado para la liquidación. Revisá el importe calculado y pulsá Enviar importe a Operaciones.",
      "Esperá la autorización de Operaciones. Si el importe es devuelto, corregí los datos y reenviá. Cuando esté autorizado y tu modalidad requiera factura, adjuntá el comprobante en la moneda y por el importe autorizado y pulsá Enviar a Administración.",
      "Administración revisa el documento. Consultá su estado y, si lo devuelve, corregí esa presentación con Reemplazar y reenviar para evitar duplicados. La autorización del importe y la aprobación del documento son pasos distintos.",
      "En una modalidad mixta, después de recibir los USD y de completar la aprobación del tramo anterior, marcá Ya recibí los USD en mi cuenta e ingresá el TC comprador más bajo de tu banco de ese día. Declarar este segundo TC permite calcular el saldo ARS.",
      "En el tramo ARS, agregá únicamente extras nuevos y comisiones que correspondan, con su motivo. No repitas los adicionales incluidos por Operaciones. Revisá el importe y envialo a Operaciones; después de su autorización, presentá la factura en pesos si corresponde.",
      "Si cobrás solo ARS, comenzá directamente por Tu factura en pesos o Tu liquidación en pesos: no se requieren los dos TC. Si tu modalidad no exige factura, completá las autorizaciones de liquidación sin emitir ni adjuntar documentos."
    ],
    verification: "Usá el período correcto, un TC positivo y la moneda de cada tramo. Un saldo negativo requiere revisión de Operaciones antes de emitir. Los adicionales ya incluidos nunca se vuelven a declarar.",
  },
  {
    id: "crm",
    version: 3,
    module: "Comercial",
    title: "CRM",
    access: {
      audience: "internal",
      any: ["crm"],
    },
    covers: ["/crm", "/crm/:id", "/crm/pipeline"],
    description: "Mantené oportunidades, actividades y próximos pasos.",
    explanation: [
      "Abrí CRM para revisar el pipeline y filtrar oportunidades. Entrá a una oportunidad para consultar sus datos, actividades y recordatorios.",
      "Pipeline comercial separa cartera abierta, validación y confirmadas. Revisá cobertura y evidencia antes de interpretar bruto o ponderado; guardá el cierre mensual y copiá el resumen para compartirlo manualmente.",
      "Después de una conversación, registrá la actividad y el próximo paso. Actualizá la etapa según lo que realmente ocurrió, no solo por tener una reunión agendada.",
    ],
    example:
      "Acme pidió una propuesta para el viernes. Registrás la conversación y un recordatorio con fecha para preparar el envío.",
    minutes: 1,
    links: [
      {
        label: "Abrir CRM",
        href: "/crm",
      },
    ],
    instructions: [
      "Abrí CRM, filtrá el pipeline y seleccioná la oportunidad que vas a actualizar.",
      "Revisá los datos y las actividades anteriores para conocer el último contacto.",
      "Registrá la nueva actividad con el resultado de la conversación.",
      "Dejá el próximo paso y su recordatorio con fecha. Actualizá la etapa si hubo un cambio real en la oportunidad.",
    ],
    verification:
      "El historial explica el contexto y el recordatorio ayuda a sostener el seguimiento.",
  },
  {
    id: "clientes",
    version: 3,
    module: "Comercial",
    title: "Clientes",
    access: {
      audience: "internal",
      any: ["crm"],
    },
    covers: ["/clients"],
    description: "Buscá y mantené la base de clientes.",
    explanation: [
      "Antes de agregar un cliente, buscá si ya existe. Revisá nombre y contacto para evitar duplicados.",
      "Mantené los datos de contacto en el cliente correcto. Cuando una pantalla permita asociar un cliente, elegí el registro existente correspondiente.",
    ],
    example:
      "Recibís un pedido de Acme y encontrás “Acme SA” con el mismo contacto. Revisás ese registro antes de crear uno nuevo.",
    minutes: 1,
    links: [
      {
        label: "Abrir Clientes",
        href: "/clients",
      },
    ],
    instructions: [
      "Entrá a Clientes y buscá por nombre antes de crear un registro.",
      "Si ya existe, abrí ese cliente y revisá sus datos de contacto. Si no existe, agregalo con los datos correspondientes.",
      "Guardá los cambios y comprobá que el nombre y contacto sean correctos.",
      "Al asociarlo en una cotización o proyecto, seleccioná ese mismo registro.",
    ],
    verification:
      "La búsqueda previa evita repartir el historial de un cliente entre registros duplicados.",
  },
  {
    id: "cotizaciones",
    version: 3,
    module: "Comercial",
    title: "Cotizaciones",
    access: {
      audience: "internal",
      any: ["quotations"],
    },
    covers: [
      "/quotations",
      "/optimized-quote",
      "/optimized-quote/:id",
      "/quotations/:id",
    ],
    description: "Prepará un presupuesto y verificá moneda, equipo y alcance.",
    explanation: [
      "Las recetas aportan un punto de partida de roles y horas. Los ajustes de alcance deben reflejar el trabajo real; una receta no reemplaza la revisión del equipo.",
      "La calibración histórica existente compara proyectos de la misma receta y tipo y requiere al menos dos muestras para proponer la mediana de horas reales. La propuesta ajusta el borrador de la receta: no publica cambios automáticamente ni modifica cotizaciones ya emitidas. Si no hay muestras comparables, mantené una estimación revisada por el equipo.",
      "Costos adicionales reúne gastos que no son horas del equipo y se incorpora al cálculo de la cotización. Verificá moneda y precio resultante después de agregar o modificar un costo.",
      "Guardar un borrador no equivale a obtener aprobación interna o aceptación del cliente. Verificá la revisión vigente antes de crear un proyecto comercial."
    ],
    example:
      "Preparás una propuesta en USD. Revisás el TC y las tarifas en la moneda de la cotización antes de comparar dos variantes de alcance.",
    minutes: 3,
    links: [
      {
        label: "Abrir Cotizaciones",
        href: "/quotations",
      },
    ],
    instructions: [
      "Entrá a Cotizaciones y creá una cotización o abrí el borrador que necesitás editar. Definí cliente y datos esenciales.",
      "En Servicio, elegí la receta correspondiente. En Alcance, ajustá modalidad, volumen y cobertura al trabajo acordado.",
      "En Equipo, revisá roles, personas y horas sugeridas por la receta. Ajustalos al alcance real y contrastá con horas históricas de trabajos comparables cuando estén disponibles.",
      "En la revisión financiera, abrí Costos adicionales para sumar gastos ajenos al equipo: IA, software, licencias, comisiones o encuestas. Revisá la moneda y el total para no omitirlos ni duplicarlos en las horas.",
      "Comprobá moneda, tipo de cambio, margen y precio final. Si usás variantes, revisá el alcance, equipo y costos de cada alternativa por separado.",
      "Guardá el borrador y verificá su estado antes de continuar con la propuesta, la aprobación interna y la aceptación del cliente."
    ],
    verification:
      "El presupuesto debe partir del alcance y los recursos, con una moneda coherente.",
  },
  {
    id: "propuestas",
    version: 3,
    module: "Comercial",
    title: "Propuestas y aprobaciones",
    access: {
      audience: "internal",
      any: ["quotations"],
    },
    covers: [
      "/quotations/:id/studio",
      "/quotation-groups/:id",
      "/proposal/:token",
      "/proposal-group/:token",
    ],
    description: "Revisá el documento y seguí sus aprobaciones.",
    explanation: [
      "Desde el detalle de una cotización abrí el estudio de propuesta para revisar alcance, entregables y documento. En propuestas agrupadas, verificá las opciones que verá el cliente.",
      "La aprobación interna y la aceptación del cliente son etapas distintas. La revisión interna debe hacerla una persona habilitada diferente de quien la solicitó.",
      "Si cambia la propuesta, verificá que la aprobación corresponda a la revisión vigente. Compartí el enlace público solo después de revisar qué información contiene.",
    ],
    example:
      "La propuesta tiene aprobación interna, pero todavía no fue aceptada por el cliente. El siguiente paso comercial es enviarla y registrar su respuesta.",
    minutes: 1,
    links: [
      {
        label: "Abrir Cotizaciones",
        href: "/quotations",
      },
    ],
    instructions: [
      "Abrí la cotización y entrá a su estudio de propuesta.",
      "Revisá alcance, entregables y documento. Si es una propuesta agrupada, comprobá todas las opciones que verá el cliente.",
      "Solicitá la revisión interna de la versión vigente. La aprobación debe hacerla otra persona habilitada.",
      "Con la aprobación correspondiente, revisá el contenido del enlace público y compartilo con el cliente.",
      "Seguí la aceptación del cliente. Si modificás la propuesta, comprobá si necesita una nueva revisión interna.",
    ],
    verification:
      "La aprobación interna no sustituye la aceptación del cliente.",
  },
  {
    id: "proyectos-tareas",
    version: 3,
    module: "Proyectos y tareas",
    title: "Proyectos de tareas: lista y kanban",
    access: {
      audience: "internal",
      any: ["projects", "operations", "task_manager"],
    },
    covers: [
      "/tasks/projects",
      "/tasks/projects/kanban",
      "/tasks/projects/:id",
    ],
    description: "Ubicá tu proyecto y organizá el trabajo.",
    explanation: [
      "La lista permite encontrar y abrir proyectos de tareas. El kanban de proyectos agrupa esos proyectos por etapa operativa; no es una vista de estados de las tareas individuales.",
      "Dentro del proyecto, las secciones organizan las tareas. El completado se registra sobre cada tarea y no depende del nombre de su sección.",
      "Cartera de proyectos es la vista de gestión económica y requiere permisos de Proyectos y Operaciones. Si no aparece, solicitá una revisión de permisos; los filtros o asignaciones también pueden limitar la lista de tareas."
    ],
    example:
      "Buscás la campaña de Acme. Revisás filtros, abrís el proyecto y ubicás las tareas en su sección correspondiente.",
    minutes: 1,
    links: [
      {
        label: "Abrir Proyectos de tareas",
        href: "/tasks/projects",
      },
      {
        label: "Abrir kanban",
        href: "/tasks/projects/kanban",
      },
    ],
    instructions: [
      "Entrá a Proyectos de tareas o Mis proyectos. La lista sirve para buscar un proyecto y abrir sus tareas; revisá filtros y asignaciones si no lo encontrás.",
      "Abrí el kanban de proyectos para consultar la etapa operativa de cada proyecto. Sus columnas representan etapas de proyectos, no tareas individuales ni rentabilidad financiera.",
      "Dentro de un proyecto, revisá sus miembros y tareas y organizá el trabajo en secciones. Abrí cada tarea para revisar responsable, vencimiento y estado.",
      "Completá una tarea usando su control de completado. Cambiar el nombre de una sección o la etapa de un proyecto no completa automáticamente sus tareas.",
      "Si necesitás presupuesto, costos o rentabilidad, usá Cartera de proyectos cuando tu perfil tenga Proyectos y Operaciones. Sus datos financieros se consultan aparte del kanban de tareas."
    ],
    verification:
      "La lista depende de filtros y de los proyectos habilitados para tu cuenta.",
  },
  {
    id: "tareas",
    version: 3,
    module: "Proyectos y tareas",
    title: "Tareas y responsables",
    access: {
      audience: "internal",
      any: ["projects", "operations", "task_manager"],
    },
    covers: ["/tasks", "/tasks/my-tasks"],
    description: "Definí responsables, fechas y criterios de finalización.",
    explanation: [
      "Abrí Tareas y seleccioná una tarea para consultar título, responsable, fechas y detalle. Usá subtareas cuando el trabajo tenga pasos que deban seguirse por separado.",
      "Revisá el responsable y las fechas antes de asignar. Si aparece una advertencia de ausencia, coordiná la cobertura. Un bloqueo debe explicar qué impide avanzar.",
      "Para finalizar una tarea o subtarea, usá su control de completado. El cambio de columna no sustituye ese control. En tareas recurrentes, revisá la próxima ocurrencia creada y sus fechas.",
    ],
    example:
      "“Preparar informe” requiere primero revisar datos. Creás una subtarea y, al terminar, marcás su control de completado; la tarea principal se revisa por separado.",
    minutes: 1,
    links: [
      {
        label: "Abrir Tareas",
        href: "/tasks",
      },
    ],
    instructions: [
      "Entrá a Tareas o abrí las tareas de un proyecto y seleccioná la tarea que vas a gestionar.",
      "Definí un título concreto y describí qué debe quedar resuelto. Dividí el trabajo en subtareas cuando requiera seguimiento separado.",
      "Asigná responsable y fechas. Si aparece una advertencia de ausencia, coordiná la cobertura antes de confirmar la asignación.",
      "Actualizá el seguimiento; si está bloqueada, explicá qué impide avanzar y cuál es el próximo paso.",
      "Usá el control de completado cuando el trabajo esté terminado. Si es recurrente, revisá las fechas de la próxima ocurrencia.",
    ],
    verification: "Una tarea clara tiene título, responsable y fecha acordada.",
  },
  {
    id: "horas",
    version: 3,
    module: "Proyectos y tareas",
    title: "Registrar y revisar horas",
    access: {
      audience: "internal",
      any: ["projects", "operations", "task_manager"],
    },
    covers: ["/tasks/hours-dashboard"],
    description: "Cargá el tiempo trabajado y comprobá período y proyecto.",
    explanation: [
      "Abrí la tarea correspondiente y registrá fecha, horas y descripción del trabajo. Cargá tiempo efectivamente trabajado; una estimación no reemplaza el registro real.",
      "En Mis horas o Panel de horas, elegí el período y proyecto para verificar la carga. El alcance visible depende de tu perfil: el equipo consulta sus horas y Operaciones tiene una vista ampliada.",
      "Si encontrás un error, revisá la entrada original antes de cargar otra para evitar duplicados. Un período cerrado puede requerir intervención de Operaciones.",
    ],
    example:
      "Trabajaste 2,5 horas en “Revisar datos” el 12 de noviembre. Registrás 2,5 en esa tarea y fecha, no la estimación de 4 horas.",
    minutes: 1,
    links: [
      {
        label: "Abrir Panel de horas",
        href: "/tasks/hours-dashboard",
      },
      {
        label: "Abrir Tareas",
        href: "/tasks",
      },
    ],
    instructions: [
      "Abrí la tarea del proyecto en el que trabajaste y entrá a su carga de horas.",
      "Completá la fecha del trabajo, el tiempo efectivamente dedicado y la descripción correspondiente.",
      "Revisá que la entrada no esté ya cargada y guardá el registro.",
      "Entrá a Mis horas o Panel de horas, elegí período y proyecto, y comprobá que la carga aparezca con la fecha y cantidad correctas.",
      "Si hay un error, corregí la entrada original. Si el período está cerrado, consultá a Operaciones.",
    ],
    verification:
      "La carga refleja el tiempo real y la fecha del trabajo, no la estimación.",
  },
  {
    id: "status",
    version: 3,
    module: "Status",
    title: "Status",
    access: {
      audience: "internal",
      any: ["status"],
    },
    covers: ["/review", "/review/:roomId"],
    description: "Prepará reuniones con novedades, pendientes y decisiones.",
    explanation: [
      "Abrí Status y elegí una sala a la que tengas acceso. Revisá los temas y pendientes antes de la reunión.",
      "Dentro de la sala, agregá actualizaciones con contexto suficiente y dejá claras las decisiones y próximos pasos. Diferenciá una novedad informativa de algo que requiere resolución.",
      "Consultá el seguimiento de la sala para retomar acuerdos. Tener permiso de Status no implica pertenecer a todas las salas.",
    ],
    example:
      "El cliente pidió un cambio. Registrás qué cambió, qué decisión hace falta y quién debe darle seguimiento.",
    minutes: 1,
    links: [
      {
        label: "Abrir Status",
        href: "/review",
      },
    ],
    instructions: [
      "Abrí Status y seleccioná la sala correspondiente.",
      "Antes de la reunión, revisá temas, pendientes y acuerdos anteriores.",
      "Agregá las novedades con contexto. Para cada bloqueo, indicá qué falta y quién debe intervenir.",
      "Registrá las decisiones y próximos pasos con responsable y fecha; retomá esos acuerdos en el seguimiento de la sala.",
    ],
    verification:
      "Una actualización útil identifica el bloqueo y el próximo paso con responsable.",
  },
  {
    id: "objetivos",
    version: 3,
    module: "Status",
    title: "Objetivos",
    access: {
      audience: "internal",
      any: ["operations"],
    },
    covers: ["/review/objectives"],
    description: "Conectá el plan del año con las acciones de la semana.",
    explanation: [
      "Entrá a Objetivos para revisar el plan y su jerarquía. Ubicá el objetivo al que contribuye una acción antes de agregarla o actualizarla.",
      "Mantené responsable, fecha y avance alineados con lo ocurrido. Si se reprograma una acción, registrá la nueva fecha en su seguimiento.",
      "Antes de retirar un elemento, revisá las acciones relacionadas y usá únicamente las acciones habilitadas para tu perfil.",
    ],
    example:
      "Una acción se pospone por una dependencia. Actualizás su fecha y explicás el motivo para que la reunión siguiente tenga contexto.",
    minutes: 1,
    links: [
      {
        label: "Abrir Objetivos",
        href: "/review/objectives",
      },
    ],
    instructions: [
      "Entrá a Objetivos y ubicá el objetivo dentro del plan.",
      "Abrí o agregá la acción que contribuye a ese objetivo.",
      "Revisá responsable, fecha y avance; actualizalos según lo ocurrido.",
      "Si reprogramás la acción, dejá la nueva fecha y el contexto del próximo paso. Revisá acciones relacionadas antes de retirar un elemento.",
    ],
    verification:
      "La actualización debe conservar la relación entre el objetivo y la acción concreta.",
  },
  {
    id: "cartera",
    version: 3,
    module: "Operaciones",
    title: "Cartera y gestión del proyecto",
    access: {
      audience: "internal",
      all: ["projects", "operations"],
    },
    covers: [
      "/active-projects",
      "/active-projects/new",
      "/active-projects/:id",
      "/active-projects/:id/edit",
      "/project-settings/:id",
      "/active-projects/:id/financial-management",
      "/active-projects/:id/time-entries",
      "/time-entries/project/:projectId",
      "/operations/portfolio-import"
    ],
    description: "Creá proyectos desde cotizaciones aprobadas y revisá sus horas, costos y resultados.",
    explanation: [
      "Esta guía reúne Cartera y gestión financiera del proyecto. Las antiguas guías de gestión financiera y entregables abren esta referencia común, centrada en los recorridos disponibles.",
      "Los proyectos comerciales nuevos requieren una cotización aprobada del mismo cliente. La excepción interna conserva su categoría propia; no debe usarse para evitar la aprobación de un proyecto comercial.",
      "Los resultados dependen del período, moneda y origen de las horas y costos. Las estimaciones no sustituyen los registros reales. Las pantallas históricas y sus datos se conservan, sin presentar calidad, NPS o recurrencia como pasos obligatorios del circuito actual."
    ],
    example:
      "Acme aceptó una propuesta. Revisás que la cotización esté aprobada y creás el proyecto con el alcance acordado.",
    minutes: 3,
    links: [
      {
        label: "Abrir Cartera de proyectos",
        href: "/active-projects",
      },
    ],
    instructions: [
      "Entrá a Cartera de proyectos; la pantalla se titula Vista de proyectos. Buscá el proyecto: esta vista de gestión económica es distinta de la lista y el kanban de proyectos de tareas.",
      "Para crear un proyecto comercial, seleccioná una cotización aprobada y verificá cliente, alcance, modalidad y responsables. Un borrador no habilita el alta. Los proyectos internos se registran como internos y no requieren cotización comercial.",
      "Guardá y abrí el detalle del proyecto para revisar su configuración, presupuesto y equipo. Conservá la relación con la cotización aprobada.",
      "Consultá la gestión financiera y los registros de horas del proyecto. Seleccioná el período y compará ingresos, costos y horas en la misma moneda, distinguiendo estimaciones de registros reales.",
      "Si un importe no coincide, identificá su fuente y corregí el registro correspondiente. No dupliques cargas para forzar el total.",
      "Antes de cerrar o cambiar el estado, revisá tareas pendientes y registros relacionados. La organización diaria de tareas se gestiona en Proyectos de tareas."
    ],
    verification: "Verificá cotización aprobada, cliente, período y moneda. La creación del proyecto y su seguimiento financiero no reemplazan la planificación de tareas.",
  },
  {
    id: "finanzas-proyecto",
    version: 3,
    module: "Operaciones",
    title: "Gestión financiera del proyecto",
    access: {
      audience: "internal",
      all: ["projects", "operations"],
    },
    covers: [
      "/active-projects/:id/financial-management",
      "/active-projects/:id/time-entries",
      "/time-entries/project/:projectId",
    ],
    description: "Contrastá horas, ingresos y costos dentro del proyecto.",
    explanation: [
      "Desde Cartera abrí el detalle del proyecto y sus vistas de horas y gestión financiera. Elegí el período correspondiente antes de comparar importes.",
      "Diferenciá estimaciones de registros reales. Revisá origen, moneda y fechas cuando un resultado no coincida con lo esperado.",
      "Corregí el registro de origen que corresponda; no dupliques una carga para forzar el total del reporte.",
    ],
    example:
      "El costo de un mes parece alto. Revisás período y horas originales antes de agregar ajustes.",
    minutes: 1,
    links: [
      {
        label: "Abrir Cartera de proyectos",
        href: "/active-projects",
      },
    ],
    instructions: [
      "Entrá a Cartera de proyectos y abrí el proyecto correspondiente.",
      "Accedé a su gestión financiera o a sus registros de horas y seleccioná el período.",
      "Compará ingresos, costos y horas con la misma moneda y período. Distinguí estimaciones de registros reales.",
      "Si un importe no coincide, identificá su registro de origen y corregilo allí; después volvé a revisar el resultado.",
    ],
    verification:
      "Los importes deben compararse en el mismo período y moneda y con su fuente identificada.",
  },
  {
    id: "entregables",
    version: 3,
    module: "Proyectos y tareas",
    title: "Entregables, calidad y recurrencia",
    access: {
      audience: "internal",
      all: ["projects", "operations"],
    },
    covers: [
      "/client-summary/:clientId",
      "/quality-scores/:clientId",
      "/quarterly-nps/:clientId",
      "/edit-deliverable/:id",
      "/edit-indicators/:id",
      "/always-on-project/:projectId",
      "/recurring-templates/:projectId",
    ],
    description: "Seguí entregables y mediciones en los proyectos habilitados.",
    explanation: [
      "En el proyecto correspondiente, revisá entregables, equipo y métricas. Para editar un entregable, comprobá primero cliente, proyecto y período.",
      "Las puntuaciones de calidad describen el entregable elegido; los indicadores de robustez y la encuesta NPS tienen sus propios campos. Revisá el elemento seleccionado antes de guardar.",
      "En proyectos Always-On, las plantillas recurrentes definen ciclos y entregables. Verificá frecuencia, alcance y recursos antes de generar un nuevo ciclo para evitar duplicados.",
    ],
    example:
      "Vas a actualizar la calidad del informe de octubre. Seleccionás primero el proyecto y ese entregable, no el informe de septiembre.",
    minutes: 1,
    links: [
      {
        label: "Abrir Cartera de proyectos",
        href: "/active-projects",
      },
    ],
    instructions: [
      "Abrí el proyecto correspondiente y verificá cliente y período.",
      "Seleccioná el entregable antes de editar su información o medición de calidad.",
      "Completá los campos de la medición que corresponda: calidad, indicadores de robustez o NPS. Revisá el elemento seleccionado antes de guardar.",
      "En proyectos Always-On, revisá frecuencia, alcance y recursos de la plantilla recurrente antes de generar un ciclo. Comprobá que no exista ya.",
    ],
    verification:
      "Una medición útil debe quedar asociada al entregable correcto.",
  },
  {
    id: "capacidad-calendario",
    version: 3,
    module: "Operaciones",
    title: "Capacidad y calendario",
    access: {
      audience: "internal",
      any: ["operations"],
    },
    covers: ["/operations/capacity", "/tasks/team-calendar"],
    description: "Coordiná carga, fechas y disponibilidad del equipo.",
    explanation: [
      "En Capacidad elegí la semana y revisá disponibilidad y carga por persona. Considerá ausencias aprobadas y feriados al distribuir trabajo.",
      "En Calendario revisá fechas y responsables de tareas. Ajustar una fecha requiere considerar dependencias y conversar con el equipo.",
      "Una estimación de capacidad sirve para planificar; las horas registradas describen lo que ya se trabajó.",
    ],
    example:
      "Ana tiene una ausencia aprobada el viernes. Revisás su capacidad semanal antes de asignarle una entrega ese día.",
    minutes: 1,
    links: [
      {
        label: "Abrir Capacidad",
        href: "/operations/capacity",
      },
      {
        label: "Abrir Calendario",
        href: "/tasks/team-calendar",
      },
    ],
    instructions: [
      "Entrá a Capacidad y seleccioná la semana que vas a planificar.",
      "Revisá disponibilidad y carga por persona, incluyendo ausencias aprobadas y feriados.",
      "Consultá Calendario para comprobar responsables y fechas de las tareas.",
      "Acordá los ajustes con el equipo y actualizá las fechas considerando dependencias y trabajo ya comprometido.",
    ],
    verification:
      "La planificación debe considerar tanto disponibilidad como trabajo ya comprometido.",
  },
  {
    id: "ausencias-equipo",
    version: 3,
    module: "Operaciones",
    title: "Gestión de ausencias y feriados",
    access: {
      audience: "internal",
      any: ["operations"],
    },
    covers: ["/operations/absences", "/operations/holidays"],
    description:
      "Evaluá solicitudes con sus saldos y efectos sobre la capacidad.",
    explanation: [
      "Abrí Gestión de ausencias y revisá tipo, fechas, saldo y consumo de la solicitud antes de decidir. Vacaciones y días Epical tienen cupos independientes.",
      "Una cancelación solicitada sigue afectando saldo y capacidad hasta confirmarse. Operaciones no puede aprobar una ausencia sin saldo; los adelantos excepcionales de vacaciones requieren un administrador y un motivo.",
      "En Feriados mantené las fechas aplicables. Los feriados configurados afectan los días hábiles que se computan en solicitudes y disponibilidad.",
    ],
    example:
      "Una solicitud consume 3 días y la persona tiene 2. No la aprobás como si hubiera saldo suficiente; revisás la situación con Administración.",
    minutes: 3,
    links: [
      {
        label: "Abrir Gestión de ausencias y feriados",
        href: "/operations/absences",
      },
      {
        label: "Abrir Feriados",
        href: "/operations/holidays",
      },
    ],
    instructions: [
      "Entrá a Gestión de ausencias, seleccioná el año y ubicá la persona y la solicitud que necesitás revisar.",
      "Comprobá tipo, fechas, días hábiles, saldo y cobertura antes de aprobar o rechazar. Vacaciones y días Epical tienen cupos separados; los feriados configurados no consumen días hábiles.",
      "Si una ausencia pendiente o aprobada no se va a tomar, pulsá Cancelar ausencia. Si la persona pidió cancelación, usá Confirmar cancelación. Revisá persona, rango completo y cantidad de días en el diálogo.",
      "Ingresá el motivo y confirmá que ninguno de esos días fue tomado. Si hubo días tomados, revisá las fechas antes de cancelar: no corresponde devolver el período completo. Confirmá la operación una sola vez y esperá el resultado.",
      "Comprobá el estado Cancelada, el motivo y la fecha en el historial de solicitudes. Se recalculan saldo y disponibilidad; una solicitud de cancelación todavía pendiente sigue descontando.",
      "Si el período tiene un cierre financiero, corte de horas o liquidación publicada, coordiná su revisión y reapertura antes de cancelar. Consultá Feriados para validar los días no laborables de la planificación."
    ],
    verification: "La cancelación conserva el registro y su autor. No borra la ausencia ni devuelve días que efectivamente se tomaron; los períodos bloqueados requieren revisión previa.",
  },
  {
    id: "cierre-equipo",
    version: 3,
    module: "Operaciones",
    title: "Cierre del equipo",
    access: {
      audience: "internal",
      any: ["operations"],
    },
    covers: ["/operations/monthly-closing", "/operations/liquidaciones-equipo"],
    description: "Prepará bases y seguí las autorizaciones del mes.",
    explanation: [
      "Elegí el mes compartido por Base a cobrar y Facturación y seguimiento. Revisá horas, tarifas y alertas antes de publicar las bases.",
      "Preparar un borrador no publica ni aprueba importes. Corregí las alertas de tarifas y revisá bonos, adicionales y porcentaje USD antes de publicar.",
      "La persona declara los datos de cada tramo en Mis facturas. Operaciones autoriza los importes; la revisión documental continúa en Facturas equipo para quienes tienen acceso a Finanzas.",
    ],
    example:
      "Falta una tarifa para una persona. Corregís la fuente y volvés a preparar la base antes de publicarla.",
    minutes: 4,
    links: [
      {
        label: "Abrir Cierre del equipo",
        href: "/operations/monthly-closing",
      },
    ],
    instructions: [
      "Entrá a Cierre del equipo y seleccioná el mes compartido por Base a cobrar y Facturación y seguimiento.",
      "En Base a cobrar, prepará los borradores y revisá horas, tarifas y alertas. Corregí la tarifa de origen si falta; la preparación todavía no publica ni autoriza importes.",
      "Comprobá horas de la base, porcentaje USD, bonos y adicionales de cada persona. Publicá únicamente las bases revisadas: la persona recibe un aviso y las ve en Mis facturas.",
      "En Facturación y seguimiento, esperá que la persona envíe los datos del tramo habilitado. En USD declara el TC de conversión; en ARS declara recepción y segundo TC si cobró USD, además de extras nuevos con motivo.",
      "Revisá el importe calculado y sus datos y autorizá el tramo o devolvelo indicando qué corregir. Operaciones autoriza importes; Administración revisa comprobantes en Facturas equipo con acceso a Finanzas.",
      "Después de la autorización, la persona presenta el documento si su modalidad lo exige. Si Administración lo devuelve, la persona reemplaza y reenvía esa presentación. No se crea otro importe ni se duplica la base.",
      "En modalidad mixta, seguí primero USD y después ARS, una vez confirmado el cobro y la aprobación que habilita el segundo tramo. En solo ARS no se exige TC; sin obligación de factura se completan las autorizaciones sin adjuntar comprobantes.",
      "Verificá el estado de cada etapa antes de dar el seguimiento por terminado. Si una base publicada necesita correcciones, revisá el circuito de reapertura y las autorizaciones existentes; preparar otro borrador no sustituye ese control."
    ],
    verification:
      "La preparación genera borradores que deben revisarse antes de publicar.",
  },
  {
    id: "tarifas-servicios",
    version: 3,
    module: "Operaciones",
    title: "Tarifas y servicios",
    access: {
      audience: "internal",
      any: ["operations"],
    },
    covers: [
      "/operations/estimated-rates",
      "/operations/service-blueprints",
      "/operations/portfolio-import",
    ],
    description:
      "Revisá tarifas, recetas de servicios e importación de cartera.",
    explanation: [
      "Tarifas estimadas informa el origen unificado de los valores: Configuración → Personal. La edición requiere acceso a Configuración; si no lo tenés, pedí la revisión a quien administra las tarifas.",
      "En la configuración de servicios, revisá roles, horas y modalidad de las recetas antes de aplicarlas a una cotización. Una receta es un punto de partida que debe ajustarse al alcance real.",
      "En importación de cartera, revisá coincidencias y datos existentes antes de confirmar para evitar duplicados. Usá las acciones disponibles para tu perfil.",
    ],
    example:
      "Una receta mensual no corresponde a un trabajo puntual. Revisás la modalidad y el equipo antes de usarla.",
    minutes: 1,
    links: [
      {
        label: "Abrir Tarifas estimadas",
        href: "/operations/estimated-rates",
      },
      {
        label: "Abrir configuración de servicios",
        href: "/operations/service-blueprints",
      },
      {
        label: "Abrir importación de cartera",
        href: "/operations/portfolio-import",
      },
    ],
    instructions: [
      "Entrá a Tarifas estimadas para consultar el origen de los valores. Para revisarlos o editarlos en Personal, usá el acceso de Configuración si tu cuenta lo tiene habilitado.",
      "Para preparar servicios, abrí su configuración y revisá modalidad, roles y horas de la receta.",
      "Al aplicar una receta a una cotización, ajustá los recursos al alcance real.",
      "Si importás cartera, revisá coincidencias y registros existentes antes de confirmar la importación.",
    ],
    verification:
      "La receta debe corresponder a la modalidad y al alcance del servicio.",
  },
  {
    id: "carga-financiera",
    version: 3,
    module: "Finanzas",
    title: "Cargar datos",
    access: {
      audience: "internal",
      any: ["finance"],
    },
    covers: ["/finance/cargar"],
    description: "Revisá las propuestas de carga antes de contabilizar.",
    explanation: [
      "En Cargar datos ingresá texto, archivos o capturas y seleccioná la entrada para revisar el borrador junto al original.",
      "Confirmá tipo de documento, contraparte, proyecto, moneda, fechas e importes. Revisá advertencias y posibles duplicados antes de contabilizar.",
      "Después de confirmar, consultá los registros vinculados en Resultado de la carga. La extracción asistida requiere tu revisión; no presupongas que todo dato detectado es correcto.",
    ],
    example:
      "Un comprobante dice USD 1.200 y el borrador indica ARS. Corregís moneda e importes con el original antes de confirmar.",
    minutes: 1,
    links: [
      {
        label: "Abrir Cargar datos",
        href: "/finance/cargar",
      },
    ],
    instructions: [
      "Entrá a Cargar datos e ingresá el texto, archivo o captura del documento.",
      "Seleccioná la entrada y compará el borrador con el original.",
      "Corregí tipo de documento, contraparte, proyecto, moneda, fechas e importes. Revisá las advertencias y los posibles duplicados.",
      "Confirmá solo cuando los datos estén revisados. Consultá los registros vinculados en Resultado de la carga.",
    ],
    verification: "La revisión humana precede a la contabilización.",
  },
  {
    id: "facturas-equipo",
    version: 3,
    module: "Finanzas",
    title: "Facturas equipo",
    access: {
      audience: "internal",
      any: ["finance"],
    },
    covers: ["/finance/facturas-equipo"],
    description: "Contrastá documentos e importes autorizados.",
    explanation: [
      "Elegí el período y revisá la factura del equipo contra la liquidación autorizada. Comprobá persona, moneda, importe y archivo.",
      "Si hay diferencias, seguí la acción de revisión correspondiente y dejá el motivo. No apruebes por el solo hecho de que existe un archivo.",
      "La aprobación registra el Pasivo vinculado. Evitá registrar la misma obligación otra vez de forma manual; verificá el vínculo creado.",
    ],
    example:
      "El importe autorizado es ARS 100.000 pero el comprobante dice 110.000. Revisás la diferencia antes de aprobar.",
    minutes: 1,
    links: [
      {
        label: "Abrir Facturas equipo",
        href: "/finance/facturas-equipo",
      },
    ],
    instructions: [
      "Entrá a Facturas equipo y seleccioná el período.",
      "Abrí la factura y comparala con la liquidación autorizada: persona, moneda, importe y archivo.",
      "Si hay diferencias, usá la acción de revisión correspondiente y dejá el motivo para que puedan corregirlas.",
      "Cuando corresponda aprobar, verificá después el Pasivo vinculado. No cargues la misma obligación otra vez de forma manual.",
    ],
    verification:
      "La revisión documental debe contrastar importes y autorización.",
  },
  {
    id: "cierre-financiero",
    version: 3,
    module: "Finanzas",
    title: "Cierre financiero",
    access: {
      audience: "internal",
      any: ["finance"],
    },
    covers: ["/finance/cierre"],
    description: "Ejecutá controles y prepará el período para revisión.",
    explanation: [
      "Elegí el período y ejecutá el pre-cierre. Revisá los controles críticos y advertencias del checklist.",
      "Corregí los datos de origen que causan diferencias y volvé a ejecutar los controles. Cuando corresponda, enviá el período a revisión.",
      "Cerrar y reabrir períodos son acciones reservadas al administrador. Un período cerrado fija su snapshot y restringe cambios retroactivos; la reapertura requiere motivo.",
    ],
    example:
      "El checklist muestra un control crítico pendiente. Corregís la causa antes de pedir el cierre definitivo.",
    minutes: 1,
    links: [
      {
        label: "Abrir Cierre financiero",
        href: "/finance/cierre",
      },
    ],
    instructions: [
      "Entrá a Cierre financiero y elegí el período.",
      "Ejecutá el pre-cierre y revisá los controles críticos y advertencias del checklist.",
      "Corregí los registros de origen y volvé a ejecutar los controles hasta resolver las diferencias.",
      "Enviá el período a revisión cuando corresponda. El cierre definitivo y la reapertura los realiza un administrador.",
    ],
    verification:
      "Los controles deben revisarse antes del cierre definitivo por Administración.",
  },
  {
    id: "cashflow",
    version: 3,
    module: "Finanzas",
    title: "Cashflow",
    access: {
      audience: "internal",
      any: ["finance"],
    },
    covers: ["/finance/cashflow"],
    description: "Revisá movimientos reales y saldos de cuentas.",
    explanation: [
      "Abrí Cashflow y filtrá el período y cuenta que necesitás revisar. Diferenciá un movimiento de dinero de una factura pendiente.",
      "Antes de registrar o conciliar, comprobá fecha, moneda, importe y cuenta contra la evidencia. Una transferencia entre cuentas no es una venta nueva.",
      "Si un cobro o pago ya está vinculado a su documento, revisá esa aplicación antes de cargar otro movimiento.",
    ],
    example:
      "Emitir una factura de ARS 50.000 no significa que el dinero ya ingresó al banco. El cobro se registra cuando ocurre.",
    minutes: 1,
    links: [
      {
        label: "Abrir Cashflow",
        href: "/finance/cashflow",
      },
    ],
    instructions: [
      "Entrá a Cashflow y filtrá por período y cuenta.",
      "Contrastá los movimientos con la evidencia: fecha, moneda, importe y cuenta.",
      "Antes de registrar o conciliar, comprobá si el cobro o pago ya está vinculado a un documento.",
      "Revisá los saldos y las aplicaciones resultantes. Identificá las transferencias entre cuentas para no tratarlas como ventas.",
    ],
    verification: "Facturación y movimiento de dinero son hechos distintos.",
  },
  {
    id: "activo-pasivo",
    version: 3,
    module: "Finanzas",
    title: "Activo y Pasivo",
    access: {
      audience: "internal",
      any: ["finance"],
    },
    covers: ["/finance/activo", "/finance/pasivo"],
    description: "Distinguí cuentas a cobrar, obligaciones y aplicaciones.",
    explanation: [
      "En Activo revisá cuentas a cobrar y activos líquidos. En Pasivo revisá cuentas a pagar y deudas, con sus fechas y saldos.",
      "Un cobro o pago parcial reduce el saldo pendiente del documento al que se aplica; no cambia su importe original.",
      "Antes de aplicar un movimiento, verificá contraparte, documento, moneda e importe. Consultá los vínculos para evitar aplicar dos veces el mismo comprobante.",
    ],
    example:
      "Una factura de ARS 10.000 recibe un cobro parcial de ARS 4.000. Su saldo pendiente queda en ARS 6.000.",
    minutes: 1,
    links: [
      {
        label: "Abrir Activo",
        href: "/finance/activo",
      },
      {
        label: "Abrir Pasivo",
        href: "/finance/pasivo",
      },
    ],
    instructions: [
      "Entrá a Activo para consultar cuentas a cobrar y activos líquidos, o a Pasivo para cuentas a pagar y deudas.",
      "Ubicá el documento y revisá contraparte, moneda, vencimiento y saldo pendiente.",
      "Antes de aplicar un cobro o pago, verificá su importe y los vínculos existentes para evitar duplicados.",
      "Comprobá el saldo resultante. Una aplicación parcial reduce lo pendiente y conserva el importe original del documento.",
    ],
    verification:
      "El saldo pendiente es 10.000 menos 4.000; el importe original de la factura se conserva.",
  },
  {
    id: "provisiones",
    version: 3,
    module: "Finanzas",
    title: "Provisiones",
    access: {
      audience: "internal",
      any: ["finance"],
    },
    covers: ["/finance/provisions"],
    description: "Documentá estimaciones y seguí su resolución.",
    explanation: [
      "Revisá las provisiones del período con su concepto, monto y estado. Una provisión representa una estimación o contingencia que debe seguirse.",
      "Cuando exista el documento o hecho definitivo, revisá cómo se resuelve la provisión y su vínculo para evitar duplicar el efecto económico.",
      "Dejá contexto suficiente para que otra persona pueda entender el motivo de la estimación.",
    ],
    example:
      "Esperás una factura cuyo importe todavía no está confirmado. Registrás el contexto de la estimación y la revisás al recibir el documento definitivo.",
    minutes: 1,
    links: [
      {
        label: "Abrir Provisiones",
        href: "/finance/provisions",
      },
    ],
    instructions: [
      "Entrá a Provisiones y ubicá el período y concepto que necesitás revisar.",
      "Revisá monto, estado y motivo de la estimación; dejá contexto suficiente para entender su origen.",
      "Cuando exista el documento o hecho definitivo, revisá su vínculo con la provisión.",
      "Resolvé la provisión según corresponda y verificá que no quede duplicado el efecto económico.",
    ],
    verification: "La provisión y el documento definitivo deben reconciliarse.",
  },
  {
    id: "reportes",
    version: 3,
    module: "Finanzas",
    title: "Resumen financiero y reportes",
    access: {
      audience: "internal",
      any: ["dashboard", "finance"],
    },
    covers: [
      "/dashboard",
      "/finance/proyeccion",
      "/finance/arr",
      "/finance/rendimiento",
      "/finance/costos",
      "/executive/operativo",
    ],
    description: "Interpretá indicadores usando períodos y bases comparables.",
    explanation: [
      "En Resumen financiero elegí el período y revisá los indicadores junto a su contexto. Proyección compara ejecutado y proyectado; ARR muestra ingreso recurrente anualizado.",
      "Rendimiento permite revisar markup y margen por cliente y proyecto. Son medidas distintas: el markup compara con costo y el margen con ingreso.",
      "En Costos revisá el desglose por concepto, tipo y equipo. Antes de comparar reportes, alineá período, moneda y filtros. Un saldo bancario no equivale a rentabilidad.",
    ],
    example:
      "Un proyecto tiene ingresos de 150 y costos de 100. El resultado es 50: markup 50% sobre costo y margen aproximado 33,3% sobre ingreso.",
    minutes: 1,
    links: [
      {
        label: "Abrir Resumen financiero",
        href: "/dashboard",
      },
      {
        label: "Abrir Proyección",
        href: "/finance/proyeccion",
      },
      {
        label: "Abrir ARR",
        href: "/finance/arr",
      },
      {
        label: "Abrir Rendimiento",
        href: "/finance/rendimiento",
      },
      {
        label: "Abrir Costos",
        href: "/finance/costos",
      },
    ],
    instructions: [
      "Entrá a Resumen financiero y elegí el período.",
      "Para comparar ejecutado y proyectado, consultá Proyección; para ingreso recurrente anualizado, ARR.",
      "Para revisar markup y margen por cliente o proyecto, consultá Rendimiento. Para desglosar conceptos y equipo, consultá Costos.",
      "Antes de comparar resultados, alineá período, moneda y filtros. Abrí el detalle disponible para entender las diferencias.",
    ],
    verification: "Markup usa costo como base; margen usa ingreso.",
  },
  {
    id: "analisis-financiero",
    version: 3,
    module: "Finanzas",
    title: "Análisis por cliente y proyecto",
    access: {
      audience: "internal",
      any: ["finance"],
    },
    covers: [
      "/clients/:id/pnl",
      "/project-analytics/:projectId",
      "/executive/finanzas",
    ],
    description: "Pasá del resultado general al detalle que lo explica.",
    explanation: [
      "Desde los reportes disponibles, abrí el detalle del cliente o proyecto y revisá ingresos, costos y períodos incluidos.",
      "Contrastá los resultados con sus registros de origen. Si hay diferencias entre una vista agregada y un detalle, revisá el alcance y los filtros antes de corregir datos.",
      "Para consultar un detalle, seleccioná un cliente o proyecto existente al que tengas acceso.",
    ],
    example:
      "El resultado de Acme incluye dos proyectos, pero abriste el detalle de uno solo. Alineás el alcance antes de comparar.",
    minutes: 1,
    links: [
      {
        label: "Abrir Rendimiento",
        href: "/finance/rendimiento",
      },
    ],
    instructions: [
      "Abrí el reporte disponible y seleccioná el cliente o proyecto que necesitás analizar.",
      "Revisá qué ingresos, costos y períodos incluye el detalle.",
      "Compará el resultado con los registros de origen usando el mismo alcance, período y filtros.",
      "Si encontrás una diferencia, identificá el registro que la explica antes de modificar datos.",
    ],
    verification: "El resultado de un cliente puede agrupar varios proyectos.",
  },
  {
    id: "administracion",
    version: 3,
    module: "Administración",
    title: "Configuración y usuarios",
    access: {
      audience: "internal",
      any: ["admin"],
    },
    covers: ["/admin", "/admin/users"],
    description: "Mantené usuarios y accesos adecuados a sus tareas.",
    explanation: [
      "En Usuarios buscá la cuenta antes de crear otra. Revisá datos, estado y permisos de las secciones que la persona necesita.",
      "Administrador habilita un acceso amplio. Para accesos específicos, asigná los permisos correspondientes y verificá el menú resultante.",
      "Configuración reúne los maestros de la app. Revisá el impacto de un cambio antes de guardarlo.",
    ],
    example:
      "Una persona solo necesita gestionar tareas y horas sin costos. Usás el permiso Tareas y horas (sin costos), sin agregar accesos financieros.",
    minutes: 1,
    links: [
      {
        label: "Abrir Usuarios",
        href: "/admin/users",
      },
    ],
    instructions: [
      "Entrá a Usuarios y buscá la cuenta antes de crear una nueva.",
      "Revisá sus datos, estado y las funciones que la persona necesita para trabajar.",
      "Asigná los permisos de esas secciones. Para trabajar con tareas sin ver costos, usá Tareas y horas (sin costos).",
      "Guardá y verificá el acceso resultante. Reservá Administrador para quienes necesitan el acceso amplio que habilita.",
    ],
    verification:
      "El perfil de tareas permite trabajar sin habilitar contenidos de costos.",
  },
  {
    id: "personal-tarifas",
    version: 3,
    module: "Administración",
    title: "Personal, roles y tarifas",
    access: {
      audience: "internal",
      any: ["admin"],
    },
    covers: ["/admin"],
    description:
      "Mantené la clasificación y los valores históricos del equipo.",
    explanation: [
      "En Configuración revisá las pestañas Roles y Personal. Buscá la persona existente antes de crear otra y verificá su correo, área, nivel y modalidad contractual.",
      "El valor hora es la fuente del cálculo: para cada moneda, el sueldo mensual se obtiene de tarifa por horas contractuales. ARS y USD se mantienen por separado. Un freelance sin horas contractuales no necesita un sueldo mensual inventado.",
      "Al revisar costos históricos, comprobá el período y las horas mensuales que se conservaron para ese registro. No reemplaces un valor histórico por el vigente solo porque son diferentes.",
    ],
    example:
      "Una persona tiene tarifa ARS 2.000 y 160 horas contractuales. Su importe mensual calculado es ARS 320.000.",
    minutes: 1,
    links: [
      {
        label: "Abrir Configuración",
        href: "/admin",
      },
    ],
    instructions: [
      "Entrá a Configuración y revisá las pestañas Roles y Personal.",
      "Buscá la persona y comprobá correo, área, nivel y modalidad contractual.",
      "Revisá el valor hora y las horas contractuales de cada moneda por separado. El mensual se obtiene multiplicando ambos valores.",
      "Al consultar un costo histórico, usá el período y las horas mensuales conservadas en ese registro.",
    ],
    verification:
      "El mensual surge del valor hora multiplicado por las horas contractuales; cada moneda se calcula por separado.",
  },
  {
    id: "configuracion-precios",
    version: 3,
    module: "Administración",
    title: "Multiplicadores y tipos de cambio",
    access: {
      audience: "internal",
      any: ["admin"],
    },
    covers: ["/admin"],
    description: "Revisá las referencias que intervienen en el presupuesto.",
    explanation: [
      "En Configuración consultá Multiplicadores y Tipos de cambio. Identificá qué parámetro estás modificando y en qué cálculos se usa.",
      "Al cargar una referencia monetaria verificá fecha, par de monedas y valor. Una cotización puede conservar su propio tipo de cambio; cambiar la referencia actual no significa reescribir todos los presupuestos históricos.",
      "Las herramientas de limpieza y las opciones heredadas, cuando están habilitadas, requieren revisar alcance y dependencias antes de confirmar. No son un paso necesario para cargar una nueva tarifa.",
    ],
    example:
      "La referencia de hoy es ARS 1.500 por USD. Una cotización anterior conserva ARS 1.450 por USD: revisás su fecha y snapshot antes de considerarla incorrecta.",
    minutes: 1,
    links: [
      {
        label: "Abrir Configuración",
        href: "/admin",
      },
    ],
    instructions: [
      "Entrá a Configuración y elegí Multiplicadores o Tipos de cambio.",
      "Identificá el parámetro y los cálculos que lo utilizan antes de editarlo.",
      "Para una referencia monetaria, comprobá fecha, par de monedas y valor; después guardá.",
      "Si una cotización muestra otro valor, revisá el tipo de cambio que tiene guardado y su fecha.",
    ],
    verification:
      "Los presupuestos pueden conservar referencias históricas para reproducir sus cálculos.",
  },
  {
    id: "admin-proveedores",
    version: 3,
    module: "Administración",
    title: "Proveedores",
    access: {
      audience: "internal",
      any: ["admin"],
    },
    covers: ["/admin/providers"],
    description: "Asigná acceso externo a proyectos concretos.",
    explanation: [
      "En Proveedores revisá empresa, usuario asociado y estado. El proveedor externo tiene un portal propio con alcance restringido.",
      "Asigná únicamente los proyectos que correspondan y revisá los permisos de cada uno. Cargar horas requiere la habilitación específica y la vinculación a un recurso de personal.",
      "Cuando termina la colaboración, revisá los accesos concedidos. No conviertas una cuenta externa en administradora para resolver una asignación faltante.",
    ],
    example:
      "Un proveedor trabaja solo para Acme. Le asignás ese proyecto y revisás si debe poder cargar horas.",
    minutes: 1,
    links: [
      {
        label: "Abrir Proveedores",
        href: "/admin/providers",
      },
    ],
    instructions: [
      "Entrá a Proveedores y ubicá la empresa y su usuario asociado.",
      "Revisá que el proveedor esté activo y asignale los proyectos que correspondan.",
      "Configurá los permisos de cada proyecto. Para habilitar carga de horas, verificá también el vínculo con un recurso de Personal.",
      "Al terminar una colaboración, revisá y ajustá los accesos concedidos.",
    ],
    verification: "El acceso externo se define por proyecto y capacidad.",
  },
  {
    id: "fuentes-definiciones",
    version: 3,
    module: "Administración",
    title: "Fuentes de datos y definiciones",
    access: {
      audience: "internal",
      any: ["admin"],
    },
    covers: ["/admin/data-sources", "/admin/definitions", "/google-sheets"],
    description:
      "Consultá reglas y verificá el origen antes de reconstruir datos.",
    explanation: [
      "En Definiciones consultá las reglas versionadas de producto para interpretar cálculos y estados.",
      "En Fuentes de datos revisá la fuente de horas, períodos y modo vigente. Cambiar fuentes o reconstruir un período puede afectar resultados; identificá el alcance antes de ejecutar.",
      "Las herramientas de Google Sheets disponibles son parte de la gestión de fuentes. Revisá origen, destino y coincidencias antes de importar; no confundas una importación con una carga operativa cotidiana.",
    ],
    example:
      "Un reporte no coincide con una planilla. Revisás la fuente vigente y las definiciones antes de intentar reconstruir períodos.",
    minutes: 1,
    links: [
      {
        label: "Abrir Definiciones",
        href: "/admin/definitions",
      },
      {
        label: "Abrir Fuentes de datos",
        href: "/admin/data-sources",
      },
      {
        label: "Abrir Google Sheets",
        href: "/google-sheets",
      },
    ],
    instructions: [
      "Consultá Definiciones para identificar la regla vigente del cálculo o estado que estás revisando.",
      "Entrá a Fuentes de datos y comprobá la fuente, período y modo que originan el dato.",
      "Antes de cambiar una fuente o reconstruir un período, identificá qué resultados y registros se verán afectados.",
      "Si usás Google Sheets para importar, revisá origen, destino y coincidencias antes de confirmar.",
    ],
    verification:
      "La regla y la fuente deben estar claras antes de modificar o reconstruir datos.",
  },
  {
    id: "proveedor-panel",
    version: 3,
    module: "Proveedores",
    title: "Mi panel de proveedor",
    access: {
      audience: "provider",
    },
    covers: ["/provider/dashboard"],
    description: "Encontrá tus proyectos asignados y las acciones habilitadas.",
    explanation: [
      "En Mi panel ves los proyectos que te asignaron. Si falta uno, pedí al administrador que revise tu acceso.",
      "Cada proyecto puede habilitar acciones diferentes. Los proyectos cerrados no admiten cambios; no uses otro proyecto para registrar trabajo del que está cerrado.",
      "Desde el panel podés abrir Mis facturas para seguir tus comprobantes.",
    ],
    example:
      "Acme no aparece en tu panel. Solicitás que revisen la asignación antes de intentar cargar trabajo en otro proyecto.",
    minutes: 1,
    links: [
      {
        label: "Abrir Mi panel",
        href: "/provider/dashboard",
      },
    ],
    instructions: [
      "Entrá a Mi panel y ubicá el proyecto que te asignaron.",
      "Revisá las acciones disponibles en ese proyecto; cada asignación puede tener permisos distintos.",
      "Usá Cargar horas solo si está habilitado para el proyecto abierto correspondiente.",
      "Para presentar o seguir comprobantes, abrí Mis facturas desde el panel. Si falta un proyecto o permiso, consultá al administrador.",
    ],
    verification:
      "El administrador debe revisar el acceso al proyecto correcto.",
  },
  {
    id: "proveedor-horas",
    version: 3,
    module: "Proveedores",
    title: "Cargar horas como proveedor",
    access: {
      audience: "provider",
      providerCanLogHours: true,
    },
    covers: ["/provider/dashboard"],
    description: "Registrá tiempo en proyectos abiertos con acceso habilitado.",
    explanation: [
      "En Mi panel ubicá el proyecto y usá Cargar horas cuando esté habilitado. Elegí fecha, horas y descripción del trabajo.",
      "La acción requiere permiso de horas para ese proyecto, que esté abierto y que tu proveedor esté vinculado a personal. Si cambia una de esas condiciones, consultá al administrador.",
      "Registrá solo horas efectivamente trabajadas y verificá que no las hayas cargado antes.",
    ],
    example:
      "Trabajaste 3 horas el 2026-11-12 en el proyecto asignado. Cargás esa fecha y cantidad en ese proyecto.",
    minutes: 1,
    links: [
      {
        label: "Abrir Mi panel",
        href: "/provider/dashboard",
      },
    ],
    instructions: [
      "Entrá a Mi panel, ubicá el proyecto y seleccioná Cargar horas.",
      "Completá fecha, horas efectivamente trabajadas y descripción del trabajo.",
      "Comprobá que elegiste el proyecto correcto y que no habías cargado esas horas.",
      "Seleccioná Guardar horas y verificá la confirmación. Si la acción no está habilitada, pedí al administrador que revise tu asignación y vínculo con Personal.",
    ],
    verification:
      "Fecha y horas deben corresponder al trabajo del proyecto elegido.",
  },
  {
    id: "proveedor-facturas",
    version: 3,
    module: "Proveedores",
    title: "Mis facturas de proveedor",
    access: {
      audience: "provider",
    },
    covers: ["/my-invoices"],
    description: "Revisá el mes y presentá tus comprobantes.",
    explanation: [
      "Abrí Mis facturas y elegí el mes correspondiente. Revisá la información disponible y la etapa habilitada antes de cargar un documento.",
      "Verificá moneda, importe, período y archivo. Si tu cuenta tiene un circuito de autorización, esperá a que la etapa habilite la presentación.",
      "Consultá el estado de la factura y los motivos de devolución. Corregí el comprobante correspondiente en lugar de duplicar una presentación aprobada.",
    ],
    example:
      "Tu comprobante corresponde a octubre. Elegís ese mes y revisás su importe antes de adjuntarlo.",
    minutes: 1,
    links: [
      {
        label: "Abrir Mis facturas",
        href: "/my-invoices",
      },
    ],
    instructions: [
      "Entrá a Mis facturas y elegí el mes al que corresponde el comprobante.",
      "Revisá la etapa habilitada. Si hay un circuito de autorización, esperá a que permita presentar el documento.",
      "Verificá moneda, importe y período, adjuntá el archivo correcto y presentalo cuando esté habilitado.",
      "Consultá el estado y los motivos de devolución. Si requiere una corrección, trabajá sobre esa presentación para evitar duplicados.",
    ],
    verification:
      "El documento debe corresponder al período y a la etapa habilitada.",
  },
];

// Keep archived authorship and progress records for compatibility; never expose
// retired or unvalidated guides through the catalog, media or progress API.
export const archivedTrainingLessons = authoredTrainingLessons.filter(lesson => !isPublishedTrainingGuide(lesson));
export const trainingLessons = authoredTrainingLessons.filter(isPublishedTrainingGuide);

export function publicLesson(lesson: AuthoredLesson): TrainingLesson {
  const { covers: _covers, ...publicFields } = lesson;
  return {
    ...publicFields,
    screenshots: screenshotsForLesson(lesson.id),
    progress: emptyTrainingProgress(),
    needsUpdate: false,
  };
}
