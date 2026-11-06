import type { TrainingScreenshot } from "../../shared/training";

export type AuthoredTrainingScreenshot = Omit<TrainingScreenshot, "src"> & {
  fileName: string;
};
// Real screenshots captured in the isolated local app, with seeded example data.
// Files are served by the authenticated training route, never as public assets.
export const trainingScreenshots: Record<string, AuthoredTrainingScreenshot[]> =
  {
    bienvenida: [
      {
        id: "referencia",
        fileName: "bienvenida.jpg",
        alt: "Búsqueda y filtro de Capacitación",
        caption:
          "Escribí una función en el buscador o elegí un área. Los resultados dependen de tus permisos.",
        step: 3,
        width: 1176,
        height: 240,
      },
    ],
    inicio: [
      {
        id: "referencia",
        fileName: "inicio.jpg",
        alt: "Resumen personal de Inicio",
        caption:
          "Revisá las tareas de Hoy y las horas de la semana. Abrí una tarea para consultar qué falta resolver.",
        step: 1,
        width: 1176,
        height: 888,
      },
    ],
    notificaciones: [
      {
        id: "referencia",
        fileName: "notificaciones.jpg",
        alt: "Actividad y preferencias de notificaciones",
        caption:
          "Usá Todas o Sin leer para revisar avisos. A la derecha se configuran los canales y la vista privada.",
        step: 4,
        width: 1176,
        height: 888,
      },
    ],
    "ausencias-personales": [
      {
        id: "referencia",
        fileName: "ausencias-personales.jpg",
        alt: "Formulario Nueva solicitud de ausencia",
        caption:
          "Completá Desde, Hasta y Tipo. Revisá los saldos de arriba antes de usar Enviar solicitud.",
        step: 2,
        width: 1176,
        height: 888,
      },
    ],
    "facturas-personales": [
      {
        id: "referencia",
        fileName: "facturas-personales.jpg",
        alt: "Período y etapa habilitada en Mis facturas",
        caption:
          "Elegí Mes trabajado. Si aparece Esperando a Operaciones, todavía no se habilitó el siguiente paso de ese período.",
        step: 1,
        width: 1176,
        height: 888,
      },
    ],
    crm: [
      {
        id: "referencia",
        fileName: "crm.jpg",
        alt: "Pipeline y buscador del CRM",
        caption:
          "Buscá por empresa o contacto y filtrá por etapa. Abrí la tarjeta de una oportunidad para registrar su seguimiento.",
        step: 1,
        width: 1176,
        height: 888,
      },
    ],
    clientes: [
      {
        id: "referencia",
        fileName: "clientes.jpg",
        alt: "Búsqueda y alta de clientes",
        caption:
          "Buscá primero el cliente. Añadir Nuevo Cliente está arriba; el lápiz de cada tarjeta permite editar el registro existente.",
        step: 1,
        width: 1176,
        height: 888,
      },
    ],
    cotizaciones: [
      {
        id: "referencia",
        fileName: "cotizaciones.jpg",
        alt: "Búsqueda y creación de cotizaciones",
        caption:
          "Usá Nueva Cotización para iniciar un presupuesto. Para retomar uno, buscá su nombre y revisá el filtro de estados.",
        step: 1,
        width: 1176,
        height: 888,
      },
    ],
    propuestas: [
      {
        id: "referencia",
        fileName: "propuestas.jpg",
        alt: "Pestañas del Estudio de Propuesta",
        caption:
          "Revisá el contenido en Narrativa y el documento en Diseño. QA y Exportar aparecen como etapas separadas.",
        step: 2,
        width: 1176,
        height: 888,
      },
    ],
    "proyectos-tareas": [
      {
        id: "referencia",
        fileName: "proyectos-tareas.jpg",
        alt: "Carpetas de clientes y proyectos de tareas",
        caption:
          "Desplegá el cliente y elegí Ver tareas en el proyecto. El botón Kanban abre la vista de estados de los proyectos.",
        step: 2,
        width: 1176,
        height: 520,
      },
    ],
    tareas: [
      {
        id: "referencia",
        fileName: "tareas.jpg",
        alt: "Responsable, fechas y repetición de una tarea",
        caption:
          "En el detalle se definen Responsable, Fechas y Repetición. La descripción y las subtareas explican el trabajo que debe resolverse.",
        step: 3,
        width: 576,
        height: 888,
      },
    ],
    horas: [
      {
        id: "referencia",
        fileName: "horas-formulario.jpg",
        alt: "Formulario de registro de horas en una tarea",
        caption:
          "En Tiempo registrado, abrí Registrar y completá horas, fecha y descripción. Verificá a nombre de quién se registran antes de confirmar.",
        step: 2,
        width: 535,
        height: 262,
      },
    ],
    status: [
      {
        id: "referencia",
        fileName: "status.jpg",
        alt: "Acceso a salas de Status",
        caption:
          "Las salas se reúnen en esta pantalla. Nueva sala permite crear una; si no aparece una sala compartida, pedí que revisen tu participación.",
        step: 1,
        width: 1176,
        height: 888,
      },
    ],
    objetivos: [
      {
        id: "referencia",
        fileName: "objetivos.jpg",
        alt: "Filtros y frentes de Objetivos",
        caption:
          "Foco resume la semana; Plan completo permite consultar la estructura. Los filtros distinguen objetivos, hitos, hábitos y acciones.",
        step: 1,
        width: 1176,
        height: 888,
      },
    ],
    cartera: [
      {
        id: "referencia",
        fileName: "cartera.jpg",
        alt: "Filtros de la Vista de proyectos",
        caption:
          "Elegí período, estado y tipo. Desplegá el cliente para encontrar su proyecto; Nuevo proyecto inicia el alta.",
        step: 1,
        width: 1176,
        height: 888,
      },
    ],
    "finanzas-proyecto": [
      {
        id: "referencia",
        fileName: "cartera.jpg",
        alt: "Acceso a proyectos desde la cartera",
        caption:
          "Partí de la Vista de proyectos: buscá el cliente o proyecto y abrí su detalle para consultar la gestión financiera.",
        step: 1,
        width: 1176,
        height: 888,
      },
    ],
    entregables: [
      {
        id: "referencia",
        fileName: "cartera.jpg",
        alt: "Búsqueda de cliente y proyecto en la cartera",
        caption:
          "Ubicá el cliente y el proyecto antes de entrar a sus entregables. Revisá el período para no actualizar otro ciclo.",
        step: 1,
        width: 1176,
        height: 888,
      },
    ],
    "capacidad-calendario": [
      {
        id: "referencia",
        fileName: "capacidad-calendario.jpg",
        alt: "Calendario del equipo con tareas asignadas",
        caption:
          "Alterná Mes o Semana y filtrá por colaborador o proyecto. Las tareas aparecen en sus fechas para revisar la distribución del trabajo.",
        step: 3,
        width: 1176,
        height: 888,
      },
    ],
    "ausencias-equipo": [
      {
        id: "referencia",
        fileName: "ausencias-equipo.jpg",
        alt: "Gestión de ausencias y planificación anual",
        caption:
          "Elegí la persona y el año. Equipo muestra solicitudes y planificación; Cupos permite revisar los saldos.",
        step: 1,
        width: 1176,
        height: 888,
      },
    ],
    "cierre-equipo": [
      {
        id: "referencia",
        fileName: "cierre-equipo.jpg",
        alt: "Tabla de bases del cierre del equipo",
        caption:
          "Contrastá persona, horas y valor hora antes de guardar una base. Los importes pendientes requieren revisión antes de publicar.",
        step: 2,
        width: 1128,
        height: 505,
      },
    ],
    "tarifas-servicios": [
      {
        id: "referencia",
        fileName: "tarifas-servicios.jpg",
        alt: "Referencia al origen unificado de tarifas",
        caption:
          "Tarifas estimadas informa que los valores se mantienen en Personal. Para editarlos necesitás el acceso correspondiente a Configuración.",
        step: 1,
        width: 1176,
        height: 320,
      },
    ],
    "carga-financiera": [
      {
        id: "referencia",
        fileName: "carga-financiera.jpg",
        alt: "Texto y archivos en Nueva carga financiera",
        caption:
          "En Nueva carga, elegí Escribir o pegar o Archivo o captura. La carga genera un borrador para revisar antes de confirmar su impacto.",
        step: 1,
        width: 1176,
        height: 888,
      },
    ],
    "facturas-equipo": [
      {
        id: "referencia",
        fileName: "facturas-equipo.jpg",
        alt: "Período y búsqueda en Facturas del equipo",
        caption:
          "Elegí Período trabajado y buscá la persona o el número de factura. Los contadores distinguen revisión, diferencias y aprobaciones.",
        step: 1,
        width: 1176,
        height: 560,
      },
    ],
    "cierre-financiero": [
      {
        id: "referencia",
        fileName: "cierre-financiero.jpg",
        alt: "Período y control de pre-cierre",
        caption:
          "Elegí el mes y usá Ejecutar pre-cierre. El checklist mostrará los controles críticos y advertencias del período.",
        step: 2,
        width: 1176,
        height: 600,
      },
    ],
    cashflow: [
      {
        id: "referencia",
        fileName: "cashflow.jpg",
        alt: "Filtros y saldos de Cashflow",
        caption:
          "Filtrá mes, año y banco antes de comparar Ingresos, Egresos y Saldo Total. Cuentas abre la gestión de cuentas.",
        step: 1,
        width: 1176,
        height: 480,
      },
    ],
    "activo-pasivo": [
      {
        id: "referencia",
        fileName: "activo-pasivo.jpg",
        alt: "Período y saldos de Activo",
        caption:
          "Seleccioná mes y año. Total, Cobrado, Pendiente y Vencido resumen las cuentas a cobrar del período.",
        step: 1,
        width: 1176,
        height: 888,
      },
    ],
    provisiones: [
      {
        id: "referencia",
        fileName: "provisiones.jpg",
        alt: "Período y resumen de Provisiones",
        caption:
          "Elegí mes y año para revisar provisiones activas y recuperos. Cargar provisión lleva al ingreso de la información.",
        step: 1,
        width: 1176,
        height: 888,
      },
    ],
    reportes: [
      {
        id: "referencia",
        fileName: "reportes.jpg",
        alt: "Selector de período del Resumen financiero",
        caption:
          "Elegí Mes, Trimestre, Año o Personalizado. Si no hay datos, comprobá que el período tenga información cargada antes de comparar resultados.",
        step: 1,
        width: 1176,
        height: 490,
      },
    ],
    "analisis-financiero": [
      {
        id: "referencia",
        fileName: "analisis-financiero.jpg",
        alt: "Filtros por período y cliente en Rendimiento",
        caption:
          "Alineá Período y cliente antes de revisar los proyectos incluidos. Un período sin proyectos no tiene resultados para comparar.",
        step: 1,
        width: 1176,
        height: 888,
      },
    ],
    administracion: [
      {
        id: "referencia",
        fileName: "administracion.jpg",
        alt: "Permisos y acciones en Gestión de Usuarios",
        caption:
          "La columna Permisos muestra los accesos por cuenta. Usá Editar para revisar una asignación y evitá otorgar Acceso total cuando bastan permisos específicos.",
        step: 3,
        width: 1176,
        height: 888,
      },
    ],
    "personal-tarifas": [
      {
        id: "referencia",
        fileName: "personal-tarifas.jpg",
        alt: "Pestaña Personal de Configuración",
        caption:
          "En Personal se revisan clasificación, contrato y horas mensuales. Las advertencias indican qué datos de la persona faltan completar.",
        step: 2,
        width: 1176,
        height: 888,
      },
    ],
    "configuracion-precios": [
      {
        id: "referencia",
        fileName: "configuracion-precios.jpg",
        alt: "Pestaña Tipos de Cambio de Configuración",
        caption:
          "Elegí Tipos de Cambio y revisá el año. Agregar Tipo de Cambio, Sync Blue hoy e Importar REM corresponden a acciones diferentes.",
        step: 1,
        width: 1176,
        height: 888,
      },
    ],
    "admin-proveedores": [
      {
        id: "referencia",
        fileName: "admin-proveedores.jpg",
        alt: "Accesos por proyecto de un proveedor",
        caption:
          "Verificá empresa, usuario y estado. El acceso Proyectos de esa fila permite revisar las asignaciones del proveedor.",
        step: 2,
        width: 1176,
        height: 440,
      },
    ],
    "fuentes-definiciones": [
      {
        id: "referencia",
        fileName: "fuentes-definiciones.jpg",
        alt: "Documento versionado de Definiciones",
        caption:
          "Consultá la versión y la fecha de actualización antes de interpretar una regla. El documento es de consulta.",
        step: 1,
        width: 1176,
        height: 888,
      },
    ],
    "proveedor-panel": [
      {
        id: "referencia",
        fileName: "proveedor-panel.jpg",
        alt: "Proyectos y acciones del panel de proveedor",
        caption:
          "Cada proyecto muestra sus acciones habilitadas. Mis facturas abre tus comprobantes; Cargar horas corresponde al proyecto de esa fila.",
        step: 2,
        width: 1176,
        height: 440,
      },
    ],
    "proveedor-horas": [
      {
        id: "referencia",
        fileName: "proveedor-horas.jpg",
        alt: "Formulario Cargar horas del proveedor",
        caption:
          "Completá Fecha, Horas y Descripción. Revisá el proyecto indicado en el título antes de seleccionar Guardar horas.",
        step: 2,
        width: 448,
        height: 360,
      },
    ],
    "proveedor-facturas": [
      {
        id: "referencia",
        fileName: "proveedor-facturas.jpg",
        alt: "Mes y estado de las facturas del proveedor",
        caption:
          "Revisá Mes trabajado y la etapa disponible. Esperando a Operaciones indica que debés esperar la habilitación antes de presentar el comprobante.",
        step: 2,
        width: 1176,
        height: 888,
      },
    ],
  };

export function screenshotsForLesson(lessonId: string): TrainingScreenshot[] {
  return (trainingScreenshots[lessonId] ?? []).map(
    ({ fileName: _fileName, ...image }) => ({
      ...image,
      src: `/api/training/lessons/${encodeURIComponent(lessonId)}/media/${encodeURIComponent(image.id)}`,
    }),
  );
}
