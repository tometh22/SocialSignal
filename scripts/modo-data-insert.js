// Este script inserta datos MODO utilizando SQL directo para evitar problemas con el esquema
import { Pool, neonConfig } from '@neondatabase/serverless';
import ws from 'ws';

// Configurar WebSocket para Neon
neonConfig.webSocketConstructor = ws;

// Usar la variable de entorno para la conexión
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function createModoData() {
  console.log('Iniciando creación de datos MODO...');
  
  try {
    // 1. Verificar si el cliente MODO existe
    const clientResult = await pool.query(`SELECT * FROM clients WHERE name = 'MODO' LIMIT 1`);
    
    let modoClientId;
    if (clientResult.rows.length === 0) {
      console.log('Cliente MODO no encontrado, creando...');
      const newClient = await pool.query(`
        INSERT INTO clients (name, contact_name, contact_email, contact_phone) 
        VALUES ('MODO', 'Coordinador MODO', 'modo@example.com', '1234567890') 
        RETURNING id
      `);
      modoClientId = newClient.rows[0].id;
      console.log(`Cliente MODO creado con ID: ${modoClientId}`);
    } else {
      modoClientId = clientResult.rows[0].id;
      console.log(`Cliente MODO encontrado con ID: ${modoClientId}`);
    }

    // 2. Obtener proyectos activos para el cliente MODO
    const projectsResult = await pool.query(`
      SELECT id, name FROM active_projects 
      WHERE client_id = $1 
      LIMIT 10
    `, [modoClientId]);

    if (projectsResult.rows.length === 0) {
      console.error('No se encontraron proyectos activos para el cliente MODO.');
      // Obtener cualquier proyecto activo
      const anyProjects = await pool.query(`SELECT id, name FROM active_projects LIMIT 6`);
      if (anyProjects.rows.length === 0) {
        console.error('No se encontraron proyectos activos en el sistema.');
        return;
      }
      console.log(`Se utilizarán ${anyProjects.rows.length} proyectos activos generales para asignar entregables MODO.`);
      
      // Limpiar entregables existentes
      await pool.query(`DELETE FROM deliverables WHERE project_id IN (SELECT id FROM active_projects LIMIT 6)`);
      
      // Crear datos MODO para cada proyecto
      for (let i = 0; i < anyProjects.rows.length; i++) {
        const project = anyProjects.rows[i];
        const title = i === 0 ? 'Ejecutivo Sony One' :
                     i === 1 ? 'Mensual Enero' :
                     i === 2 ? 'Ejecutivo Telepase' :
                     i === 3 ? 'Mensual Febrero' :
                     i === 4 ? 'Ejecutivo NFC' : 'Mensual Marzo';
                     
        const mesEntrega = i < 2 ? 1 : i < 4 ? 2 : i < 6 ? 3 : 4;
        const onTime = i !== 2 && i !== 5;
        const retrabajo = i === 2 || i === 5;
        
        const narrativeQuality = i === 2 || i === 5 ? 3.5 + (i * 0.1) : 4.3 + (i * 0.1);
        const graphicsEffectiveness = i === 2 || i === 5 ? 3.3 + (i * 0.1) : 4.2 + (i * 0.1);
        const formatDesign = i === 2 || i === 5 ? 3.4 + (i * 0.1) : 4.0 + (i * 0.1);
        const relevantInsights = i === 2 || i === 5 ? 3.6 + (i * 0.1) : 4.2 + (i * 0.2);
        const operationsFeedback = i === 2 || i === 5 ? 3.2 + (i * 0.1) : 4.4 + (i * 0.1);
        const clientFeedback = i === 2 || i === 5 ? 3.0 + (i * 0.1) : 4.0 + (i * 0.1);
        const feedbackGeneralCliente = i === 2 || i === 5 ? 3.1 + (i * 0.1) : 4.2 + (i * 0.1);
        const briefCompliance = i === 2 || i === 5 ? 3.3 + (i * 0.1) : 4.1 + (i * 0.1);
        
        const hoursAvailable = i === 4 ? 25 : 30 + (i * 5);
        const hoursReal = i === 2 || i === 5 ? hoursAvailable * 1.2 : hoursAvailable * 0.95;
        const hoursCompliance = hoursAvailable / hoursReal;
        
        // Fechas de entrega y vencimiento
        const month = mesEntrega;
        const deliveryDate = new Date(2023, month - 1, 15 + i);
        const dueDate = new Date(2023, month - 1, i === 2 || i === 5 ? 14 + i : 15 + i);

        // Insertar entregable
        await pool.query(`
          INSERT INTO deliverables (
            project_id, title, delivery_date, due_date, on_time, 
            narrative_quality, graphics_effectiveness, format_design, 
            relevant_insights, operations_feedback, client_feedback, 
            brief_compliance, hours_available, hours_real, hours_compliance,
            retrabajo, feedback_general_cliente, mes_entrega
          ) VALUES (
            $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18
          )
        `, [
          project.id, title, deliveryDate, dueDate, onTime, 
          narrativeQuality, graphicsEffectiveness, formatDesign, 
          relevantInsights, operationsFeedback, clientFeedback, 
          briefCompliance, hoursAvailable, hoursReal, hoursCompliance,
          retrabajo, feedbackGeneralCliente, mesEntrega
        ]);
        console.log(`Entregable "${title}" agregado para proyecto ${project.name} (ID: ${project.id})`);
      }
      
      // Insertar comentarios MODO
      await pool.query(`DELETE FROM client_modo_comments WHERE client_id = $1`, [modoClientId]);
      
      await pool.query(`
        INSERT INTO client_modo_comments (
          client_id, year, quarter, comment_text, created_at, updated_at
        ) VALUES (
          $1, 2023, 1, 
          'Excelente trabajo en los informes ejecutivos. La calidad narrativa y los insights han sido destacables. Para el próximo trimestre, nos gustaría ver más análisis de tendencias regionales.', 
          NOW(), NOW()
        )
      `, [modoClientId]);
      
      await pool.query(`
        INSERT INTO client_modo_comments (
          client_id, year, quarter, comment_text, created_at, updated_at
        ) VALUES (
          $1, 2023, 2, 
          'Buena evolución en el diseño de los informes mensuales. El cliente ha valorado positivamente las visualizaciones interactivas. Necesitamos mejorar los tiempos de entrega para evitar retrabajos.', 
          NOW(), NOW()
        )
      `, [modoClientId]);
      
      console.log('Comentarios MODO insertados correctamente.');
    } else {
      console.log(`Se encontraron ${projectsResult.rows.length} proyectos para el cliente MODO.`);
      // Continuar con la lógica similar a la de arriba si se desea trabajar con estos proyectos específicos
    }

    console.log('¡Datos MODO creados con éxito!');
  } catch (error) {
    console.error('Error al crear datos MODO:', error);
  } finally {
    await pool.end();
  }
}

// Ejecutar el script
createModoData()
  .then(() => {
    console.log('Script completado');
    process.exit(0);
  })
  .catch(err => {
    console.error('Error en el script:', err);
    process.exit(1);
  });