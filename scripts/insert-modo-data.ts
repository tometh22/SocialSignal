import { db } from "../server/db";
import { deliverables, clientModoComments } from "../shared/schema";

async function insertModoData() {
  try {
    console.log("Comenzando inserción de datos MODO...");
    
    // 1. Insertamos los entregables basados en el CSV proporcionado
    const deliverablesData = [
      // Entregable 1
      {
        project_id: 1, // Asumimos un ID de proyecto básico
        title: "Ejecutivo Sony One",
        delivery_date: new Date(2023, 0, 15).toISOString(), // Enero 15, 2023
        due_date: new Date(2023, 0, 15).toISOString(),      // Asumimos misma fecha
        on_time: true,
        narrative_quality: 5.0,
        graphics_effectiveness: 5.0,
        format_design: 5.0,
        relevant_insights: 5.0,
        operations_feedback: 5.0,
        client_feedback: 4.0,
        brief_compliance: 5.0,
        notes: "Analistas: Vanu, Trini. PM: Vanu. Datos basados en Excel MODO."
      },
      // Entregable 2
      {
        project_id: 1,
        title: "Mensual Enero",
        delivery_date: new Date(2023, 1, 15).toISOString(), // Febrero 15, 2023
        due_date: new Date(2023, 1, 15).toISOString(),
        on_time: true,
        narrative_quality: 3.0,
        graphics_effectiveness: 5.0,
        format_design: 5.0,
        relevant_insights: 4.0,
        operations_feedback: 4.25,
        client_feedback: 5.0,
        brief_compliance: 5.0,
        notes: "Analistas: Vanu, Trini. PM: Vanu. Datos basados en Excel MODO."
      },
      // Entregable 3
      {
        project_id: 1,
        title: "Ejecutivo Telepase",
        delivery_date: new Date(2023, 0, 20).toISOString(), // Enero 20, 2023
        due_date: new Date(2023, 0, 20).toISOString(),
        on_time: true,
        narrative_quality: 5.0,
        graphics_effectiveness: 5.0,
        format_design: 5.0,
        relevant_insights: 5.0,
        operations_feedback: 5.0,
        client_feedback: 5.0,
        brief_compliance: 5.0,
        notes: "Analistas: Vanu, Trini. PM: Vanu. Datos basados en Excel MODO."
      },
      // Entregable 4
      {
        project_id: 1,
        title: "Mensual Febrero",
        delivery_date: new Date(2023, 2, 15).toISOString(), // Marzo 15, 2023
        due_date: new Date(2023, 2, 15).toISOString(),
        on_time: true,
        narrative_quality: 5.0,
        graphics_effectiveness: 5.0,
        format_design: 5.0,
        relevant_insights: 5.0,
        operations_feedback: 5.0,
        client_feedback: 5.0,
        brief_compliance: 5.0,
        notes: "Analistas: Vanu, Trini. PM: Vanu. Datos basados en Excel MODO."
      },
      // Entregable 5
      {
        project_id: 1,
        title: "Ejecutivo NFC",
        delivery_date: new Date(2023, 2, 20).toISOString(), // Marzo 20, 2023
        due_date: new Date(2023, 2, 20).toISOString(),
        on_time: true,
        narrative_quality: 5.0,
        graphics_effectiveness: 5.0,
        format_design: 5.0,
        relevant_insights: 5.0,
        operations_feedback: 5.0,
        client_feedback: 4.0,
        brief_compliance: 4.0,
        notes: "Analistas: Vanu, Trini. PM: Vanu. Datos basados en Excel MODO."
      },
      // Entregable 6
      {
        project_id: 1,
        title: "Ejecutivo Sony One Febrero",
        delivery_date: new Date(2023, 2, 25).toISOString(), // Marzo 25, 2023
        due_date: new Date(2023, 2, 25).toISOString(),
        on_time: true,
        narrative_quality: 5.0,
        graphics_effectiveness: 5.0,
        format_design: 5.0,
        relevant_insights: 5.0,
        operations_feedback: 5.0,
        client_feedback: 5.0,
        brief_compliance: 5.0,
        notes: "Analistas: Vanu, Trini. PM: Vanu. Datos basados en Excel MODO."
      },
      // Entregable 7
      {
        project_id: 1,
        title: "Mensual Marzo",
        delivery_date: new Date(2023, 3, 15).toISOString(), // Abril 15, 2023
        due_date: new Date(2023, 3, 15).toISOString(),
        on_time: true,
        narrative_quality: 5.0,
        graphics_effectiveness: 5.0,
        format_design: 5.0,
        relevant_insights: 5.0,
        operations_feedback: 5.0,
        client_feedback: 5.0,
        brief_compliance: 5.0,
        notes: "Analistas: Vanu, Trini. PM: Vanu. Datos basados en Excel MODO."
      },
      // Entregable 8
      {
        project_id: 1,
        title: "Ejecutivo Comercios",
        delivery_date: new Date(2023, 3, 25).toISOString(), // Abril 25, 2023
        due_date: new Date(2023, 3, 25).toISOString(),
        on_time: true,
        narrative_quality: 5.0,
        graphics_effectiveness: 5.0,
        format_design: 5.0,
        relevant_insights: 5.0,
        operations_feedback: 5.0,
        client_feedback: 5.0,
        brief_compliance: 5.0,
        notes: "Analistas: Vanu, Trini. PM: Vanu. Datos basados en Excel MODO."
      }
    ];

    // Agregando datos a la tabla de entregables
    for (const deliverable of deliverablesData) {
      console.log(`Insertando entregable: ${deliverable.title}`);
      await db.insert(deliverables).values(deliverable);
    }
    console.log("Entregables insertados correctamente.");

    // 2. Insertamos los comentarios del cliente
    const commentsData = [
      {
        client_id: 17, // El ID del cliente MODO en la base de datos
        comment_text: "En MODO necesitamos que la info sea mas visual. Ajustaria un poco la info para que no haya tanto texto y pueda visualizarse la informacion de manera que impacte más a las personas que toman decisiones",
        year: 2023,
        quarter: 1,
        timestamp: new Date(2023, 2, 30).toISOString() // 30 de marzo, 2023
      },
      {
        client_id: 17,
        comment_text: "Bien: entrega y presentacion de los informes Refuerzo: tiempos. A veces necesitamos los informes esten antes para poder tomar otro tipo de decisión. Sin embargo, cada vez que necesitamos algo, estan ahi presentandolo :)",
        year: 2023,
        quarter: 2,
        timestamp: new Date(2023, 5, 15).toISOString() // 15 de junio, 2023
      }
    ];

    // Agregando datos a la tabla de comentarios
    for (const comment of commentsData) {
      console.log(`Insertando comentario del trimestre ${comment.quarter} del año ${comment.year}`);
      await db.insert(clientModoComments).values(comment);
    }
    console.log("Comentarios insertados correctamente.");

    console.log("Inserción de datos MODO completada con éxito.");
  } catch (error) {
    console.error("Error al insertar datos MODO:", error);
  }
}

// Ejecutar la función inmediatamente
insertModoData()
  .then(() => {
    console.log("Script completado.");
    process.exit(0);
  })
  .catch((error) => {
    console.error("Error en el script:", error);
    process.exit(1);
  });