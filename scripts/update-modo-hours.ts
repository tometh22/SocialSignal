import { pool } from '../server/db';

// Datos de horas disponibles y reales según la imagen del Excel
const MODO_HOURS_DATA = [
  { title: "Ejecutivo Sony One", horasDisponibles: 40, horasReales: 42.58, cumplimientoHoras: 4 },
  { title: "Mensual Enero", horasDisponibles: 45, horasReales: 41, cumplimientoHoras: 5 },
  { title: "Ejecutivo Telepase", horasDisponibles: 40, horasReales: 12.33, cumplimientoHoras: 5 },
  { title: "Mensual Febrero", horasDisponibles: null, horasReales: 74.33, cumplimientoHoras: 5 },
  { title: "Ejecutivo NFC", horasDisponibles: 40, horasReales: 32, cumplimientoHoras: 5 },
  { title: "Ejecutivo Sony One Febrero", horasDisponibles: 40, horasReales: 32, cumplimientoHoras: 5 },
  { title: "Mensual Marzo", horasDisponibles: null, horasReales: null, cumplimientoHoras: null },
  { title: "Ejecutivo 2", horasDisponibles: null, horasReales: null, cumplimientoHoras: null },
  { title: "Ejecutivo Comercios", horasDisponibles: null, horasReales: null, cumplimientoHoras: null },
  { title: "Mensual Abril", horasDisponibles: null, horasReales: null, cumplimientoHoras: null },
  { title: "Ejecutivo 1", horasDisponibles: null, horasReales: null, cumplimientoHoras: null },
  { title: "Ejecutivo 2", horasDisponibles: null, horasReales: null, cumplimientoHoras: null }
];

/**
 * Actualiza las horas disponibles y reales de los entregables MODO
 */
async function updateModoHours() {
  try {
    console.log('Iniciando actualización de horas para proyectos MODO...');
    
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
      
      // Encuentra los datos de horas para este proyecto
      const hoursData = MODO_HOURS_DATA.find(h => h.title.trim() === project.project_name.trim());
      
      if (!hoursData) {
        console.log(`⚠️ No se encontraron datos de horas para el proyecto "${project.project_name}"`);
        continue;
      }
      
      console.log(`Procesando proyecto: ${project.project_name} (ID: ${project.id})`);
      
      // Actualizar el entregable con los datos de horas
      for (const deliverable of deliverables) {
        // La mayoría de los proyectos tendrán un solo entregable con el mismo nombre que el proyecto
        await pool.query(
          `UPDATE deliverables SET 
           hours_available = $1, 
           hours_real = $2,
           hours_compliance = $3
           WHERE id = $4`,
          [
            hoursData.horasDisponibles,
            hoursData.horasReales,
            hoursData.cumplimientoHoras ? hoursData.cumplimientoHoras / 5 : null, // Convertir de escala 0-5 a 0-1
            deliverable.id
          ]
        );
        
        console.log(`✅ Actualizado entregable "${deliverable.title}" (ID: ${deliverable.id})`);
      }
      
      // Actualizar las entradas de tiempo para reflejar las horas reales
      if (hoursData.horasReales) {
        const { rows: timeEntries } = await pool.query(
          'SELECT id, hours FROM time_entries WHERE project_id = $1',
          [project.id]
        );
        
        if (timeEntries.length > 0) {
          // Si hay entradas de tiempo, ajustamos la primera para reflejar las horas reales
          await pool.query(
            'UPDATE time_entries SET hours = $1 WHERE id = $2',
            [hoursData.horasReales, timeEntries[0].id]
          );
          
          console.log(`✅ Actualizada entrada de tiempo para reflejar ${hoursData.horasReales} horas reales`);
        } else {
          // Si no hay entradas de tiempo, creamos una
          await pool.query(
            `INSERT INTO time_entries (
              project_id, personnel_id, date, hours, description, 
              billable, created_at
            ) VALUES (
              $1, $2, $3, $4, $5, $6, NOW()
            )`,
            [
              project.id,
              39, // ID de personal (Trinidad)
              new Date().toISOString(),
              hoursData.horasReales,
              `Preparación de informe ${project.project_name}`,
              true
            ]
          );
          
          console.log(`✅ Creada nueva entrada de tiempo con ${hoursData.horasReales} horas reales`);
        }
      }
    }
    
    console.log('✅ Actualización de horas para proyectos MODO completada exitosamente');
  } catch (error: any) {
    console.error('Error al actualizar horas MODO:', error.message);
  } finally {
    await pool.end();
  }
}

// Ejecutar la función principal
updateModoHours().catch(console.error);