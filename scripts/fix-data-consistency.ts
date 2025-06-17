import { pool } from '../server/db';

async function fixDataConsistency() {
  console.log('🔧 Iniciando corrección de consistencia de datos...');

  try {
    // 1. Obtener cotizaciones aprobadas sin proyectos activos
    const { rows: approvedQuotations } = await pool.query(`
      SELECT q.id, q.project_name, q.client_id, q.estimated_hours, q.total_amount
      FROM quotations q
      LEFT JOIN active_projects ap ON ap.quotation_id = q.id
      WHERE q.status = 'approved' AND ap.id IS NULL
    `);

    console.log(`📋 Encontradas ${approvedQuotations.length} cotizaciones aprobadas sin proyectos activos`);

    // 2. Crear proyectos activos para cada cotización aprobada
    for (const quotation of approvedQuotations) {
      const startDate = new Date();
      const endDate = new Date();
      endDate.setMonth(endDate.getMonth() + 3); // 3 meses por defecto

      const { rows: newProject } = await pool.query(`
        INSERT INTO active_projects (
          quotation_id, status, start_date, expected_end_date, 
          tracking_frequency, notes, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
        RETURNING id
      `, [
        quotation.id,
        'active',
        startDate.toISOString(),
        endDate.toISOString(),
        'mensual',
        `Proyecto creado automáticamente a partir de cotización aprobada "${quotation.project_name}"`
      ]);

      console.log(`✅ Proyecto creado para cotización "${quotation.project_name}" (ID: ${newProject[0].id})`);
    }

    // 3. Verificar y corregir referencias de clientes
    const { rows: orphanProjects } = await pool.query(`
      SELECT ap.id, ap.quotation_id, q.client_id, q.project_name
      FROM active_projects ap
      JOIN quotations q ON q.id = ap.quotation_id
      WHERE ap.client_id IS NULL AND q.client_id IS NOT NULL
    `);

    for (const project of orphanProjects) {
      await pool.query(`
        UPDATE active_projects 
        SET client_id = $1, updated_at = NOW()
        WHERE id = $2
      `, [project.client_id, project.id]);

      console.log(`🔗 Vinculado proyecto "${project.project_name}" con cliente ID ${project.client_id}`);
    }

    // 4. Verificar integridad de sesiones de usuario
    await pool.query(`
      DELETE FROM sessions 
      WHERE expire < NOW()
    `);

    console.log('🧹 Limpiadas sesiones expiradas');

    // 5. Estadísticas finales
    const { rows: stats } = await pool.query(`
      SELECT 
        (SELECT COUNT(*) FROM users) as users_count,
        (SELECT COUNT(*) FROM clients) as clients_count,
        (SELECT COUNT(*) FROM quotations WHERE status = 'approved') as approved_quotations,
        (SELECT COUNT(*) FROM active_projects) as active_projects,
        (SELECT COUNT(*) FROM deliverables) as deliverables_count
    `);

    console.log('\n📊 Estadísticas actualizadas:');
    console.log(`- Usuarios: ${stats[0].users_count}`);
    console.log(`- Clientes: ${stats[0].clients_count}`);
    console.log(`- Cotizaciones aprobadas: ${stats[0].approved_quotations}`);
    console.log(`- Proyectos activos: ${stats[0].active_projects}`);
    console.log(`- Entregables: ${stats[0].deliverables_count}`);

    console.log('\n✅ Corrección de consistencia completada exitosamente');

  } catch (error) {
    console.error('❌ Error en corrección de consistencia:', error);
    throw error;
  }
}

fixDataConsistency()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

export { fixDataConsistency };