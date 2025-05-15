import { pool } from '../server/db';

// Datos completos para todos los entregables según la imagen del Excel
const MODO_METRICS_DATA = [
  { 
    title: "Ejecutivo Sony One", 
    mes: 1,
    retrabajo: true, 
    horasDisponibles: 40, 
    horasReales: 42.58, 
    cumplimientoHoras: 4, 
    calidadNarrativa: 5,
    efectividadGraficos: 5,
    formatoDiseno: 5, 
    insightsRelevantes: 5,
    feedbackOperaciones: 5,
    feedbackGeneralCliente: 4,
    cumplimientoBrief: 5
  },
  { 
    title: "Mensual Enero", 
    mes: 2,
    retrabajo: false, 
    horasDisponibles: 45, 
    horasReales: 41, 
    cumplimientoHoras: 5, 
    calidadNarrativa: 3,
    efectividadGraficos: 5, 
    formatoDiseno: 5, 
    insightsRelevantes: 4,
    feedbackOperaciones: 4.25,
    feedbackGeneralCliente: 5,
    cumplimientoBrief: 5
  },
  { 
    title: "Ejecutivo Telepase", 
    mes: 1,
    retrabajo: false, 
    horasDisponibles: 40, 
    horasReales: 12.33, 
    cumplimientoHoras: 5, 
    calidadNarrativa: 5,
    efectividadGraficos: 5, 
    formatoDiseno: 5, 
    insightsRelevantes: 5,
    feedbackOperaciones: 5,
    feedbackGeneralCliente: 5,
    cumplimientoBrief: 5
  },
  { 
    title: "Mensual Febrero", 
    mes: 3,
    retrabajo: false, 
    horasDisponibles: null, 
    horasReales: 74.33, 
    cumplimientoHoras: 5, 
    calidadNarrativa: 5,
    efectividadGraficos: 5, 
    formatoDiseno: 5, 
    insightsRelevantes: 5,
    feedbackOperaciones: 5,
    feedbackGeneralCliente: 5,
    cumplimientoBrief: 5
  },
  { 
    title: "Ejecutivo NFC", 
    mes: 3,
    retrabajo: false, 
    horasDisponibles: 40, 
    horasReales: 32, 
    cumplimientoHoras: 5, 
    calidadNarrativa: 5,
    efectividadGraficos: 5, 
    formatoDiseno: 5, 
    insightsRelevantes: 5,
    feedbackOperaciones: 5,
    feedbackGeneralCliente: 4,
    cumplimientoBrief: 4
  },
  { 
    title: "Ejecutivo Sony One Febrero", 
    mes: 3,
    retrabajo: false, 
    horasDisponibles: 40, 
    horasReales: 32, 
    cumplimientoHoras: 5, 
    calidadNarrativa: 5,
    efectividadGraficos: 5, 
    formatoDiseno: 5, 
    insightsRelevantes: 5,
    feedbackOperaciones: 5,
    feedbackGeneralCliente: 5,
    cumplimientoBrief: 5
  },
  { 
    title: "Mensual Marzo", 
    mes: 4,
    retrabajo: false, 
    horasDisponibles: null, 
    horasReales: null, 
    cumplimientoHoras: null, 
    calidadNarrativa: 5,
    efectividadGraficos: 5, 
    formatoDiseno: 5, 
    insightsRelevantes: 5,
    feedbackOperaciones: 5,
    feedbackGeneralCliente: null,
    cumplimientoBrief: null
  },
  { 
    title: "Ejecutivo 2", 
    mes: 4,
    retrabajo: null, 
    horasDisponibles: null, 
    horasReales: null, 
    cumplimientoHoras: null, 
    calidadNarrativa: null,
    efectividadGraficos: null, 
    formatoDiseno: null, 
    insightsRelevantes: null,
    feedbackOperaciones: null,
    feedbackGeneralCliente: null,
    cumplimientoBrief: null
  },
  { 
    title: "Ejecutivo Comercios", 
    mes: 4,
    retrabajo: false, 
    horasDisponibles: null, 
    horasReales: null, 
    cumplimientoHoras: null, 
    calidadNarrativa: 5,
    efectividadGraficos: 5, 
    formatoDiseno: 5, 
    insightsRelevantes: 5,
    feedbackOperaciones: 5,
    feedbackGeneralCliente: 5,
    cumplimientoBrief: 5
  },
  { 
    title: "Mensual Abril", 
    mes: 5,
    retrabajo: null, 
    horasDisponibles: null, 
    horasReales: null, 
    cumplimientoHoras: null, 
    calidadNarrativa: null,
    efectividadGraficos: null, 
    formatoDiseno: null, 
    insightsRelevantes: null,
    feedbackOperaciones: null,
    feedbackGeneralCliente: null,
    cumplimientoBrief: null
  },
  { 
    title: "Ejecutivo 1", 
    mes: 5,
    retrabajo: null, 
    horasDisponibles: null, 
    horasReales: null, 
    cumplimientoHoras: null, 
    calidadNarrativa: null,
    efectividadGraficos: null, 
    formatoDiseno: null, 
    insightsRelevantes: null,
    feedbackOperaciones: null,
    feedbackGeneralCliente: null,
    cumplimientoBrief: null
  },
  { 
    title: "Ejecutivo 2", 
    mes: 5,
    retrabajo: null, 
    horasDisponibles: null, 
    horasReales: null, 
    cumplimientoHoras: null, 
    calidadNarrativa: null,
    efectividadGraficos: null, 
    formatoDiseno: null, 
    insightsRelevantes: null,
    feedbackOperaciones: null,
    feedbackGeneralCliente: null,
    cumplimientoBrief: null
  }
];

