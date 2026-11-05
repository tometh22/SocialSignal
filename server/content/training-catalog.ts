import type {
  TrainingAccess,
  TrainingAnswer,
  TrainingExercise,
  TrainingLesson,
  TrainingStep,
} from "../../shared/training";
import {
  emptyTrainingProgress,
  TRAINING_SECTIONS,
} from "../../shared/training";

export type AuthoredExercise = TrainingExercise & {
  answer: TrainingAnswer;
  feedback: string;
};
export type AuthoredLesson = Omit<
  TrainingLesson,
  "progress" | "needsUpdate" | "practice" | "check"
> & {
  practice: AuthoredExercise;
  check: AuthoredExercise;
  /** Current route patterns covered by this lesson, including secondary screens. */
  covers: string[];
};
const internal: TrainingAccess = {
  audience: "internal",
  any: TRAINING_SECTIONS,
};
const everyone: TrainingAccess = { audience: "authenticated" };
const provider: TrainingAccess = { audience: "provider" };
const section = (
  ...any: NonNullable<TrainingAccess["any"]>
): TrainingAccess => ({ audience: "internal", any });
const tasks = section("projects", "operations", "task_manager");
const portfolio: TrainingAccess = {
  audience: "internal",
  all: ["projects", "operations"],
};
const finance = section("finance");
const reports = section("dashboard", "finance");
const admin = section("admin");
const ops = section("operations");
const quotes = section("quotations");

function choice(
  prompt: string,
  options: string[],
  correct: number,
  feedback: string,
): AuthoredExercise {
  return {
    kind: "choice",
    prompt,
    options: options.map((label, index) => ({ id: `option-${index}`, label })),
    answer: `option-${correct}`,
    feedback,
  };
}
function order(
  prompt: string,
  labels: string[],
  feedback: string,
): AuthoredExercise {
  const items = labels.map((label, index) => ({ id: `item-${index}`, label }));
  return {
    kind: "order",
    prompt,
    items: [...items.slice(1), items[0]],
    answer: items.map((i) => i.id),
    feedback,
  };
}
function form(
  prompt: string,
  fields: Extract<TrainingExercise, { kind: "form" }>["fields"],
  answer: Record<string, string>,
  feedback: string,
): AuthoredExercise {
  return { kind: "form", prompt, fields, answer, feedback };
}
function lesson(
  id: string,
  module: string,
  title: string,
  access: TrainingAccess,
  covers: string[],
  href: string,
  description: string,
  explanation: string[],
  example: string,
  practice: AuthoredExercise,
  check: AuthoredExercise,
): AuthoredLesson {
  return {
    id,
    version: 1,
    module,
    title,
    access,
    covers,
    description,
    explanation,
    example,
    practice,
    check,
    minutes: practice.kind === "form" ? 6 : 4,
    links: [{ label: "Abrir " + title, href }],
  };
}

