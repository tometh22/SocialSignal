  async getClientModoSummary(clientId: number): Promise<{
    totalDeliverables: number;
    onTimeDeliveries: number;
    onTimePercentage: number;
    averageScores: {
      narrativeQuality: number;
      graphicsEffectiveness: number;
      formatDesign: number;
      relevantInsights: number;
      operationsFeedback: number;
      clientFeedback: number;
      briefCompliance: number;
    };
    totalComments: number;
    latestComment: ClientModoComment | undefined;
  }> {
    try {
      // Obtener todos los proyectos de este cliente
      const projectsResult = await db
        .select()
        .from(activeProjects)
        .where(eq(activeProjects.clientId, clientId));
      
      const projectIds = projectsResult.map(p => p.id);
      
      // Obtener todos los entregables para estos proyectos
      const clientDeliverables = await db
        .select()
        .from(deliverables)
        .where(inArray(deliverables.projectId, projectIds));
        
      // Calcular métricas
      const totalDeliverables = clientDeliverables.length;
      const onTimeDeliveries = clientDeliverables.filter(d => d.onTime).length;
      const onTimePercentage = totalDeliverables > 0 ? (onTimeDeliveries / totalDeliverables) * 100 : 0;
      
      // Inicializar sumas para promedios
      let sumNarrativeQuality = 0;
      let sumGraphicsEffectiveness = 0;
      let sumFormatDesign = 0;
      let sumRelevantInsights = 0;
      let sumOperationsFeedback = 0;
      let sumClientFeedback = 0;
      let sumBriefCompliance = 0;
      
      let countNarrativeQuality = 0;
      let countGraphicsEffectiveness = 0;
      let countFormatDesign = 0;
      let countRelevantInsights = 0;
      let countOperationsFeedback = 0;
      let countClientFeedback = 0;
      let countBriefCompliance = 0;
      
      // Sumar valores para cada categoría (ignorando null/undefined)
      for (const deliverable of clientDeliverables) {
        if (deliverable.narrativeQuality !== null && deliverable.narrativeQuality !== undefined) {
          sumNarrativeQuality += Number(deliverable.narrativeQuality);
          countNarrativeQuality++;
        }
        
        if (deliverable.graphicsEffectiveness !== null && deliverable.graphicsEffectiveness !== undefined) {
          sumGraphicsEffectiveness += Number(deliverable.graphicsEffectiveness);
          countGraphicsEffectiveness++;
        }
        
        if (deliverable.formatDesign !== null && deliverable.formatDesign !== undefined) {
          sumFormatDesign += Number(deliverable.formatDesign);
          countFormatDesign++;
        }
        
        if (deliverable.relevantInsights !== null && deliverable.relevantInsights !== undefined) {
          sumRelevantInsights += Number(deliverable.relevantInsights);
          countRelevantInsights++;
        }
        
        if (deliverable.operationsFeedback !== null && deliverable.operationsFeedback !== undefined) {
          sumOperationsFeedback += Number(deliverable.operationsFeedback);
          countOperationsFeedback++;
        }
        
        if (deliverable.clientFeedback !== null && deliverable.clientFeedback !== undefined) {
          sumClientFeedback += Number(deliverable.clientFeedback);
          countClientFeedback++;
        }
        
        if (deliverable.briefCompliance !== null && deliverable.briefCompliance !== undefined) {
          sumBriefCompliance += Number(deliverable.briefCompliance);
          countBriefCompliance++;
        }
      }
      
      // Calcular promedios
      const averageNarrativeQuality = countNarrativeQuality > 0 ? sumNarrativeQuality / countNarrativeQuality : 0;
      const averageGraphicsEffectiveness = countGraphicsEffectiveness > 0 ? sumGraphicsEffectiveness / countGraphicsEffectiveness : 0;
      const averageFormatDesign = countFormatDesign > 0 ? sumFormatDesign / countFormatDesign : 0;
      const averageRelevantInsights = countRelevantInsights > 0 ? sumRelevantInsights / countRelevantInsights : 0;
      const averageOperationsFeedback = countOperationsFeedback > 0 ? sumOperationsFeedback / countOperationsFeedback : 0;
      const averageClientFeedback = countClientFeedback > 0 ? sumClientFeedback / countClientFeedback : 0;
      const averageBriefCompliance = countBriefCompliance > 0 ? sumBriefCompliance / countBriefCompliance : 0;
      
      // Obtener comentarios MODO
      const comments = await db
        .select()
        .from(clientModoComments)
        .where(eq(clientModoComments.clientId, clientId))
        .orderBy(desc(clientModoComments.year));
      
      const totalComments = comments.length;
      const latestComment = comments.length > 0 ? comments[0] : undefined;
      
      return {
        totalDeliverables,
        onTimeDeliveries,
        onTimePercentage,
        averageScores: {
          narrativeQuality: averageNarrativeQuality,
          graphicsEffectiveness: averageGraphicsEffectiveness,
          formatDesign: averageFormatDesign,
          relevantInsights: averageRelevantInsights,
          operationsFeedback: averageOperationsFeedback,
          clientFeedback: averageClientFeedback,
          briefCompliance: averageBriefCompliance
        },
        totalComments,
        latestComment
      };
    } catch (error) {
      console.error("Error al obtener resumen MODO del cliente:", error);
      throw error;
    }
  }