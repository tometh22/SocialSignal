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

// Función principal para importar datos
async function importModoData() {
  try {
    console.log('Iniciando importación de datos MODO...');
    
    // Leer el archivo CSV
    const csvContent = readFileSync('./attached_assets/MODO - Modo.csv', 'utf-8');
    
    // Parsear el CSV
    const records = parse(csvContent, {
      columns: false,
      skip_empty_lines: true,
      from_line: 4 // Empezar desde la fila 4 (saltando encabezados)
    });
    
    // Encontrar el ID del cliente MODO
    // Primero verificamos si existe la tabla y luego ejecutamos la consulta
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
      if (!record[0] || record[0].trim() === '') {
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
        disponible: record[12],
        real: record[13],
        cumplimientoHoras: record[14],
        feedbackCliente: record[18], // Posición correcta según el CSV
        cumplimientoBrief: record[22], // Posición correcta según el CSV
      };
      
      // Extraer comentario del cliente (solo aparece en ciertas filas)
      if (i === 5) { // La fila 5 (índice 4 + 1 porque empezamos desde la fila 4) tiene el comentario
        rowData.comentarioCliente = record[24];
      }
      
      // Sacar el mes para determinar trimestre y año
      const mesNum = parseInt(rowData.mesEntrega || '0', 10);
      if (mesNum) {
        rowData.quarter = Math.ceil(mesNum / 3);
        rowData.year = 2023; // Asumimos que todos los datos son de 2023
      }
      
      console.log(`Procesando: ${rowData.entregable} (Mes: ${rowData.mesEntrega})`);
      
      // Verificar duplicados
      const entregableKey = `${rowData.entregable}-${rowData.mesEntrega}`;
      if (processedEntregables.has(entregableKey)) {
        console.log(`Omitiendo entregable duplicado: ${entregableKey}`);
        continue;
      }
      
      processedEntregables.add(entregableKey);
      
      // Convertir campos numéricos
      const narrativeQuality = parseFloat(rowData.calidadNarrativa?.replace(',', '.') || '0');
      const graphicsEffectiveness = parseFloat(rowData.efectividadGraficos?.replace(',', '.') || '0');
      const formatDesign = parseFloat(rowData.formatoDiseno?.replace(',', '.') || '0');
      const relevantInsights = parseFloat(rowData.insightsRelevantes?.replace(',', '.') || '0');
      const operationsFeedback = parseFloat(rowData.feedbackOperaciones?.replace(',', '.') || '0');
      const hoursEstimated = parseFloat(rowData.disponible || '0');
      const hoursActual = parseFloat(rowData.real || '0');
      const clientFeedback = parseFloat(rowData.feedbackCliente?.replace(',', '.') || '0');
      const briefCompliance = parseFloat(rowData.cumplimientoBrief?.replace(',', '.') || '0');
      
      // Determinar analista principal y PM
      let analystId: string | number | null = null;
      let pmId: string | number | null = null;
      
      if (rowData.analistas) {
        const analistas = rowData.analistas.split(',').map(a => a.trim());
        if (analistas.length > 0) {
          const analista = analistas[0];
          analystId = personnelMap.get(analista) || null;
        }
      }
      
      if (rowData.pm) {
        pmId = personnelMap.get(rowData.pm.trim()) || null;
      }
      
      // Guardar en la base de datos - Entregable
      try {
        // Convertir el mes a formato de 2 dígitos
        const mesStr = rowData.mesEntrega ? rowData.mesEntrega.padStart(2, '0') : '01';
        
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
            clientId, // project_id - Usamos el ID del cliente como project_id por ahora
            rowData.entregable,
            `2023-${mesStr}-15`, // Fecha de entrega (mes-15)
            `2023-${mesStr}-10`, // Fecha límite (mes-10)
            rowData.entregaATiempo?.toLowerCase() === 'si',
            narrativeQuality,
            graphicsEffectiveness,
            formatDesign,
            relevantInsights,
            operationsFeedback,
            clientFeedback,
            briefCompliance,
            rowData.comentarioCliente || ''
          ]
        );
        
        console.log(`✅ Entregable "${rowData.entregable}" guardado con ID: ${rows[0].id}`);
        validRecords.push(rowData);
      } catch (error) {
        console.error(`Error al guardar entregable "${rowData.entregable}":`, error);
      }
    }
    
    console.log(`Total entregables procesados: ${validRecords.length}`);
    
    // Agregar comentarios por trimestre
    const { rows: modoComments } = await pool.query(
      'SELECT comment_text FROM client_modo_comments WHERE client_id = $1',
      [clientId]
    );
    
    // Si no hay comentarios, agregamos el que encontramos en el CSV
    if (modoComments.length === 0) {
      const comentario = 'En MODO necesitamos que la info sea más visual. Ajustar un poco la info para que no haya tanto texto y pueda visualizarse la información de manera que impacte más a las personas que toman decisiones.';
      
      await pool.query(
        `INSERT INTO client_modo_comments (
          client_id, comment_text, year, quarter, created_at, updated_at
        ) VALUES (
          $1, $2, $3, $4, NOW(), NOW()
        )`,
        [clientId, comentario, 2023, 2]
      );
      
      console.log('✅ Comentario MODO agregado para Q2 2023');
    } else {
      console.log('Ya existen comentarios MODO en la base de datos, omitiendo creación.');
    }
    
    console.log('Importación de datos MODO completada exitosamente.');
  } catch (error) {
    console.error('Error al importar datos MODO:', error);
  } finally {
    // Cerrar conexión a la base de datos
    await pool.end();
  }
}

// Ejecutar la función principal
importModoData();