// Content stays on the server: only authorized, answer-free projections reach the browser.
// Bump an individual lesson's version for substantive changes; retain its stable id.
export const trainingLessons: AuthoredLesson[] = [
  lesson(
    "bienvenida",
    "Primeros pasos",
    "Conocer Mind",
    everyone,
    ["/training", "/training/:lessonId"],
    "/training",
    "Encontrá tu recorrido y practicá a tu ritmo.",
    [
      "El menú muestra las secciones habilitadas para tu cuenta. En el celular, abrilo desde el botón de menú de la barra superior. Si te falta una función necesaria, pedí que revisen tus permisos.",
      "En Capacitación encontrás lecciones por área, duración y avance. Podés buscar una función, continuar una lección o repetirla. Cada práctica usa ejemplos ficticios; solamente se guarda tu avance.",
      "Completá la explicación, resolvé la práctica y respondé la comprobación. Podés corregir tus respuestas todas las veces que necesites. La ayuda de la barra superior vuelve a esta sección.",
    ],
    "Lucía necesita recordar cómo registrar horas. Busca “horas” en Capacitación y abre la lección disponible para su perfil.",
    choice(
      "Querés aprender una función que tenés habilitada. ¿Por dónde empezás?",
      [
        "Crear registros reales para probar",
        "Buscarla en Capacitación",
        "Usar la cuenta de otra persona",
      ],
      1,
      "La búsqueda encuentra las lecciones disponibles para tu cuenta y te permite practicar con ejemplos.",
    ),
    choice(
      "¿Qué modifica una práctica de capacitación?",
      [
        "Los proyectos reales",
        "Los permisos de tu cuenta",
        "Tus respuestas y avance personal",
      ],
      2,
      "Las prácticas solo guardan respuestas y avance; los datos de trabajo no cambian.",
    ),
  ),
  lesson(
    "inicio",
    "Primeros pasos",
    "Inicio",
    internal,
    ["/"],
    "/",
    "Priorizá tu día desde el resumen personal.",
    [
      "Abrí Inicio para revisar tu resumen personal y entrar a las tareas o pendientes que necesitás atender. El contenido depende de tus permisos.",
      "Usá los accesos del resumen para abrir el detalle correspondiente. Ver un pendiente no significa que ya esté resuelto: la acción se completa en su pantalla.",
    ],
    "Tenés una tarea pendiente y una solicitud de ausencia. Abrís cada detalle para conocer su estado antes de actuar.",
    order(
      "Ordená una revisión diaria.",
      [
        "Abrir Inicio",
        "Identificar el pendiente relevante",
        "Abrir su detalle y resolverlo",
      ],
      "Inicio reúne accesos; la resolución ocurre en el detalle del pendiente.",
    ),
    choice(
      "¿Por qué dos personas pueden ver distintos resúmenes?",
      [
        "Porque tienen distintos permisos y pendientes",
        "Porque una perdió todos sus datos",
        "Porque siempre deben ver lo mismo",
      ],
      0,
      "El inicio es personal y respeta el acceso de cada cuenta.",
    ),
  ),
  lesson(
    "notificaciones",
    "Primeros pasos",
    "Notificaciones",
    everyone,
    ["/notifications"],
    "/notifications",
    "Revisá avisos y elegí cómo recibirlos.",
    [
      "Abrí la campana o Notificaciones para ver los avisos propios y acceder a su contexto. Revisá los filtros cuando busques un aviso anterior.",
      "Configurá los canales y categorías disponibles para tu cuenta. Marcar un aviso como leído no aprueba una solicitud ni completa una tarea.",
    ],
    "Recibís un aviso de una solicitud actualizada. Abrís el aviso, revisás la solicitud y después la marcás como leída.",
    choice(
      "Marcaste como leído un aviso sobre una tarea. ¿Qué pasó?",
      [
        "La tarea se completó",
        "La tarea cambió de responsable",
        "Solo cambió el estado de lectura del aviso",
      ],
      2,
      "Lectura y resolución son acciones diferentes.",
    ),
    choice(
      "¿Dónde revisás qué canales usar?",
      [
        "En los permisos de otra persona",
        "En la configuración de notificaciones",
        "En una cotización",
      ],
      1,
      "Las preferencias de notificaciones controlan los canales disponibles para tu cuenta.",
    ),
  ),
  lesson(
    "ausencias-personales",
    "Gestión personal",
    "Mis ausencias",
    internal,
    ["/absences"],
    "/absences",
    "Solicitá días y entendé sus estados y saldos.",
    [
      "Entrá a Mis ausencias, revisá tus saldos y cargá tipo y fechas. Verificá los días computables y el saldo antes de enviar la solicitud.",
      "Una solicitud pendiente todavía espera aprobación. Si cancelás una aprobada, queda una solicitud de cancelación y sigue descontando hasta que se confirme.",
      "Vacaciones y Día Epical tienen saldos separados. Los días hábiles excluyen los feriados configurados; enfermedad y otros no consumen esos cupos.",
    ],
    "Una ausencia aprobada ya no es necesaria. Solicitás su cancelación y esperás la confirmación antes de considerar recuperado el saldo.",
    order(
      "Ordená una solicitud.",
      [
        "Revisar tipo y saldo",
        "Elegir fechas y enviar",
        "Consultar el estado de aprobación",
      ],
      "Revisar saldo y fechas antes del envío evita solicitudes incorrectas.",
    ),
    choice(
      "Pediste cancelar una ausencia aprobada. ¿Cuándo recuperás el saldo?",
      [
        "Al cerrar la pestaña",
        "Cuando se confirma la cancelación",
        "Al enviar el pedido, siempre",
      ],
      1,
      "Mientras la cancelación está solicitada, la ausencia continúa descontando.",
    ),
  ),
  lesson(
    "facturas-personales",
    "Gestión personal",
    "Mis facturas",
    { audience: "internal" },
    ["/my-invoices"],
    "/my-invoices",
    "Seguí tu base, autorizaciones y comprobantes del mes.",
    [
      "Elegí el período y revisá la base publicada por Operaciones. Seguí la etapa habilitada: enviar importe, esperar autorización y cargar el comprobante cuando corresponda a tu modalidad.",
      "Si cobrás una parte en USD, ingresá el TC bancario solicitado para ese tramo. Después del cobro, confirmá recepción y el segundo TC antes de avanzar al tramo ARS. Si tu modalidad es solo ARS, no se exige ese TC.",
      "Revisá los adicionales ya incluidos por Operaciones para no duplicarlos. Agregá únicamente extras nuevos con su motivo. Un importe enviado no equivale a una factura aprobada.",
    ],
    "Operaciones ya incluyó ARS 5.000 de adicionales. Tu reintegro nuevo es ARS 800: declarás solo 800 y explicás el motivo.",
    form(
      "Practicá el caso: adicionales ya incluidos 5.000; reintegro nuevo 800. Completá únicamente el extra nuevo.",
      [{ id: "extra", label: "Extra nuevo (ARS)", type: "number" }],
      { extra: "800" },
      "Los 5.000 ya están incluidos; volver a declararlos duplicaría el adicional.",
    ),
    choice(
      "¿Cuándo cargás el comprobante?",
      [
        "Cuando la etapa esté autorizada y lo requiera tu modalidad",
        "Antes de revisar el importe",
        "En cualquier etapa de cualquier mes",
      ],
      0,
      "La pantalla habilita la carga según autorización, etapa y modalidad documental.",
    ),
  ),
  lesson(
    "crm",
    "Comercial",
    "CRM",
    section("crm"),
    ["/crm", "/crm/:id"],
    "/crm",
    "Mantené oportunidades, actividades y próximos pasos.",
    [
      "Abrí CRM para revisar el pipeline y filtrar oportunidades. Entrá a una oportunidad para consultar sus datos, actividades y recordatorios.",
      "Después de una conversación, registrá la actividad y el próximo paso. Actualizá la etapa según lo que realmente ocurrió, no solo por tener una reunión agendada.",
    ],
    "Acme pidió una propuesta para el viernes. Registrás la conversación y un recordatorio con fecha para preparar el envío.",
    order(
      "Ordená el seguimiento de Acme.",
      [
        "Abrir la oportunidad",
        "Registrar la conversación",
        "Crear el próximo recordatorio con fecha",
      ],
      "El historial explica el contexto y el recordatorio ayuda a sostener el seguimiento.",
    ),
    choice(
      "Agendaste una reunión. ¿Eso confirma una venta?",
      [
        "Sí, siempre",
        "No; actualizá la etapa según el avance real",
        "Sí, si hay un recordatorio",
      ],
      1,
      "Una actividad planificada no reemplaza la confirmación comercial.",
    ),
  ),
  lesson(
    "clientes",
    "Comercial",
    "Clientes",
    section("crm"),
    ["/clients"],
    "/clients",
    "Buscá y mantené la base de clientes.",
    [
      "Antes de agregar un cliente, buscá si ya existe. Revisá nombre y contacto para evitar duplicados.",
      "Mantené los datos de contacto en el cliente correcto. Cuando una pantalla permita asociar un cliente, elegí el registro existente correspondiente.",
    ],
    "Recibís un pedido de Acme y encontrás “Acme SA” con el mismo contacto. Revisás ese registro antes de crear uno nuevo.",
    choice(
      "Encontraste el mismo cliente con una variante del nombre. ¿Qué hacés?",
      [
        "Crearlo otra vez",
        "Borrar los dos registros",
        "Revisar el existente antes de duplicarlo",
      ],
      2,
      "La búsqueda previa evita repartir el historial de un cliente entre registros duplicados.",
    ),
    choice(
      "¿Dónde mantenés el contacto del cliente?",
      [
        "En su ficha de Clientes",
        "En la descripción de una ausencia",
        "En un comentario sin actualizar la ficha",
      ],
      0,
      "La ficha del cliente concentra sus datos de contacto.",
    ),
  ),
  lesson(
    "cotizaciones",
    "Comercial",
    "Cotizaciones",
    quotes,
    [
      "/quotations",
      "/optimized-quote",
      "/optimized-quote/:id",
      "/quotations/:id",
    ],
    "/quotations",
    "Prepará un presupuesto y verificá moneda, equipo y alcance.",
    [
      "Desde Cotizaciones creá o abrí una cotización. Definí cliente, alcance y modalidad; revisá el equipo, roles y horas antes de evaluar el precio.",
      "Verificá moneda y tipo de cambio de la cotización. Las variantes permiten comparar cambios de equipo, horas o configuración; revisá cada resultado.",
      "Guardá el borrador y comprobá su estado. Un borrador todavía no es una aprobación ni una aceptación del cliente. Usá el historial y las acciones disponibles para seguir el proceso comercial.",
    ],
    "Preparás una propuesta en USD. Revisás el TC y las tarifas en la moneda de la cotización antes de comparar dos variantes de alcance.",
    order(
      "Ordená la preparación.",
      [
        "Definir cliente y alcance",
        "Revisar equipo, horas y moneda",
        "Revisar precio y guardar el borrador",
      ],
      "El presupuesto debe partir del alcance y los recursos, con una moneda coherente.",
    ),
    choice(
      "¿Guardar un borrador confirma la aceptación del cliente?",
      ["Sí", "No; son etapas diferentes", "Solo si está en USD"],
      1,
      "El borrador se prepara antes de completar las aprobaciones y la aceptación comercial.",
    ),
  ),
  lesson(
    "propuestas",
    "Comercial",
    "Propuestas y aprobaciones",
    quotes,
    [
      "/quotations/:id/studio",
      "/quotation-groups/:id",
      "/proposal/:token",
      "/proposal-group/:token",
    ],
    "/quotations",
    "Revisá el documento y seguí sus aprobaciones.",
    [
      "Desde el detalle de una cotización abrí el estudio de propuesta para revisar alcance, entregables y documento. En propuestas agrupadas, verificá las opciones que verá el cliente.",
      "La aprobación interna y la aceptación del cliente son etapas distintas. La revisión interna debe hacerla una persona habilitada diferente de quien la solicitó.",
      "Si cambia la propuesta, verificá que la aprobación corresponda a la revisión vigente. Compartí el enlace público solo después de revisar qué información contiene.",
    ],
    "La propuesta tiene aprobación interna, pero todavía no fue aceptada por el cliente. El siguiente paso comercial es enviarla y registrar su respuesta.",
    order(
      "Ordená el circuito habitual.",
      [
        "Revisar la propuesta y solicitar revisión interna",
        "Obtener aprobación interna de la revisión vigente",
        "Enviar al cliente y registrar su aceptación",
      ],
      "La aprobación interna no sustituye la aceptación del cliente.",
    ),
    choice(
      "Cambió el contenido después de la revisión interna. ¿Qué verificás?",
      [
        "Que conserve el mismo precio total",
        "Que el enlace abra",
        "Que la aprobación corresponda a la revisión actual",
      ],
      2,
      "Una aprobación anterior no acredita una revisión nueva.",
    ),
  ),
  lesson(
    "proyectos-tareas",
    "Proyectos y tareas",
    "Proyectos de tareas y kanban",
    tasks,
    ["/tasks/projects", "/tasks/projects/kanban", "/tasks/projects/:id"],
    "/tasks/projects",
    "Ubicá tu proyecto y organizá el trabajo.",
    [
      "Abrí Proyectos de tareas o Mis proyectos para encontrar los proyectos a los que tenés acceso. El kanban reúne su estado operativo; abrí un proyecto para ver sus tareas y miembros.",
      "Dentro del proyecto, usá las secciones para ordenar tareas. Renombrar una sección cambia su organización; no cambia por sí solo la finalización de sus tareas.",
      "Usá los filtros antes de concluir que falta un proyecto. Si no tenés acceso, solicitá que revisen tu asignación.",
    ],
    "Buscás la campaña de Acme. Revisás filtros, abrís el proyecto y ubicás las tareas en su sección correspondiente.",
    choice(
      "Un proyecto no aparece en tu lista. ¿Qué revisás primero?",
      [
        "Filtros y acceso al proyecto",
        "Los saldos bancarios",
        "Eliminás otro proyecto",
      ],
      0,
      "La lista depende de filtros y de los proyectos habilitados para tu cuenta.",
    ),
    choice(
      "Renombrar una sección, ¿finaliza sus tareas?",
      ["Sí, todas", "No, solo cambia la organización", "Solo las subtareas"],
      1,
      "Organización del tablero y finalización de tareas son acciones separadas.",
    ),
  ),
  lesson(
    "tareas",
    "Proyectos y tareas",
    "Tareas y responsables",
    tasks,
    ["/tasks", "/tasks/my-tasks"],
    "/tasks",
    "Definí responsables, fechas y criterios de finalización.",
    [
      "Abrí Tareas y seleccioná una tarea para consultar título, responsable, fechas y detalle. Usá subtareas cuando el trabajo tenga pasos que deban seguirse por separado.",
      "Revisá el responsable y las fechas antes de asignar. Si aparece una advertencia de ausencia, coordiná la cobertura. Un bloqueo debe explicar qué impide avanzar.",
      "Para finalizar una tarea o subtarea, usá su control de completado. El cambio de columna no sustituye ese control. En tareas recurrentes, revisá la próxima ocurrencia creada y sus fechas.",
    ],
    "“Preparar informe” requiere primero revisar datos. Creás una subtarea y, al terminar, marcás su control de completado; la tarea principal se revisa por separado.",
    form(
      "Asigná la tarea ficticia “Revisar datos” a Ana con vencimiento 2026-11-12.",
      [
        { id: "title", label: "Título", type: "text" },
        { id: "assignee", label: "Responsable", type: "text" },
        { id: "due", label: "Vencimiento", type: "date" },
      ],
      { title: "Revisar datos", assignee: "Ana", due: "2026-11-12" },
      "Una tarea clara tiene título, responsable y fecha acordada.",
    ),
    choice(
      "¿Cómo finalizás una tarea?",
      [
        "Renombrando su sección",
        "Arrastrándola a cualquier columna",
        "Usando su control de completado",
      ],
      2,
      "El control de completado registra su finalización. Revisá también las subtareas.",
    ),
  ),
  lesson(
    "horas",
    "Proyectos y tareas",
    "Registrar y revisar horas",
    tasks,
    ["/tasks/hours-dashboard"],
    "/tasks/hours-dashboard",
    "Cargá el tiempo trabajado y comprobá período y proyecto.",
    [
      "Abrí la tarea correspondiente y registrá fecha, horas y descripción del trabajo. Cargá tiempo efectivamente trabajado; una estimación no reemplaza el registro real.",
      "En Mis horas o Panel de horas, elegí el período y proyecto para verificar la carga. El alcance visible depende de tu perfil: el equipo consulta sus horas y Operaciones tiene una vista ampliada.",
      "Si encontrás un error, revisá la entrada original antes de cargar otra para evitar duplicados. Un período cerrado puede requerir intervención de Operaciones.",
    ],
    "Trabajaste 2,5 horas en “Revisar datos” el 12 de noviembre. Registrás 2,5 en esa tarea y fecha, no la estimación de 4 horas.",
    form(
      "Registrá la práctica del ejemplo: 2,5 horas el 2026-11-12.",
      [
        { id: "hours", label: "Horas trabajadas", type: "number" },
        { id: "date", label: "Fecha", type: "date" },
      ],
      { hours: "2.5", date: "2026-11-12" },
      "La carga refleja el tiempo real y la fecha del trabajo, no la estimación.",
    ),
    choice(
      "Ves una carga duplicada. ¿Qué hacés?",
      [
        "Agregar otra entrada negativa sin revisar",
        "Revisar las entradas originales y corregir la que corresponda",
        "Cambiar el nombre del proyecto",
      ],
      1,
      "Revisá primero el origen de ambas cargas para corregir sin duplicar.",
    ),
  ),
  lesson(
    "status",
    "Status y objetivos",
    "Status",
    section("status"),
    ["/review", "/review/:roomId"],
    "/review",
    "Prepará reuniones con novedades, pendientes y decisiones.",
    [
      "Abrí Status y elegí una sala a la que tengas acceso. Revisá los temas y pendientes antes de la reunión.",
      "Dentro de la sala, agregá actualizaciones con contexto suficiente y dejá claras las decisiones y próximos pasos. Diferenciá una novedad informativa de algo que requiere resolución.",
      "Consultá el seguimiento de la sala para retomar acuerdos. Tener permiso de Status no implica pertenecer a todas las salas.",
    ],
    "El cliente pidió un cambio. Registrás qué cambió, qué decisión hace falta y quién debe darle seguimiento.",
    choice(
      "¿Qué actualización ayuda a resolver un bloqueo?",
      [
        "“Hay un problema”",
        "“Ver después”",
        "“Falta aprobación del alcance; Ana la revisa el viernes”",
      ],
      2,
      "Una actualización útil identifica el bloqueo y el próximo paso con responsable.",
    ),
    choice(
      "No aparece una sala. ¿Qué verificás?",
      [
        "Tu acceso a esa sala",
        "La moneda de una factura",
        "El filtro de tareas del calendario",
      ],
      0,
      "Las salas tienen su propio alcance de acceso.",
    ),
  ),
  lesson(
    "objetivos",
    "Status y objetivos",
    "Objetivos",
    ops,
    ["/review/objectives"],
    "/review/objectives",
    "Conectá el plan del año con las acciones de la semana.",
    [
      "Entrá a Objetivos para revisar el plan y su jerarquía. Ubicá el objetivo al que contribuye una acción antes de agregarla o actualizarla.",
      "Mantené responsable, fecha y avance alineados con lo ocurrido. Si se reprograma una acción, registrá la nueva fecha en su seguimiento.",
      "Antes de retirar un elemento, revisá las acciones relacionadas y usá únicamente las acciones habilitadas para tu perfil.",
    ],
    "Una acción se pospone por una dependencia. Actualizás su fecha y explicás el motivo para que la reunión siguiente tenga contexto.",
    order(
      "Ordená una actualización.",
      [
        "Ubicar objetivo y acción",
        "Revisar avance y responsable",
        "Actualizar fecha y contexto del siguiente paso",
      ],
      "La actualización debe conservar la relación entre el objetivo y la acción concreta.",
    ),
    choice(
      "Una acción se atrasó. ¿Qué conviene registrar?",
      ["Un avance ficticio", "Nueva fecha y motivo", "Solo borrar la acción"],
      1,
      "Una reprogramación explícita permite continuar el seguimiento.",
    ),
  ),
  lesson(
    "cartera",
    "Operaciones",
    "Cartera de proyectos",
    portfolio,
    [
      "/active-projects",
      "/active-projects/new",
      "/active-projects/:id",
      "/active-projects/:id/edit",
      "/project-settings/:id",
    ],
    "/active-projects",
    "Administrá proyectos, configuración y estados.",
    [
      "Abrí Cartera de proyectos para revisar la gestión y rentabilidad. Elegí un proyecto para consultar su detalle y configuración.",
      "Al crear o editar, verificá cliente, modalidad, alcance y responsables. Si el proyecto nace de una cotización, comprobá que esté aprobada.",
      "Antes de cerrar o cambiar el estado, revisá trabajo pendiente y registros relacionados. La gestión de cartera requiere los accesos de Proyectos y Operaciones.",
    ],
    "Acme aceptó una propuesta. Revisás que la cotización esté aprobada y creás el proyecto con el alcance acordado.",
    order(
      "Ordená el alta desde una cotización.",
      [
        "Verificar la cotización aprobada",
        "Revisar cliente, alcance y responsables",
        "Crear el proyecto y comprobar su detalle",
      ],
      "El proyecto debe reflejar el acuerdo aprobado.",
    ),
    choice(
      "Antes de cerrar un proyecto, ¿qué revisás?",
      [
        "Solo la fecha de entrega original",
        "Únicamente su nombre",
        "Trabajo y registros pendientes",
      ],
      2,
      "El cierre afecta la operación; revisá pendientes antes de confirmarlo.",
    ),
  ),
  lesson(
    "finanzas-proyecto",
    "Operaciones",
    "Gestión financiera del proyecto",
    portfolio,
    [
      "/active-projects/:id/financial-management",
      "/active-projects/:id/time-entries",
      "/time-entries/project/:projectId",
    ],
    "/active-projects",
    "Contrastá horas, ingresos y costos dentro del proyecto.",
    [
      "Desde Cartera abrí el detalle del proyecto y sus vistas de horas y gestión financiera. Elegí el período correspondiente antes de comparar importes.",
      "Diferenciá estimaciones de registros reales. Revisá origen, moneda y fechas cuando un resultado no coincida con lo esperado.",
      "Corregí el registro de origen que corresponda; no dupliques una carga para forzar el total del reporte.",
    ],
    "El costo de un mes parece alto. Revisás período y horas originales antes de agregar ajustes.",
    choice(
      "Un total no coincide. ¿Qué verificás primero?",
      [
        "Período, moneda y registros de origen",
        "Solo el último total mostrado",
        "Solo el total de la cotización original",
      ],
      0,
      "Los importes deben compararse en el mismo período y moneda y con su fuente identificada.",
    ),
    choice(
      "¿Una estimación equivale a horas reales?",
      [
        "Siempre",
        "No; revisá qué dato muestra cada vista",
        "Solo en proyectos activos",
      ],
      1,
      "Estimaciones y registros reales cumplen funciones distintas.",
    ),
  ),
  lesson(
    "entregables",
    "Proyectos y tareas",
    "Entregables, calidad y recurrencia",
    { audience: "internal", all: ["projects", "operations"] },
    [
      "/client-summary/:clientId",
      "/quality-scores/:clientId",
      "/quarterly-nps/:clientId",
      "/edit-deliverable/:id",
      "/edit-indicators/:id",
      "/always-on-project/:projectId",
      "/recurring-templates/:projectId",
    ],
    "/active-projects",
    "Seguí entregables y mediciones en los proyectos habilitados.",
    [
      "En el proyecto correspondiente, revisá entregables, equipo y métricas. Para editar un entregable, comprobá primero cliente, proyecto y período.",
      "Las puntuaciones de calidad describen el entregable elegido; los indicadores de robustez y la encuesta NPS tienen sus propios campos. Revisá el elemento seleccionado antes de guardar.",
      "En proyectos Always-On, las plantillas recurrentes definen ciclos y entregables. Verificá frecuencia, alcance y recursos antes de generar un nuevo ciclo para evitar duplicados.",
    ],
    "Vas a actualizar la calidad del informe de octubre. Seleccionás primero el proyecto y ese entregable, no el informe de septiembre.",
    order(
      "Ordená una actualización de calidad.",
      [
        "Seleccionar cliente y proyecto",
        "Elegir el entregable correcto",
        "Revisar indicadores y guardar",
      ],
      "Una medición útil debe quedar asociada al entregable correcto.",
    ),
    choice(
      "Antes de generar un ciclo recurrente, ¿qué revisás?",
      [
        "Solo que la plantilla tenga el mismo nombre",
        "Frecuencia, alcance y si el ciclo ya existe",
        "Solo el último ciclo, sin revisar la configuración",
      ],
      1,
      "Revisar configuración y ciclos existentes evita generar trabajo duplicado.",
    ),
  ),
  lesson(
    "capacidad-calendario",
    "Operaciones",
    "Capacidad y calendario",
    ops,
    ["/operations/capacity", "/tasks/team-calendar"],
    "/operations/capacity",
    "Coordiná carga, fechas y disponibilidad del equipo.",
    [
      "En Capacidad elegí la semana y revisá disponibilidad y carga por persona. Considerá ausencias aprobadas y feriados al distribuir trabajo.",
      "En Calendario revisá fechas y responsables de tareas. Ajustar una fecha requiere considerar dependencias y conversar con el equipo.",
      "Una estimación de capacidad sirve para planificar; las horas registradas describen lo que ya se trabajó.",
    ],
    "Ana tiene una ausencia aprobada el viernes. Revisás su capacidad semanal antes de asignarle una entrega ese día.",
    choice(
      "¿Qué dato necesitás antes de asignar una entrega?",
      [
        "Solo el nombre",
        "Disponibilidad, carga y fecha",
        "La cantidad de notificaciones",
      ],
      1,
      "La planificación debe considerar tanto disponibilidad como trabajo ya comprometido.",
    ),
    choice(
      "¿La capacidad planificada reemplaza la carga de horas?",
      [
        "No, planificación y registro real son distintos",
        "Sí, siempre",
        "Solo en semanas con feriados",
      ],
      0,
      "Las horas reales deben seguir registrándose.",
    ),
  ),
  lesson(
    "ausencias-equipo",
    "Operaciones",
    "Gestión de ausencias y feriados",
    ops,
    ["/operations/absences", "/operations/holidays"],
    "/operations/absences",
    "Evaluá solicitudes con sus saldos y efectos sobre la capacidad.",
    [
      "Abrí Gestión de ausencias y revisá tipo, fechas, saldo y consumo de la solicitud antes de decidir. Vacaciones y días Epical tienen cupos independientes.",
      "Una cancelación solicitada sigue afectando saldo y capacidad hasta confirmarse. Operaciones no puede aprobar una ausencia sin saldo; los adelantos excepcionales de vacaciones requieren un administrador y un motivo.",
      "En Feriados mantené las fechas aplicables. Los feriados configurados afectan los días hábiles que se computan en solicitudes y disponibilidad.",
    ],
    "Una solicitud consume 3 días y la persona tiene 2. No la aprobás como si hubiera saldo suficiente; revisás la situación con Administración.",
    form(
      "Saldo disponible 5 días; solicitud 2 días hábiles. ¿Cuántos quedarían?",
      [{ id: "balance", label: "Saldo restante", type: "number" }],
      { balance: "3" },
      "El saldo quedaría en 3 días, siempre que corresponda al mismo tipo y año.",
    ),
    choice(
      "¿Una cancelación solicitada ya devuelve el saldo?",
      ["Sí", "Solo al cambiar el mes", "No, falta confirmarla"],
      2,
      "Hasta la confirmación sigue afectando saldo y capacidad.",
    ),
  ),
  lesson(
    "cierre-equipo",
    "Operaciones",
    "Cierre del equipo",
    ops,
    ["/operations/monthly-closing", "/operations/liquidaciones-equipo"],
    "/operations/monthly-closing",
    "Prepará bases y seguí las autorizaciones del mes.",
    [
      "Elegí el mes compartido por Base a cobrar y Facturación y seguimiento. Revisá horas, tarifas y alertas antes de publicar las bases.",
      "Preparar un borrador no publica ni aprueba importes. Corregí las alertas de tarifas y revisá bonos, adicionales y porcentaje USD antes de publicar.",
      "La persona declara los datos de cada tramo en Mis facturas. Operaciones autoriza los importes; la revisión documental continúa en Facturas equipo para quienes tienen acceso a Finanzas.",
    ],
    "Falta una tarifa para una persona. Corregís la fuente y volvés a preparar la base antes de publicarla.",
    order(
      "Ordená el cierre operativo.",
      [
        "Elegir el mes y preparar bases",
        "Resolver alertas y revisar importes",
        "Publicar bases y seguir autorizaciones",
      ],
      "La preparación genera borradores que deben revisarse antes de publicar.",
    ),
    choice(
      "¿Preparar bases autoriza automáticamente todas las facturas?",
      ["No, son etapas separadas", "Sí", "Solo para USD"],
      0,
      "Preparación, publicación, autorización y revisión documental son etapas distintas.",
    ),
  ),
  lesson(
    "tarifas-servicios",
    "Operaciones",
    "Tarifas y servicios",
    ops,
    [
      "/operations/estimated-rates",
      "/operations/service-blueprints",
      "/operations/portfolio-import",
    ],
    "/operations/estimated-rates",
    "Revisá tarifas, recetas de servicios e importación de cartera.",
    [
      "Consultá Tarifas estimadas para revisar la base de planificación. Verificá moneda y período antes de usar un valor como referencia.",
      "En la configuración de servicios, revisá roles, horas y modalidad de las recetas antes de aplicarlas a una cotización. Una receta es un punto de partida que debe ajustarse al alcance real.",
      "En importación de cartera, revisá coincidencias y datos existentes antes de confirmar para evitar duplicados. Usá las acciones disponibles para tu perfil.",
    ],
    "Una receta mensual no corresponde a un trabajo puntual. Revisás la modalidad y el equipo antes de usarla.",
    choice(
      "¿Qué revisás al aplicar una receta?",
      [
        "Solo su nombre",
        "Modalidad, roles y horas frente al alcance real",
        "La foto del cliente",
      ],
      1,
      "La receta debe corresponder a la modalidad y al alcance del servicio.",
    ),
    choice(
      "Antes de importar cartera, ¿qué comprobás?",
      [
        "Si los registros ya existen",
        "Solo la cantidad de filas del archivo",
        "Si hay notificaciones sin leer",
      ],
      0,
      "Revisar coincidencias evita duplicar proyectos.",
    ),
  ),
  lesson(
    "carga-financiera",
    "Finanzas",
    "Cargar datos",
    finance,
    ["/finance/cargar"],
    "/finance/cargar",
    "Revisá las propuestas de carga antes de contabilizar.",
    [
      "En Cargar datos ingresá texto, archivos o capturas y seleccioná la entrada para revisar el borrador junto al original.",
      "Confirmá tipo de documento, contraparte, proyecto, moneda, fechas e importes. Revisá advertencias y posibles duplicados antes de contabilizar.",
      "Después de confirmar, consultá los registros vinculados en Resultado de la carga. La extracción asistida requiere tu revisión; no presupongas que todo dato detectado es correcto.",
    ],
    "Un comprobante dice USD 1.200 y el borrador indica ARS. Corregís moneda e importes con el original antes de confirmar.",
    order(
      "Ordená una carga.",
      [
        "Ingresar el documento",
        "Comparar borrador con original y corregir",
        "Confirmar y revisar registros vinculados",
      ],
      "La revisión humana precede a la contabilización.",
    ),
    choice(
      "La extracción detectó una moneda incorrecta. ¿Qué hacés?",
      [
        "Confirmar igual",
        "Subir diez copias",
        "Corregir el borrador contra el original",
      ],
      2,
      "El documento original permite validar y corregir el borrador.",
    ),
  ),
  lesson(
    "facturas-equipo",
    "Finanzas",
    "Facturas equipo",
    finance,
    ["/finance/facturas-equipo"],
    "/finance/facturas-equipo",
    "Contrastá documentos e importes autorizados.",
    [
      "Elegí el período y revisá la factura del equipo contra la liquidación autorizada. Comprobá persona, moneda, importe y archivo.",
      "Si hay diferencias, seguí la acción de revisión correspondiente y dejá el motivo. No apruebes por el solo hecho de que existe un archivo.",
      "La aprobación registra el Pasivo vinculado. Evitá registrar la misma obligación otra vez de forma manual; verificá el vínculo creado.",
    ],
    "El importe autorizado es ARS 100.000 pero el comprobante dice 110.000. Revisás la diferencia antes de aprobar.",
    choice(
      "Hay una diferencia entre factura y autorización. ¿Qué hacés?",
      [
        "Aprobar automáticamente",
        "Revisar y resolver la diferencia",
        "Duplicar el Pasivo",
      ],
      1,
      "La revisión documental debe contrastar importes y autorización.",
    ),
    choice(
      "La aprobación ya generó un Pasivo. ¿Creás otro por la misma factura?",
      [
        "No; verifico el registro vinculado",
        "Sí, para asegurarme",
        "Solo si está en ARS",
      ],
      0,
      "Duplicar la obligación distorsiona el saldo a pagar.",
    ),
  ),
  lesson(
    "cierre-financiero",
    "Finanzas",
    "Cierre financiero",
    finance,
    ["/finance/cierre"],
    "/finance/cierre",
    "Ejecutá controles y prepará el período para revisión.",
    [
      "Elegí el período y ejecutá el pre-cierre. Revisá los controles críticos y advertencias del checklist.",
      "Corregí los datos de origen que causan diferencias y volvé a ejecutar los controles. Cuando corresponda, enviá el período a revisión.",
      "Cerrar y reabrir períodos son acciones reservadas al administrador. Un período cerrado fija su snapshot y restringe cambios retroactivos; la reapertura requiere motivo.",
    ],
    "El checklist muestra un control crítico pendiente. Corregís la causa antes de pedir el cierre definitivo.",
    order(
      "Ordená el trabajo previo al cierre.",
      [
        "Ejecutar pre-cierre",
        "Resolver controles pendientes y volver a comprobar",
        "Enviar a revisión",
      ],
      "Los controles deben revisarse antes del cierre definitivo por Administración.",
    ),
    choice(
      "¿Quién puede cerrar o reabrir el período?",
      [
        "Cualquier usuario autenticado",
        "Cualquier proveedor",
        "Un administrador habilitado",
      ],
      2,
      "La pantalla reserva esas acciones al administrador.",
    ),
  ),
  lesson(
    "cashflow",
    "Finanzas",
    "Cashflow",
    finance,
    ["/finance/cashflow"],
    "/finance/cashflow",
    "Revisá movimientos reales y saldos de cuentas.",
    [
      "Abrí Cashflow y filtrá el período y cuenta que necesitás revisar. Diferenciá un movimiento de dinero de una factura pendiente.",
      "Antes de registrar o conciliar, comprobá fecha, moneda, importe y cuenta contra la evidencia. Una transferencia entre cuentas no es una venta nueva.",
      "Si un cobro o pago ya está vinculado a su documento, revisá esa aplicación antes de cargar otro movimiento.",
    ],
    "Emitir una factura de ARS 50.000 no significa que el dinero ya ingresó al banco. El cobro se registra cuando ocurre.",
    choice(
      "Emitiste una factura todavía impaga. ¿Ya hubo un ingreso bancario?",
      ["Sí", "No, falta el cobro", "Depende del nombre del cliente"],
      1,
      "Facturación y movimiento de dinero son hechos distintos.",
    ),
    choice(
      "¿Qué verificás para un movimiento?",
      [
        "Fecha, moneda, importe y cuenta",
        "Solo la descripción",
        "Solo el día de carga",
      ],
      0,
      "La evidencia y la cuenta correcta son esenciales para interpretar el saldo.",
    ),
  ),
  lesson(
    "activo-pasivo",
    "Finanzas",
    "Activo y Pasivo",
    finance,
    ["/finance/activo", "/finance/pasivo"],
    "/finance/activo",
    "Distinguí cuentas a cobrar, obligaciones y aplicaciones.",
    [
      "En Activo revisá cuentas a cobrar y activos líquidos. En Pasivo revisá cuentas a pagar y deudas, con sus fechas y saldos.",
      "Un cobro o pago parcial reduce el saldo pendiente del documento al que se aplica; no cambia su importe original.",
      "Antes de aplicar un movimiento, verificá contraparte, documento, moneda e importe. Consultá los vínculos para evitar aplicar dos veces el mismo comprobante.",
    ],
    "Una factura de ARS 10.000 recibe un cobro parcial de ARS 4.000. Su saldo pendiente queda en ARS 6.000.",
    form(
      "Factura 10.000, cobro aplicado 4.000. Calculá el saldo pendiente.",
      [{ id: "balance", label: "Saldo pendiente (ARS)", type: "number" }],
      { balance: "6000" },
      "El saldo pendiente es 10.000 menos 4.000; el importe original de la factura se conserva.",
    ),
    choice(
      "Una factura de proveedor pendiente corresponde a…",
      ["Una tarea", "Un aviso personal", "Una obligación en Pasivo"],
      2,
      "Pasivo permite seguir obligaciones y deudas a pagar.",
    ),
  ),
  lesson(
    "provisiones",
    "Finanzas",
    "Provisiones",
    finance,
    ["/finance/provisions"],
    "/finance/provisions",
    "Documentá estimaciones y seguí su resolución.",
    [
      "Revisá las provisiones del período con su concepto, monto y estado. Una provisión representa una estimación o contingencia que debe seguirse.",
      "Cuando exista el documento o hecho definitivo, revisá cómo se resuelve la provisión y su vínculo para evitar duplicar el efecto económico.",
      "Dejá contexto suficiente para que otra persona pueda entender el motivo de la estimación.",
    ],
    "Esperás una factura cuyo importe todavía no está confirmado. Registrás el contexto de la estimación y la revisás al recibir el documento definitivo.",
    choice(
      "Llega el documento definitivo de un gasto provisionado. ¿Qué revisás?",
      [
        "Cómo resolver la provisión sin duplicar el gasto",
        "Solo el estado del documento, sin revisar la provisión",
        "Solo si se cargó durante el mismo mes",
      ],
      0,
      "La provisión y el documento definitivo deben reconciliarse.",
    ),
    choice(
      "¿Qué ayuda a revisar una provisión?",
      [
        "Un título genérico sin fecha",
        "Concepto, período, importe y motivo",
        "Únicamente quién abrió la pantalla",
      ],
      1,
      "El contexto permite evaluar y seguir la estimación.",
    ),
  ),
  lesson(
    "reportes",
    "Finanzas",
    "Resumen financiero y reportes",
    reports,
    [
      "/dashboard",
      "/finance/proyeccion",
      "/finance/arr",
      "/finance/rendimiento",
      "/finance/costos",
      "/executive/operativo",
    ],
    "/dashboard",
    "Interpretá indicadores usando períodos y bases comparables.",
    [
      "En Resumen financiero elegí el período y revisá los indicadores junto a su contexto. Proyección compara ejecutado y proyectado; ARR muestra ingreso recurrente anualizado.",
      "Rendimiento permite revisar markup y margen por cliente y proyecto. Son medidas distintas: el markup compara con costo y el margen con ingreso.",
      "En Costos revisá el desglose por concepto, tipo y equipo. Antes de comparar reportes, alineá período, moneda y filtros. Un saldo bancario no equivale a rentabilidad.",
    ],
    "Un proyecto tiene ingresos de 150 y costos de 100. El resultado es 50: markup 50% sobre costo y margen aproximado 33,3% sobre ingreso.",
    choice(
      "¿Por qué markup y margen pueden diferir?",
      [
        "Porque siempre hay un error",
        "Porque usan distintas bases de comparación",
        "Porque margen siempre significa cobros y markup significa facturas",
      ],
      1,
      "Markup usa costo como base; margen usa ingreso.",
    ),
    choice(
      "Antes de comparar dos reportes, ¿qué alineás?",
      [
        "Período, moneda y filtros",
        "Solo el total, aunque cambie la moneda",
        "Solo que ambos incluyan el mismo cliente",
      ],
      0,
      "Una comparación requiere las mismas condiciones.",
    ),
  ),
  lesson(
    "analisis-financiero",
    "Finanzas",
    "Análisis por cliente y proyecto",
    finance,
    [
      "/clients/:id/pnl",
      "/project-analytics/:projectId",
      "/executive/finanzas",
    ],
    "/finance/rendimiento",
    "Pasá del resultado general al detalle que lo explica.",
    [
      "Desde los reportes disponibles, abrí el detalle del cliente o proyecto y revisá ingresos, costos y períodos incluidos.",
      "Contrastá los resultados con sus registros de origen. Si hay diferencias entre una vista agregada y un detalle, revisá el alcance y los filtros antes de corregir datos.",
      "Los enlaces al detalle requieren una entidad existente a la que tengas acceso. La capacitación usa ejemplos, sin elegir un cliente real por vos.",
    ],
    "El resultado de Acme incluye dos proyectos, pero abriste el detalle de uno solo. Alineás el alcance antes de comparar.",
    choice(
      "Un total de cliente supera el de un proyecto. ¿Qué revisás?",
      [
        "Solo el nombre comercial del cliente",
        "Si ambos incluyen los mismos proyectos y período",
        "Solo la hora del día",
      ],
      1,
      "El resultado de un cliente puede agrupar varios proyectos.",
    ),
    choice(
      "Encontrás una diferencia real. ¿Dónde investigás?",
      [
        "En los registros de origen y sus vínculos",
        "Cambiando el título del gráfico",
        "En un total de otro período, sin revisar sus fuentes",
      ],
      0,
      "El detalle y sus fuentes explican el resultado.",
    ),
  ),
  lesson(
    "administracion",
    "Administración",
    "Configuración y usuarios",
    admin,
    ["/admin", "/admin/users"],
    "/admin/users",
    "Mantené usuarios y accesos adecuados a sus tareas.",
    [
      "En Usuarios buscá la cuenta antes de crear otra. Revisá datos, estado y permisos de las secciones que la persona necesita.",
      "Administrador habilita un acceso amplio. Para accesos específicos, asigná los permisos correspondientes y verificá el menú resultante.",
      "Configuración reúne los maestros de la app. Revisá el impacto de un cambio antes de guardarlo; no uses datos de producción para practicar.",
    ],
    "Una persona solo necesita gestionar tareas y horas sin costos. Usás el permiso Tareas y horas (sin costos), sin agregar accesos financieros.",
    choice(
      "¿Qué permiso corresponde al caso del ejemplo?",
      ["Administrador", "Finanzas", "Tareas y horas (sin costos)"],
      2,
      "El perfil de tareas permite trabajar sin habilitar contenidos de costos.",
    ),
    choice(
      "Antes de crear una cuenta, ¿qué revisás?",
      [
        "Si el usuario ya existe y qué acceso necesita",
        "Solo si tiene proyectos asignados",
        "Las facturas de otro mes",
      ],
      0,
      "Evitar duplicados y ajustar permisos simplifica el acceso y la gestión.",
    ),
  ),
  lesson(
    "personal-tarifas",
    "Administración",
    "Personal, roles y tarifas",
    admin,
    ["/admin"],
    "/admin",
    "Mantené la clasificación y los valores históricos del equipo.",
    [
      "En Configuración revisá las pestañas Roles y Personal. Buscá la persona existente antes de crear otra y verificá su correo, área, nivel y modalidad contractual.",
      "El valor hora es la fuente del cálculo: para cada moneda, el sueldo mensual se obtiene de tarifa por horas contractuales. ARS y USD se mantienen por separado. Un freelance sin horas contractuales no necesita un sueldo mensual inventado.",
      "Al revisar costos históricos, comprobá el período y las horas mensuales que se conservaron para ese registro. No reemplaces un valor histórico por el vigente solo porque son diferentes.",
    ],
    "Una persona tiene tarifa ARS 2.000 y 160 horas contractuales. Su importe mensual calculado es ARS 320.000.",
    form(
      "Calculá el mensual del ejemplo: 2.000 por hora × 160 horas.",
      [{ id: "monthly", label: "Mensual calculado (ARS)", type: "number" }],
      { monthly: "320000" },
      "El mensual surge del valor hora multiplicado por las horas contractuales; cada moneda se calcula por separado.",
    ),
    choice(
      "Una tarifa histórica difiere de la actual. ¿Qué verificás?",
      [
        "El período y la información conservada en el histórico",
        "Solo el nombre de la persona",
        "La reemplazo sin revisar",
      ],
      0,
      "Los históricos describen su período y deben conservar sus datos de cálculo.",
    ),
  ),
  lesson(
    "configuracion-precios",
    "Administración",
    "Multiplicadores y tipos de cambio",
    admin,
    ["/admin"],
    "/admin",
    "Revisá las referencias que intervienen en el presupuesto.",
    [
      "En Configuración consultá Multiplicadores y Tipos de cambio. Identificá qué parámetro estás modificando y en qué cálculos se usa.",
      "Al cargar una referencia monetaria verificá fecha, par de monedas y valor. Una cotización puede conservar su propio tipo de cambio; cambiar la referencia actual no significa reescribir todos los presupuestos históricos.",
      "Las herramientas de limpieza y las opciones heredadas, cuando están habilitadas, requieren revisar alcance y dependencias antes de confirmar. No son un paso necesario para cargar una nueva tarifa.",
    ],
    "La referencia de hoy es ARS 1.500 por USD. Una cotización anterior conserva ARS 1.450 por USD: revisás su fecha y snapshot antes de considerarla incorrecta.",
    choice(
      "Una cotización conserva otro TC. ¿Qué revisás?",
      ["Su fecha y el tipo de cambio guardado", "Solo el título", "La elimino"],
      0,
      "Los presupuestos pueden conservar referencias históricas para reproducir sus cálculos.",
    ),
    choice(
      "Antes de cambiar un multiplicador, ¿qué verificás?",
      [
        "Solo el nombre del usuario",
        "Qué cálculo afecta y el valor correcto",
        "Las ausencias de la semana",
      ],
      1,
      "El parámetro debe modificarse conociendo su efecto sobre el presupuesto.",
    ),
  ),
  lesson(
    "admin-proveedores",
    "Administración",
    "Proveedores",
    admin,
    ["/admin/providers"],
    "/admin/providers",
    "Asigná acceso externo a proyectos concretos.",
    [
      "En Proveedores revisá empresa, usuario asociado y estado. El proveedor externo tiene un portal propio con alcance restringido.",
      "Asigná únicamente los proyectos que correspondan y revisá los permisos de cada uno. Cargar horas requiere la habilitación específica y la vinculación a un recurso de personal.",
      "Cuando termina la colaboración, revisá los accesos concedidos. No conviertas una cuenta externa en administradora para resolver una asignación faltante.",
    ],
    "Un proveedor trabaja solo para Acme. Le asignás ese proyecto y revisás si debe poder cargar horas.",
    order(
      "Ordená una habilitación externa.",
      [
        "Revisar proveedor y usuario",
        "Asignar el proyecto correspondiente",
        "Verificar permisos específicos y vínculo de personal",
      ],
      "El acceso externo se define por proyecto y capacidad.",
    ),
    choice(
      "¿El proveedor recibe acceso a toda la cartera?",
      ["Sí", "No, solo a los proyectos asignados", "Solo si tiene una factura"],
      1,
      "El portal de proveedores usa asignaciones explícitas.",
    ),
  ),
  lesson(
    "fuentes-definiciones",
    "Administración",
    "Fuentes de datos y definiciones",
    admin,
    ["/admin/data-sources", "/admin/definitions", "/google-sheets"],
    "/admin/definitions",
    "Consultá reglas y verificá el origen antes de reconstruir datos.",
    [
      "En Definiciones consultá las reglas versionadas de producto para interpretar cálculos y estados.",
      "En Fuentes de datos revisá la fuente de horas, períodos y modo vigente. Cambiar fuentes o reconstruir un período puede afectar resultados; identificá el alcance antes de ejecutar.",
      "Las herramientas de Google Sheets disponibles son parte de la gestión de fuentes. Revisá origen, destino y coincidencias antes de importar; no confundas una importación con una carga operativa cotidiana.",
    ],
    "Un reporte no coincide con una planilla. Revisás la fuente vigente y las definiciones antes de intentar reconstruir períodos.",
    order(
      "Ordená la investigación.",
      [
        "Consultar la regla vigente",
        "Identificar fuente y período del dato",
        "Evaluar la corrección y su alcance",
      ],
      "La regla y la fuente deben estar claras antes de modificar o reconstruir datos.",
    ),
    choice(
      "¿Reconstruir un período es una forma segura de probar sin impacto?",
      [
        "Sí",
        "Sí, mientras el período sea anterior al actual",
        "No; puede cambiar resultados y requiere revisar el alcance",
      ],
      2,
      "Las prácticas se hacen en Capacitación; una reconstrucción opera sobre datos reales.",
    ),
  ),
  lesson(
    "proveedor-panel",
    "Proveedores",
    "Mi panel de proveedor",
    provider,
    ["/provider/dashboard"],
    "/provider/dashboard",
    "Encontrá tus proyectos asignados y las acciones habilitadas.",
    [
      "En Mi panel ves los proyectos que te asignaron. Si falta uno, pedí al administrador que revise tu acceso.",
      "Cada proyecto puede habilitar acciones diferentes. Los proyectos cerrados no admiten cambios; no uses otro proyecto para registrar trabajo del que está cerrado.",
      "Desde el panel podés abrir Mis facturas para seguir tus comprobantes.",
    ],
    "Acme no aparece en tu panel. Solicitás que revisen la asignación antes de intentar cargar trabajo en otro proyecto.",
    choice(
      "No aparece un proyecto necesario. ¿Qué hacés?",
      [
        "Cargar las horas en cualquier otro",
        "Pedir que revisen tu asignación",
        "Cambiar de cuenta sin autorización",
      ],
      1,
      "El administrador debe revisar el acceso al proyecto correcto.",
    ),
    choice(
      "Un proyecto está cerrado. ¿Admite nuevas cargas?",
      [
        "No; consultá al equipo responsable",
        "Sí, siempre",
        "Solo cambiando la fecha del navegador",
      ],
      0,
      "El cierre restringe modificaciones.",
    ),
  ),
  lesson(
    "proveedor-horas",
    "Proveedores",
    "Cargar horas como proveedor",
    { audience: "provider", providerCanLogHours: true },
    ["/provider/dashboard"],
    "/provider/dashboard",
    "Registrá tiempo en proyectos abiertos con acceso habilitado.",
    [
      "En Mi panel ubicá el proyecto y usá Cargar horas cuando esté habilitado. Elegí fecha, horas y descripción del trabajo.",
      "La acción requiere permiso de horas para ese proyecto, que esté abierto y que tu proveedor esté vinculado a personal. Si cambia una de esas condiciones, consultá al administrador.",
      "Registrá solo horas efectivamente trabajadas y verificá que no las hayas cargado antes.",
    ],
    "Trabajaste 3 horas el 2026-11-12 en el proyecto asignado. Cargás esa fecha y cantidad en ese proyecto.",
    form(
      "Practicá la carga del ejemplo.",
      [
        { id: "hours", label: "Horas trabajadas", type: "number" },
        { id: "date", label: "Fecha", type: "date" },
      ],
      { hours: "3", date: "2026-11-12" },
      "Fecha y horas deben corresponder al trabajo del proyecto elegido.",
    ),
    choice(
      "Tenés dos proyectos, pero solo uno habilita horas. ¿Dónde podés cargarlas?",
      [
        "En ambos",
        "En cualquier proyecto cerrado",
        "Solo en el habilitado, para trabajo de ese proyecto",
      ],
      2,
      "La habilitación es específica por proyecto.",
    ),
  ),
  lesson(
    "proveedor-facturas",
    "Proveedores",
    "Mis facturas de proveedor",
    provider,
    ["/my-invoices"],
    "/my-invoices",
    "Revisá el mes y presentá tus comprobantes.",
    [
      "Abrí Mis facturas y elegí el mes correspondiente. Revisá la información disponible y la etapa habilitada antes de cargar un documento.",
      "Verificá moneda, importe, período y archivo. Si tu cuenta tiene un circuito de autorización, esperá a que la etapa habilite la presentación.",
      "Consultá el estado de la factura y los motivos de devolución. Corregí el comprobante correspondiente en lugar de duplicar una presentación aprobada.",
    ],
    "Tu comprobante corresponde a octubre. Elegís ese mes y revisás su importe antes de adjuntarlo.",
    order(
      "Ordená una presentación.",
      [
        "Elegir el mes y revisar la etapa",
        "Verificar moneda, importe y comprobante",
        "Presentar cuando esté habilitado y seguir el estado",
      ],
      "El documento debe corresponder al período y a la etapa habilitada.",
    ),
    choice(
      "Una factura fue devuelta. ¿Qué revisás primero?",
      [
        "El motivo de devolución",
        "El menú de otra cuenta",
        "Si el nombre del archivo coincide, sin revisar el documento",
      ],
      0,
      "El motivo indica qué corregir en esa presentación.",
    ),
  ),
];

