import { db } from '../server/db';
import { sql } from 'drizzle-orm';

async function createModoData() {
  console.log('Iniciando creación de datos MODO...');

  try {
    // Verificar si el cliente MODO existe
    const modoClientQuery = await db.execute(
      sql`SELECT * FROM clients WHERE name = 'MODO' LIMIT 1`
    );
    
    let modoClientId;
    
    if (modoClientQuery.length === 0) {
      console.log('Cliente MODO no encontrado, creando...');
      const newClient = await db.execute(
        sql`INSERT INTO clients (name, contact_name, contact_email, contact_phone) 
            VALUES ('MODO', 'Coordinador MODO', 'modo@example.com', '1234567890') 
            RETURNING id`
      );
      modoClientId = newClient[0].id;
      console.log(`Cliente MODO creado con ID: ${modoClientId}`);
    } else {
      modoClientId = modoClientQuery[0].id;
      console.log(`Cliente MODO encontrado con ID: ${modoClientId}`);
    }

    // Obtener algunos proyectos activos para asignarles entregables
    const projectsQuery = await db.execute(
      sql`SELECT id, name FROM active_projects LIMIT 10`
    );

    if (projectsQuery.length === 0) {
      console.error('No se encontraron proyectos activos para asignar entregables.');
      return;
    }

    // Eliminar entregables existentes para evitar duplicados
    await db.execute(sql`DELETE FROM deliverables WHERE project_id IN 
      (SELECT id FROM active_projects WHERE client_id = ${modoClientId})`);
    console.log('Entregables anteriores eliminados');

    // Datos de ejemplo basados en Excel MODO para insertar
    for (let i = 0; i < Math.min(6, projectsQuery.length); i++) {
      const projectId = projectsQuery[i].id;
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

      // Insertar el entregable
      await db.execute(
        sql`INSERT INTO deliverables (
          project_id, title, delivery_date, due_date, on_time, 
          narrative_quality, graphics_effectiveness, format_design, 
          relevant_insights, operations_feedback, client_feedback, 
          brief_compliance, hours_available, hours_real, hours_compliance,
          retrabajo, feedback_general_cliente, mes_entrega
        ) VALUES (
          ${projectId}, ${title}, ${deliveryDate}, ${dueDate}, ${onTime}, 
          ${narrativeQuality}, ${graphicsEffectiveness}, ${formatDesign}, 
          ${relevantInsights}, ${operationsFeedback}, ${clientFeedback}, 
          ${briefCompliance}, ${hoursAvailable}, ${hoursReal}, ${hoursCompliance},
          ${retrabajo}, ${feedbackGeneralCliente}, ${mesEntrega}
        )`
      );
      
      console.log(`Entregable ${title} para proyecto ID ${projectId} insertado.`);
    }

    // Insertar algunos comentarios
    await db.execute(sql`DELETE FROM client_modo_comments WHERE client_id = ${modoClientId}`);

    // Comentarios para el Q1 y Q2 de 2023
    await db.execute(
      sql`INSERT INTO client_modo_comments (
        client_id, year, quarter, comment_text, created_at, updated_at
      ) VALUES (
        ${modoClientId}, 2023, 1, 
        'Excelente trabajo en los informes ejecutivos. La calidad narrativa y los insights han sido destacables. Para el próximo trimestre, nos gustaría ver más análisis de tendencias regionales.', 
        '2023-03-31'::timestamp, '2023-03-31'::timestamp
      )`
    );

    await db.execute(
      sql`INSERT INTO client_modo_comments (
        client_id, year, quarter, comment_text, created_at, updated_at
      ) VALUES (
        ${modoClientId}, 2023, 2, 
        'Buena evolución en el diseño de los informes mensuales. El cliente ha valorado positivamente las visualizaciones interactivas. Necesitamos mejorar los tiempos de entrega para evitar retrabajos.', 
        '2023-06-30'::timestamp, '2023-06-30'::timestamp
      )`
    );

    console.log('Comentarios MODO insertados correctamente.');
    console.log('¡Datos MODO creados con éxito!');
  } catch (error) {
    console.error('Error al crear datos MODO:', error);
  }
}

// Ejecutar la función
createModoData()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Error en el script:', error);
    process.exit(1);
  });