/**
 * Actualiza todas las métricas de los entregables MODO con los datos completos del Excel
 */
async function updateModoMetrics() {
  try {
    console.log('Iniciando actualización de métricas completas para proyectos MODO...');
    
    // Primero obtenemos todos los proyectos para MODO
    const { rows: projects } = await pool.query(`
      SELECT ap.id, q.project_name
      FROM active_projects ap
      JOIN quotations q ON ap.quotation_id = q.id
      WHERE q.client_id = 17
    `);
    
    console.log(`Se encontraron ${projects.length} proyectos MODO`);
    
    // Recorremos cada proyecto para actualizar sus entregables
    for (const project of projects) {
      // Buscar entregables asociados al proyecto
      const { rows: deliverables } = await pool.query(
        'SELECT id, title FROM deliverables WHERE project_id = $1',
        [project.id]
      );
      
      if (deliverables.length === 0) {
        console.log(`⚠️ No se encontraron entregables para el proyecto "${project.project_name}" (ID: ${project.id})`);
        continue;
      }
      
      // Encuentra los datos completos para este proyecto
      const metricsData = MODO_METRICS_DATA.find(h => h.title.trim() === project.project_name.trim());
      
      if (!metricsData) {
        console.log(`⚠️ No se encontraron datos para el proyecto "${project.project_name}"`);
        continue;
      }
      
      console.log(`Procesando proyecto: ${project.project_name} (ID: ${project.id})`);
      
      // Actualizar el entregable con todos los datos del Excel
      for (const deliverable of deliverables) {
        await pool.query(
          `UPDATE deliverables SET 
           retrabajo = $1,
           mes_entrega = $2,
           hours_available = $3, 
           hours_real = $4,
           hours_compliance = $5,
           narrative_quality = $6,
           graphics_effectiveness = $7,
           format_design = $8,
           relevant_insights = $9,
           operations_feedback = $10,
           feedback_general_cliente = $11::numeric,
           client_feedback = $11::real,
           brief_compliance = $12
           WHERE id = $13`,
          [
            metricsData.retrabajo,
            metricsData.mes,
            metricsData.horasDisponibles,
            metricsData.horasReales,
            metricsData.cumplimientoHoras ? metricsData.cumplimientoHoras / 5 : null, // Convertir de escala 0-5 a 0-1
            metricsData.calidadNarrativa,
            metricsData.efectividadGraficos,
            metricsData.formatoDiseno,
            metricsData.insightsRelevantes,
            metricsData.feedbackOperaciones,
            metricsData.feedbackGeneralCliente,
            metricsData.cumplimientoBrief,
            deliverable.id
          ]
        );
        
        console.log(`✅ Actualizado entregable "${deliverable.title}" (ID: ${deliverable.id}) con todas las métricas`);
      }
      
      // Actualizar proyecto para incluir el mes de entrega en el nombre si no está ya
      if (metricsData.mes) {
        const newName = project.project_name.includes(`(Mes ${metricsData.mes})`) 
          ? project.project_name 
          : `${project.project_name} (Mes ${metricsData.mes})`;
        
        await pool.query(
          `UPDATE quotations SET project_name = $1 WHERE id = (
            SELECT quotation_id FROM active_projects WHERE id = $2
          )`,
          [newName, project.id]
        );
        
        console.log(`✅ Actualizado nombre del proyecto para incluir el mes: ${newName}`);
      }
    }
    
    console.log('✅ Actualización de métricas completas para proyectos MODO finalizada');
  } catch (error: any) {
    console.error('Error al actualizar métricas MODO:', error.message);
  } finally {
    await pool.end();
  }
}

// Ejecutar la función principal
updateModoMetrics().catch(console.error);