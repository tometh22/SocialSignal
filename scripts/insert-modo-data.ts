import { db } from "../server/db";
import { deliverables, clientModoComments } from "../shared/schema";

async function insertModoData() {
  try {
    console.log("Comenzando inserción de datos MODO...");
    
    // 1. Insertamos los entregables basados en el CSV proporcionado
    const deliverablesData = [
      // Entregable 1
      {
        clientId: 17, // El ID del cliente MODO en la base de datos
        name: "Ejecutivo Sony One",
        deliveryMonth: "1", // Mes de entrega (Jan)
        deliveryOnTime: true,
        narrativeQuality: 5.0,
        graphicsEffectiveness: 5.0,
        formatDesign: 5.0,
        relevantInsights: 5.0,
        operationsFeedback: 5.0,
        clientFeedback: 4.0,
        briefCompliance: 5.0,
        hoursEstimated: 40,
        hoursActual: 42.58
      },
      // Entregable 2
      {
        clientId: 17,
        name: "Mensual Enero",
        deliveryMonth: "2", // Mes de entrega (Feb)
        deliveryOnTime: true,
        narrativeQuality: 3.0,
        graphicsEffectiveness: 5.0,
        formatDesign: 5.0,
        relevantInsights: 4.0,
        operationsFeedback: 4.25,
        clientFeedback: 5.0,
        briefCompliance: 5.0,
        hoursEstimated: 45,
        hoursActual: 41
      },
      // Entregable 3
      {
        clientId: 17,
        name: "Ejecutivo Telepase",
        deliveryMonth: "1", // Mes de entrega (Jan)
        deliveryOnTime: true,
        narrativeQuality: 5.0,
        graphicsEffectiveness: 5.0,
        formatDesign: 5.0,
        relevantInsights: 5.0,
        operationsFeedback: 5.0,
        clientFeedback: 5.0,
        briefCompliance: 5.0,
        hoursEstimated: 40,
        hoursActual: 12.33
      },
      // Entregable 4
      {
        clientId: 17,
        name: "Mensual Febrero",
        deliveryMonth: "3", // Mes de entrega (Mar)
        deliveryOnTime: true,
        narrativeQuality: 5.0,
        graphicsEffectiveness: 5.0,
        formatDesign: 5.0,
        relevantInsights: 5.0,
        operationsFeedback: 5.0,
        clientFeedback: 5.0,
        briefCompliance: 5.0,
        hoursActual: 74.33
      },
      // Entregable 5
      {
        clientId: 17,
        name: "Ejecutivo NFC",
        deliveryMonth: "3", // Mes de entrega (Mar)
        deliveryOnTime: true,
        narrativeQuality: 5.0,
        graphicsEffectiveness: 5.0,
        formatDesign: 5.0,
        relevantInsights: 5.0,
        operationsFeedback: 5.0,
        clientFeedback: 4.0,
        briefCompliance: 4.0,
        hoursEstimated: 40,
        hoursActual: 32
      },
      // Entregable 6
      {
        clientId: 17,
        name: "Ejecutivo Sony One Febrero",
        deliveryMonth: "3", // Mes de entrega (Mar)
        deliveryOnTime: true,
        narrativeQuality: 5.0,
        graphicsEffectiveness: 5.0,
        formatDesign: 5.0,
        relevantInsights: 5.0,
        operationsFeedback: 5.0,
        clientFeedback: 5.0,
        briefCompliance: 5.0,
        hoursEstimated: 40,
        hoursActual: 32
      },
      // Entregable 7
      {
        clientId: 17,
        name: "Mensual Marzo",
        deliveryMonth: "4", // Mes de entrega (Apr)
        deliveryOnTime: true,
        narrativeQuality: 5.0,
        graphicsEffectiveness: 5.0,
        formatDesign: 5.0,
        relevantInsights: 5.0,
        operationsFeedback: 5.0,
        clientFeedback: 5.0,
        briefCompliance: 5.0
      },
      // Entregable 8
      {
        clientId: 17,
        name: "Ejecutivo Comercios",
        deliveryMonth: "4", // Mes de entrega (Apr)
        deliveryOnTime: true,
        narrativeQuality: 5.0,
        graphicsEffectiveness: 5.0,
        formatDesign: 5.0,
        relevantInsights: 5.0,
        operationsFeedback: 5.0,
        clientFeedback: 5.0,
        briefCompliance: 5.0
      }
    ];

    // Agregando datos a la tabla de entregables
    for (const deliverable of deliverablesData) {
      console.log(`Insertando entregable: ${deliverable.name}`);
      await db.insert(deliverables).values(deliverable);
    }
    console.log("Entregables insertados correctamente.");

    // 2. Insertamos los comentarios del cliente
    const commentsData = [
      {
        clientId: 17, // El ID del cliente MODO en la base de datos
        comments: "En MODO necesitamos que la info sea mas visual. Ajustaria un poco la info para que no haya tanto texto y pueda visualizarse la informacion de manera que impacte más a las personas que toman decisiones",
        year: 2023,
        quarter: 1,
        totalScore: 4.83,
        generalQuality: 5.0,
        insightsClarity: 5.0,
        presentation: 4.5,
        nps: 5.0,
        clientSurvey: 4.88,
        operationsFeedback: 4.91,
        hoursCompliance: 4.83,
        clientFeedback: 4.71,
        briefCompliance: 4.86
      },
      {
        clientId: 17,
        comments: "Bien: entrega y presentacion de los informes Refuerzo: tiempos. A veces necesitamos los informes esten antes para poder tomar otro tipo de decisión. Sin embargo, cada vez que necesitamos algo, estan ahi presentandolo :)",
        year: 2023,
        quarter: 2,
        totalScore: 4.84,
        generalQuality: 5.0,
        insightsClarity: 5.0,
        presentation: 4.5,
        nps: 5.0,
        clientSurvey: 4.88,
        operationsFeedback: 4.91,
        hoursCompliance: 4.83,
        clientFeedback: 4.71,
        briefCompliance: 4.86
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