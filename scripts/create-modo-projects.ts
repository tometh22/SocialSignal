import { pool } from '../server/db';

const CLIENT_ID = 17; // ID del cliente MODO 
const EXISTING_PROJECT_ID = 4; // ID del proyecto actual que contiene entregables MODO
const ENTREGABLES = [
  { title: "Ejecutivo Sony One", mes: 1 },
  { title: "Mensual Enero", mes: 2 },
  { title: "Ejecutivo Telepase", mes: 1 },
  { title: "Mensual Febrero", mes: 3 },
  { title: "Ejecutivo NFC", mes: 3 },
  { title: "Ejecutivo Sony One Febrero", mes: 3 },
  { title: "Mensual Marzo", mes: 4 },
  { title: "Ejecutivo 2", mes: 4 },
  { title: "Ejecutivo Comercios", mes: 4 },
  { title: "Mensual Abril", mes: 5 },
  { title: "Ejecutivo 1", mes: 5 },
  { title: "Ejecutivo 2 (Mayo)", mes: 5 }
];

/**
 * Función principal para crear proyectos individuales para cada entregable MODO
 */
async function createModoProjects() {
  try {
    console.log('Iniciando creación de proyectos MODO individuales...');
    
    // 1. Obtenemos los datos del actual proyecto MODO
    const { rows: currentProject } = await pool.query(
      `SELECT ap.*, q.* 
       FROM active_projects ap 
       JOIN quotations q ON ap.quotation_id = q.id 
       WHERE ap.id = $1`,
      [EXISTING_PROJECT_ID]
    );
    
    if (currentProject.length === 0) {
      throw new Error(`No se encontró el proyecto MODO con ID ${EXISTING_PROJECT_ID}`);
    }
    
    console.log(`Proyecto actual encontrado: ${currentProject[0].project_name}`);
    
    // 2. Obtenemos los entregables actuales para poder migrarlos
    const { rows: currentDeliverables } = await pool.query(
      'SELECT * FROM deliverables WHERE project_id = $1',
      [EXISTING_PROJECT_ID]
    );
    
    console.log(`Se encontraron ${currentDeliverables.length} entregables en el proyecto actual`);
    
    // 3. Crear proyectos individuales para cada entregable
    for (const entregable of ENTREGABLES) {
      try {
        // Buscar si el entregable existe en los entregables actuales
        const matchingDeliverable = currentDeliverables.find(d => 
          d.title.trim() === entregable.title.trim()
        );
        
        if (!matchingDeliverable) {
          console.log(`⚠️ No se encontró el entregable "${entregable.title}" en la base de datos. Omitiendo...`);
          continue;
        }
        
        console.log(`Procesando entregable: ${entregable.title} (mes ${entregable.mes})`);
        
        // Crear una cotización para el nuevo proyecto
        const { rows: quotation } = await pool.query(
          `INSERT INTO quotations (
            client_id, project_name, status, analysis_type, project_type, 
            mentions_volume, countries_covered, client_engagement, 
            base_cost, complexity_adjustment, markup_amount, total_amount, 
            created_at, updated_at
          ) VALUES (
            $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW(), NOW()
          ) RETURNING id`,
          [
            CLIENT_ID,
            entregable.title,
            currentProject[0].status,
            currentProject[0].analysis_type,
            currentProject[0].project_type,
            currentProject[0].mentions_volume || 'Bajo', // Valor predeterminado si es nulo
            currentProject[0].countries_covered || 'Argentina', // Valor predeterminado si es nulo
            currentProject[0].client_engagement || 'Estándar', // Valor predeterminado si es nulo
            currentProject[0].base_cost || 800,
            currentProject[0].complexity_adjustment || 0,
            currentProject[0].markup_amount || 200,
            currentProject[0].total_amount || 1000,
          ]
        );
        
        const quotationId = quotation[0].id;
        console.log(`✅ Cotización creada con ID: ${quotationId}`);
        
        // Crear un nuevo proyecto activo
        const monthDelivery = entregable.mes;
        const year = 2023;
        const startDate = new Date(year, monthDelivery - 1, 1).toISOString();
        const endDate = new Date(year, monthDelivery - 1, 28).toISOString();
        
        const { rows: newProject } = await pool.query(
          `INSERT INTO active_projects (
            quotation_id, status, start_date, expected_end_date, 
            tracking_frequency, notes, created_at, updated_at
          ) VALUES (
            $1, $2, $3, $4, $5, $6, NOW(), NOW()
          ) RETURNING id`,
          [
            quotationId,
            'en_progreso',
            startDate,
            endDate,
            'mensual',
            `Proyecto creado a partir del entregable "${entregable.title}" del Excel MODO.`
          ]
        );
        
        const newProjectId = newProject[0].id;
        console.log(`✅ Proyecto creado con ID: ${newProjectId}`);
        
        // Migrar el entregable al nuevo proyecto 
        // (lo creamos como un nuevo entregable para el proyecto)
        await pool.query(
          `INSERT INTO deliverables (
            project_id, title, delivery_date, due_date, on_time,
            narrative_quality, graphics_effectiveness, format_design, 
            relevant_insights, operations_feedback, client_feedback,
            brief_compliance, notes, hours_available, hours_real, 
            hours_compliance, created_at, updated_at
          ) VALUES (
            $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, NOW(), NOW()
          )`,
          [
            newProjectId,
            entregable.title,
            matchingDeliverable.delivery_date,
            matchingDeliverable.due_date,
            matchingDeliverable.on_time,
            matchingDeliverable.narrative_quality,
            matchingDeliverable.graphics_effectiveness,
            matchingDeliverable.format_design,
            matchingDeliverable.relevant_insights,
            matchingDeliverable.operations_feedback,
            matchingDeliverable.client_feedback,
            matchingDeliverable.brief_compliance,
            matchingDeliverable.notes,
            matchingDeliverable.hours_available,
            matchingDeliverable.hours_real,
            matchingDeliverable.hours_compliance
          ]
        );
        
        console.log(`✅ Entregable migrado al nuevo proyecto: ${entregable.title}`);
        
        // Crear entradas de tiempo para el nuevo proyecto (replicando las entradas existentes si hay)
        const { rows: timeEntries } = await pool.query(
          'SELECT * FROM time_entries WHERE project_id = $1',
          [EXISTING_PROJECT_ID]
        );
        
        if (timeEntries.length > 0) {
          for (const entry of timeEntries) {
            await pool.query(
              `INSERT INTO time_entries (
                project_id, personnel_id, date, hours, description, 
                billable, created_at
              ) VALUES (
                $1, $2, $3, $4, $5, $6, NOW()
              )`,
              [
                newProjectId,
                entry.personnel_id,
                entry.date,
                entry.hours,
                `Trabajo en ${entregable.title} - Mes ${entregable.mes}`,
                entry.billable
              ]
            );
          }
          console.log(`✅ ${timeEntries.length} registros de tiempo copiados al nuevo proyecto`);
        } else {
          // Si no hay registros de tiempo, crear uno básico
          await pool.query(
            `INSERT INTO time_entries (
              project_id, personnel_id, date, hours, description, 
              billable, created_at
            ) VALUES (
              $1, $2, $3, $4, $5, $6, NOW()
            )`,
            [
              newProjectId,
              39, // ID de personal (Trinidad)
              new Date(year, monthDelivery - 1, 15).toISOString(),
              matchingDeliverable.hours_real || 7.5,
              `Preparación de informe ${entregable.title}`,
              true
            ]
          );
          console.log(`✅ Registro de tiempo básico creado para el nuevo proyecto`);
        }
        
        console.log(`✅ Proyecto "${entregable.title}" creado completamente`);
      } catch (error: any) {
        console.error(`Error al procesar entregable "${entregable.title}":`, error.message);
      }
    }
    
    console.log('Proceso finalizado. Se han creado proyectos individuales para los entregables MODO.');
    
  } catch (error: any) {
    console.error('Error al crear proyectos MODO:', error.message);
  } finally {
    await pool.end();
  }
}

// Ejecutar la función principal
createModoProjects().catch(console.error);