import { readFileSync } from 'fs';
import { parse } from 'csv-parse/sync';
import { pool } from '../server/db';

// Definir estructura de los datos
interface ModoRow {
  cliente: string;
  entregable: string;
  mesEntrega: string;
  analistas: string;
  pm: string;
  entregaATiempo: string;
  retrabajo: string;
  calidadNarrativa: string;
  efectividadGraficos: string;
  formatoDiseno: string;
  insightsRelevantes: string;
  feedbackOperaciones: string;
  disponible: string;
  real: string;
  cumplimientoHoras: string;
  feedbackCliente: string;
  cumplimientoBrief: string;
  comentarioCliente: string;
  quarter: number;
  year: number;
}

// Función para parsear un valor numérico desde una cadena con formato español (coma decimal)
function parseNumericValue(value: string | undefined): number {
  if (!value || value.trim() === '') return 0;
  return parseFloat(value.replace(',', '.') || '0');
}

// Función principal para importar datos
async function fixModoData() {
  try {
    console.log('Iniciando corrección de datos MODO...');
    
    // Verificar si existen entregables para MODO
    const { rows: existingDeliverables } = await pool.query(
      "SELECT COUNT(*) as count FROM deliverables WHERE project_id = 4"
    );
    
    if (parseInt(existingDeliverables[0].count) > 0) {
      console.log(`Ya existen ${existingDeliverables[0].count} entregables para MODO. Omitiendo importación.`);
      return;
    }
    
    // Leer el archivo CSV
    const csvContent = readFileSync('./attached_assets/MODO - Modo.csv', 'utf-8');
    
    // Parsear el CSV
    const records = parse(csvContent, {
      columns: false,
      skip_empty_lines: true,
      from_line: 4 // Empezar desde la fila 4 (saltando encabezados)
    });
    
    // Encontrar el ID del cliente MODO
    const { rows: clientRows } = await pool.query(
      "SELECT id FROM clients WHERE name = 'MODO'"
    );
    
    if (clientRows.length === 0) {
      throw new Error('Cliente MODO no encontrado en la base de datos');
    }
    
    const clientId = clientRows[0].id;
    console.log(`Cliente MODO encontrado con ID: ${clientId}`);
    
    // Buscar personal (analistas y PM)
    const { rows: personnelRows } = await pool.query(
      'SELECT id, name FROM personnel'
    );
    
    const personnelMap = new Map<string, number>();
    personnelRows.forEach(person => {
      personnelMap.set(person.name, person.id);
    });
    
    console.log('Personal mapeado:', Object.fromEntries(personnelMap));
    
    // Para control de duplicados
    const processedEntregables = new Set<string>();
    
    // Convertir registros y guardar en la base de datos
    const validRecords: Partial<ModoRow>[] = [];
    
    for (let i = 0; i < records.length; i++) {
      const record = records[i];
      
      // Verificar si la fila tiene datos útiles
      if (!record[0] || record[0].trim() === '' || record[0].trim() !== 'Modo') {
        continue;
      }
      
      // Extraer datos de la fila
      const rowData: Partial<ModoRow> = {
        cliente: record[0],
        entregable: record[1],
        mesEntrega: record[2],
        analistas: record[3],
        pm: record[4],
        entregaATiempo: record[5],
        retrabajo: record[6],
        calidadNarrativa: record[7],
        efectividadGraficos: record[8],
        formatoDiseno: record[9],
        insightsRelevantes: record[10],
        feedbackOperaciones: record[11],
        disponible: record[13],
        real: record[14],
        cumplimientoHoras: record[15],
        feedbackCliente: record[18],
        cumplimientoBrief: record[21],
      };
      
      // Extraer comentario del cliente (solo aparece en ciertas filas)
      if (i === 5) { // La fila 5 (Q1 2023)
        rowData.comentarioCliente = record[24];
        rowData.quarter = 1;
        rowData.year = 2023;
      } else if (i === 6) { // La fila 6 (Q2 2023)
        rowData.comentarioCliente = record[24];
        rowData.quarter = 2;
        rowData.year = 2023;
      } else {
        // Para las demás filas, determinar trimestre por mes
        const mesNum = parseInt(rowData.mesEntrega || '0', 10);
        if (mesNum) {
          rowData.quarter = Math.ceil(mesNum / 3);
          rowData.year = 2023; // Asumimos que todos los datos son de 2023
        }
      }
      
      // Solo procesar filas con título de entregable
      if (!rowData.entregable || rowData.entregable.trim() === '') {
        continue;
      }
      
      console.log(`Procesando: ${rowData.entregable} (Mes: ${rowData.mesEntrega || 'N/A'})`);
      
      // Verificar duplicados
      const entregableKey = `${rowData.entregable}-${rowData.mesEntrega || 'N/A'}`;
      if (processedEntregables.has(entregableKey)) {
        console.log(`Omitiendo entregable duplicado: ${entregableKey}`);
        continue;
      }
      
      processedEntregables.add(entregableKey);
      
      // Convertir campos numéricos
      const narrativeQuality = parseNumericValue(rowData.calidadNarrativa);
      const graphicsEffectiveness = parseNumericValue(rowData.efectividadGraficos);
      const formatDesign = parseNumericValue(rowData.formatoDiseno);
      const relevantInsights = parseNumericValue(rowData.insightsRelevantes);
      const operationsFeedback = parseNumericValue(rowData.feedbackOperaciones);
      const clientFeedback = parseNumericValue(rowData.feedbackCliente);
      const briefCompliance = parseNumericValue(rowData.cumplimientoBrief);
      
      // Convertir el mes a formato de fecha
      let deliveryDate = null;
      let dueDate = null;
      
      if (rowData.mesEntrega && !isNaN(parseInt(rowData.mesEntrega))) {
        const mesStr = rowData.mesEntrega.padStart(2, '0');
        deliveryDate = `2023-${mesStr}-15`; // Fecha de entrega (mes-15)
        dueDate = `2023-${mesStr}-10`;      // Fecha límite (mes-10)
      }
      
      // Determinar si se entregó a tiempo
      const onTime = rowData.entregaATiempo?.toLowerCase() === 'si';
      
      // Guardar en la base de datos con el project_id correcto (ID 4)
      try {
        const { rows } = await pool.query(
          `INSERT INTO deliverables (
            project_id, title, delivery_date, due_date, on_time, 
            narrative_quality, graphics_effectiveness, format_design, 
            relevant_insights, operations_feedback, client_feedback, 
            brief_compliance, notes, created_at, updated_at
          ) VALUES (
            $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, NOW(), NOW()
          ) RETURNING id`,
          [
            4, // project_id correcto para MODO
            rowData.entregable,
            deliveryDate,
            dueDate,
            onTime,
            narrativeQuality,
            graphicsEffectiveness,
            formatDesign,
            relevantInsights,
            operationsFeedback,
            clientFeedback,
            briefCompliance,
            rowData.comentarioCliente || `Analistas: ${rowData.analistas || 'N/A'}. PM: ${rowData.pm || 'N/A'}.`
          ]
        );
        
        console.log(`✅ Entregable "${rowData.entregable}" guardado con ID: ${rows[0].id}`);
        validRecords.push(rowData);
      } catch (error: any) {
        console.error(`Error al guardar entregable "${rowData.entregable}":`, error.message);
      }
    }
    
    console.log(`Total entregables procesados: ${validRecords.length}`);
    console.log('Corrección de datos MODO completada exitosamente.');
  } catch (error: any) {
    console.error('Error al corregir datos MODO:', error.message);
  } finally {
    // Cerrar conexión a la base de datos
    await pool.end();
  }
}

// Ejecutar la función principal
fixModoData();