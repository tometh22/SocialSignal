import { db } from '../server/db';
import { deliverables, clientModoComments, clients, personnel, activeProjects } from '../shared/schema';
import { eq } from 'drizzle-orm';

async function createModoData() {
  console.log('Iniciando creación de datos MODO...');

  try {
    // Verificar si el cliente MODO existe
    let modoClient = await db.query.clients.findFirst({
      where: eq(clients.name, 'MODO')
    });

    if (!modoClient) {
      console.log('Cliente MODO no encontrado, creando...');
      [modoClient] = await db.insert(clients).values({
        name: 'MODO',
        contactName: 'Coordinador MODO',
        contactEmail: 'modo@example.com',
        contactPhone: '1234567890'
      }).returning();
      console.log(`Cliente MODO creado con ID: ${modoClient.id}`);
    } else {
      console.log(`Cliente MODO encontrado con ID: ${modoClient.id}`);
    }

    // Obtener algunos proyectos activos para asignarles entregables
    const projects = await db.query.activeProjects.findMany({
      limit: 10,
    });

    if (projects.length === 0) {
      console.error('No se encontraron proyectos activos para asignar entregables.');
      return;
    }

    // Eliminar entregables existentes para evitar duplicados
    await db.delete(deliverables);
    console.log('Entregables anteriores eliminados');

    // Obtener algunos miembros del personal para asignarlos como analistas y PMs
    const staff = await db.query.personnel.findMany({
      limit: 5,
    });

    if (staff.length === 0) {
      console.error('No se encontró personal para asignar a los entregables.');
      return;
    }

    // Datos de ejemplo basados en Excel MODO
    const modoDeliverables = [
      {
        title: 'Ejecutivo Sony One',
        project_id: projects[0].id,
        mes_entrega: 1,
        on_time: true,
        retrabajo: false,
        narrative_quality: 4.5,
        graphics_effectiveness: 4.2,
        format_design: 4.0,
        relevant_insights: 4.8,
        operations_feedback: 4.5,
        client_feedback: 4.0,
        feedback_general_cliente: 4.2,
        brief_compliance: 4.2,
        hours_available: 40,
        hours_real: 42.58,
        hours_compliance: 0.94,
        delivery_date: new Date('2023-01-15'),
        due_date: new Date('2023-01-20')
      },
      {
        title: 'Mensual Enero',
        project_id: projects[1].id,
        mes_entrega: 2,
        on_time: true,
        retrabajo: false,
        narrative_quality: 4.3,
        graphics_effectiveness: 4.5,
        format_design: 4.2,
        relevant_insights: 4.6,
        operations_feedback: 4.4,
        client_feedback: 4.2,
        feedback_general_cliente: 4.3,
        brief_compliance: 4.1,
        hours_available: 35,
        hours_real: 34.27,
        hours_compliance: 1.02,
        delivery_date: new Date('2023-02-10'),
        due_date: new Date('2023-02-15')
      },
      {
        title: 'Ejecutivo Telepase',
        project_id: projects[2].id,
        mes_entrega: 2,
        on_time: false,
        retrabajo: true,
        narrative_quality: 3.8,
        graphics_effectiveness: 3.6,
        format_design: 3.9,
        relevant_insights: 3.7,
        operations_feedback: 3.5,
        client_feedback: 3.2,
        feedback_general_cliente: 3.3,
        brief_compliance: 3.5,
        hours_available: 30,
        hours_real: 36.41,
        hours_compliance: 0.82,
        delivery_date: new Date('2023-02-21'),
        due_date: new Date('2023-02-20')
      },
      {
        title: 'Mensual Febrero',
        project_id: projects[3].id,
        mes_entrega: 3,
        on_time: true,
        retrabajo: false,
        narrative_quality: 4.7,
        graphics_effectiveness: 4.8,
        format_design: 4.6,
        relevant_insights: 4.9,
        operations_feedback: 4.7,
        client_feedback: 4.6,
        feedback_general_cliente: 4.7,
        brief_compliance: 4.8,
        hours_available: 35,
        hours_real: 32.89,
        hours_compliance: 1.06,
        delivery_date: new Date('2023-03-10'),
        due_date: new Date('2023-03-15')
      },
      {
        title: 'Ejecutivo NFC',
        project_id: projects[4].id,
        mes_entrega: 3,
        on_time: true,
        retrabajo: false,
        narrative_quality: 4.4,
        graphics_effectiveness: 4.3,
        format_design: 4.5,
        relevant_insights: 4.2,
        operations_feedback: 4.6,
        client_feedback: 4.3,
        feedback_general_cliente: 4.4,
        brief_compliance: 4.5,
        hours_available: 25,
        hours_real: 24.75,
        hours_compliance: 1.01,
        delivery_date: new Date('2023-03-25'),
        due_date: new Date('2023-03-28')
      },
      {
        title: 'Mensual Marzo',
        project_id: projects[5].id,
        mes_entrega: 4,
        on_time: false,
        retrabajo: true,
        narrative_quality: 3.5,
        graphics_effectiveness: 3.3,
        format_design: 3.4,
        relevant_insights: 3.6,
        operations_feedback: 3.2,
        client_feedback: 3.0,
        feedback_general_cliente: 3.1,
        brief_compliance: 3.3,
        hours_available: 35,
        hours_real: 45.12,
        hours_compliance: 0.78,
        delivery_date: new Date('2023-04-17'),
        due_date: new Date('2023-04-15')
      }
    ];

    // Insertar los entregables
    const insertedDeliverables = await db.insert(deliverables).values(modoDeliverables).returning();
    console.log(`${insertedDeliverables.length} entregables insertados correctamente.`);

    // Insertar algunos comentarios
    const comments = [
      {
        clientId: modoClient.id,
        year: 2023,
        quarter: 1,
        commentText: 'Excelente trabajo en los informes ejecutivos. La calidad narrativa y los insights han sido destacables. Para el próximo trimestre, nos gustaría ver más análisis de tendencias regionales.',
        createdAt: new Date('2023-03-31')
      },
      {
        clientId: modoClient.id,
        year: 2023,
        quarter: 2,
        commentText: 'Buena evolución en el diseño de los informes mensuales. El cliente ha valorado positivamente las visualizaciones interactivas. Necesitamos mejorar los tiempos de entrega para evitar retrabajos.',
        createdAt: new Date('2023-06-30')
      }
    ];

    await db.delete(clientModoComments).where(eq(clientModoComments.clientId, modoClient.id));
    const insertedComments = await db.insert(clientModoComments).values(comments).returning();
    console.log(`${insertedComments.length} comentarios insertados correctamente.`);

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