export function publicExercise(exercise: AuthoredExercise): TrainingExercise {
  const { answer: _answer, feedback: _feedback, ...publicFields } = exercise;
  return publicFields;
}
export function publicLesson(lesson: AuthoredLesson): TrainingLesson {
  const { covers: _covers, practice, check, ...publicFields } = lesson;
  return {
    ...publicFields,
    practice: publicExercise(practice),
    check: publicExercise(check),
    progress: emptyTrainingProgress(),
    needsUpdate: false,
  };
}
const normalize = (text: string) =>
  text.trim().normalize("NFC").toLocaleLowerCase("es-AR").replace(/\s+/g, " ");
export function gradeTrainingAnswer(
  lesson: AuthoredLesson,
  step: TrainingStep,
  answer?: TrainingAnswer,
) {
  if (step === "learn")
    return {
      correct: true,
      explanation: "Explicación completada. Ahora practicá con el ejemplo.",
    };
  const exercise = lesson[step];
  let correct = false;
  if (exercise.kind === "choice")
    correct = typeof answer === "string" && answer === exercise.answer;
  if (exercise.kind === "order")
    correct =
      Array.isArray(answer) &&
      JSON.stringify(answer) === JSON.stringify(exercise.answer);
  if (
    exercise.kind === "form" &&
    answer &&
    typeof answer === "object" &&
    !Array.isArray(answer)
  ) {
    const expected = exercise.answer as Record<string, string>;
    correct = exercise.fields.every((field) => {
      const value = answer[field.id];
      if (typeof value !== "string" || !value.trim()) return false;
      return field.type === "number"
        ? Number(value.replace(",", ".")) === Number(expected[field.id])
        : normalize(value) === normalize(expected[field.id]);
    });
  }
  return { correct, explanation: exercise.feedback };
}
