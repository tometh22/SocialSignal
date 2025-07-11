
const { Pool } = require('pg');

// Configuración de la base de datos
const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

async function checkSantiagoHours() {
  try {
    console.log('🔍 Consultando horas de Santiago Berisso en proyecto Warner...\n');
    
    // Primero encontramos el ID de Santiago Berisso
    const personnelResult = await pool.query(`
      SELECT id, name FROM personnel WHERE name ILIKE '%santiago%berisso%'
    `);
    
    if (personnelResult.rows.length === 0) {
      console.log('❌ No se encontró Santiago Berisso en la base de datos');
      return;
    }
    
    const santiagoId = personnelResult.rows[0].id;
    console.log(`✅ Santiago Berisso encontrado - ID: ${santiagoId}`);
    
    // Encontrar el proyecto Warner (ID 26 según los logs)
    const projectsResult = await pool.query(`
      SELECT ap.id, q.project_name, q.client_id, c.name as client_name
      FROM active_projects ap
      JOIN quotations q ON ap.quotation_id = q.id
      JOIN clients c ON q.client_id = c.id
      WHERE q.project_name ILIKE '%warner%' OR c.name ILIKE '%warner%'
    `);
    
    console.log('📋 Proyectos Warner encontrados:');
    projectsResult.rows.forEach(p => {
      console.log(`  - ID: ${p.id}, Proyecto: ${p.project_name}, Cliente: ${p.client_name}`);
    });
    
    if (projectsResult.rows.length === 0) {
      console.log('❌ No se encontraron proyectos de Warner');
      return;
    }
    
    // Usar el proyecto ID 26 (Contrato 2025 según el script bulk)
    const warnerProjectId = 26;
    
    // Consultar horas por mes
    const mayHoursResult = await pool.query(`
      SELECT 
        DATE_TRUNC('month', date) as month,
        SUM(hours) as total_hours,
        COUNT(*) as entries_count
      FROM time_entries 
      WHERE project_id = $1 
        AND personnel_id = $2 
        AND date >= '2025-05-01' 
        AND date < '2025-06-01'
      GROUP BY DATE_TRUNC('month', date)
    `, [warnerProjectId, santiagoId]);
    
    const juneHoursResult = await pool.query(`
      SELECT 
        DATE_TRUNC('month', date) as month,
        SUM(hours) as total_hours,
        COUNT(*) as entries_count
      FROM time_entries 
      WHERE project_id = $1 
        AND personnel_id = $2 
        AND date >= '2025-06-01' 
        AND date < '2025-07-01'
      GROUP BY DATE_TRUNC('month', date)
    `, [warnerProjectId, santiagoId]);
    
    // Mostrar todas las entradas de Santiago en el proyecto Warner
    const allEntriesResult = await pool.query(`
      SELECT 
        date,
        hours,
        description,
        DATE_TRUNC('month', date) as month
      FROM time_entries 
      WHERE project_id = $1 AND personnel_id = $2
      ORDER BY date DESC
    `, [warnerProjectId, santiagoId]);
    
    console.log('\n📊 RESUMEN DE HORAS - SANTIAGO BERISSO EN PROYECTO WARNER:');
    console.log('='.repeat(60));
    
    console.log('\n🗓️ MAYO 2025:');
    if (mayHoursResult.rows.length > 0) {
      console.log(`   Total de horas: ${mayHoursResult.rows[0].total_hours}h`);
      console.log(`   Número de registros: ${mayHoursResult.rows[0].entries_count}`);
    } else {
      console.log('   No hay registros de horas en mayo 2025');
    }
    
    console.log('\n🗓️ JUNIO 2025:');
    if (juneHoursResult.rows.length > 0) {
      console.log(`   Total de horas: ${juneHoursResult.rows[0].total_hours}h`);
      console.log(`   Número de registros: ${juneHoursResult.rows[0].entries_count}`);
    } else {
      console.log('   No hay registros de horas en junio 2025');
    }
    
    console.log('\n📋 DETALLE DE TODAS LAS ENTRADAS:');
    if (allEntriesResult.rows.length > 0) {
      allEntriesResult.rows.forEach(entry => {
        const monthName = new Date(entry.month).toLocaleDateString('es-ES', { 
          month: 'long', 
          year: 'numeric' 
        });
        const dateStr = entry.date.toISOString().split('T')[0];
        console.log(`   ${dateStr} | ${entry.hours}h | ${monthName} | ${entry.description || 'Sin descripción'}`);
      });
      
      const totalHours = allEntriesResult.rows.reduce((sum, entry) => sum + parseFloat(entry.hours), 0);
      console.log(`\n💯 TOTAL GENERAL: ${totalHours}h en ${allEntriesResult.rows.length} registros`);
    } else {
      console.log('   No se encontraron registros de tiempo para Santiago Berisso en el proyecto Warner');
    }
    
  } catch (error) {
    console.error('Error al consultar las horas:', error);
  } finally {
    await pool.end();
  }
}

// Ejecutar la consulta
checkSantiagoHours().catch(console.error);
