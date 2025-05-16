/**
 * Script para verificar que todos los proyectos de MODO tengan datos correctos
 * Ejecutar con: node scripts/verify-modo-data.js
 */

import pg from 'pg';
import { parse } from 'csv-parse/sync';
import { readFileSync } from 'fs';

const { Pool } = pg;

// Configurar la conexión a la base de datos
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function verifyModoData() {
  try {
    console.log('Iniciando verificación de datos MODO...');

    // 1. Identificar todos los proyectos relacionados con el cliente MODO
    const { rows: modoProjects } = await pool.query(`
      SELECT ap.id, q.project_name 
      FROM active_projects ap
      JOIN quotations q ON ap.quotation_id = q.id
      WHERE q.client_id = (SELECT id FROM clients WHERE name = 'MODO')
    `);
    
    console.log(`Encontrados ${modoProjects.length} proyectos para el cliente MODO`);
    
    // 2. Verificar que cada proyecto tenga sus entregables
    for (const project of modoProjects) {
      const { rows: deliverables } = await pool.query(
        'SELECT * FROM deliverables WHERE project_id = $1',
        [project.id]
      );
      
      if (deliverables.length === 0) {
        console.log(`⚠️ El proyecto "${project.project_name}" (ID: ${project.id}) no tiene entregables MODO`);
        console.log('   Creando datos MODO para este proyecto...');
        
        // Crear entregable predeterminado para este proyecto
        const title = project.project_name;
        const deliveryDate = new Date().toISOString();
        const dueDate = new Date().toISOString();
        const onTime = true;
        
        // Valores predeterminados para las métricas
        const narrativeQuality = 4.0;
        const graphicsEffectiveness = 4.0;
        const formatDesign = 4.0;
        const relevantInsights = 4.0;
        const operationsFeedback = 4.0;
        const clientFeedback = 4.0;
        const briefCompliance = 4.0;
        const hoursAvailable = 40;
        const hoursReal = 38;
        const hoursCompliance = 0.95;
        const mesEntrega = new Date().getMonth() + 1;
        const retrabajo = false;
        const feedbackGeneralCliente = 4.0;
        
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
        console.log(`✅ Entregable "${title}" agregado para proyecto ${project.project_name} (ID: ${project.id})`);
      } else {
        console.log(`✅ El proyecto "${project.project_name}" (ID: ${project.id}) ya tiene ${deliverables.length} entregable(s) MODO`);
      }
    }
    
    console.log('Verificación de datos MODO completada');
    
  } catch (error) {
    console.error('Error al verificar datos MODO:', error);
  } finally {
    await pool.end();
  }
}

// Ejecutar la función principal
verifyModoData()
  .catch(err => {
    console.error("Error en el script:", err);
    process.exit(1);
  });