import { db } from "./db";
import { roles, personnel, clients, reportTemplates, templateRoleAssignments } from "@shared/schema";

export async function reinitializeDatabase() {
  try {

    // Eliminar todos los datos existentes (en orden para respetar las restricciones de clave externa)
    await db.delete(templateRoleAssignments);
    await db.delete(personnel);
    await db.delete(reportTemplates);
    await db.delete(clients);
    await db.delete(roles);


    // Insertar roles
    const [seniorAnalyst] = await db.insert(roles).values({
      name: "Analista Senior",
      description: "Proporciona experiencia en análisis de datos sociales complejos y creación de insights estratégicos.",
      defaultRate: 85
    }).returning();

    const [dataScientist] = await db.insert(roles).values({
      name: "Científico de Datos",
      description: "Desarrolla métricas personalizadas y modelado avanzado de datos para insights más profundos.",
      defaultRate: 95
    }).returning();

    const [contentSpecialist] = await db.insert(roles).values({
      name: "Especialista en Contenido",
      description: "Crea visualizaciones atractivas y narrativa para la presentación de informes.",
      defaultRate: 75
    }).returning();

    const [projectManager] = await db.insert(roles).values({
      name: "Gerente de Proyecto",
      description: "Supervisa la entrega del proyecto y la comunicación con el cliente.",
      defaultRate: 80
    }).returning();

    // Insertar personal
    await db.insert(personnel).values([
      // Nuevos miembros (Abril 2025)
      { name: "Tomi C", roleId: seniorAnalyst.id, hourlyRate: 22.9 },
      { name: "Vicky P", roleId: seniorAnalyst.id, hourlyRate: 20.3 },
      { name: "Victoria Achabal", roleId: seniorAnalyst.id, hourlyRate: 17.1 },
      { name: "Gastón Guntren", roleId: dataScientist.id, hourlyRate: 14.8 },
      { name: "Xavier", roleId: dataScientist.id, hourlyRate: 15.6 },
      { name: "Dolores Camara", roleId: dataScientist.id, hourlyRate: 13.8 },
      { name: "Rosario Merello", roleId: contentSpecialist.id, hourlyRate: 12.1 },
      { name: "Denise Siefeld", roleId: contentSpecialist.id, hourlyRate: 9.4 },
      { name: "Vanina Lanza", roleId: contentSpecialist.id, hourlyRate: 8.2 },
      { name: "Romi Figueroa", roleId: projectManager.id, hourlyRate: 9.1 },
      { name: "Malena Quiroga", roleId: projectManager.id, hourlyRate: 10.8 },
      { name: "Trinidad", roleId: contentSpecialist.id, hourlyRate: 7.5 },
      { name: "Ina", roleId: contentSpecialist.id, hourlyRate: 7.7 },
      { name: "Tomas Facio", roleId: projectManager.id, hourlyRate: 8.3 },
      { name: "Aylen Magali", roleId: contentSpecialist.id, hourlyRate: 7.4 },
      { name: "Cata Astiz", roleId: contentSpecialist.id, hourlyRate: 7.0 },
      { name: "Sandra", roleId: dataScientist.id, hourlyRate: 16.4 },
      { name: "Maricel", roleId: contentSpecialist.id, hourlyRate: 8.2 },
      { name: "Matías", roleId: contentSpecialist.id, hourlyRate: 8.2 }
    ]);

    // Insertar clientes
    await db.insert(clients).values([
      {
        name: "Corporación Acme",
        contactName: "Juana Pérez",
        contactEmail: "juana@acmecorp.com",
        contactPhone: "+54-11-4123-4567"
      },
      {
        name: "TechStart Argentina",
        contactName: "Juan González",
        contactEmail: "juan@techstart.com.ar",
        contactPhone: "+54-11-4987-6543"
      },
      {
        name: "Grupo Mediático Global",
        contactName: "Elena Martínez",
        contactEmail: "elena@globalmedia.com.ar",
        contactPhone: "+54-11-4456-7890"
      }
    ]);

    // Insertar plantillas de informes
    const [dashboardEjecutivo] = await db.insert(reportTemplates).values({
      name: "Dashboard Ejecutivo",
      description: "Métricas concisas de alto nivel con insights clave y recomendaciones estratégicas. Ideal para stakeholders ejecutivos.",
      complexity: "low",
      pageRange: "5-10 páginas",
      features: "Solo métricas básicas"
    }).returning();
    
    const [analisisIntegral] = await db.insert(reportTemplates).values({
      name: "Análisis Integral",
      description: "Evaluación detallada con métricas extensas, segmentación de audiencia y desglose demográfico.",
      complexity: "medium",
      pageRange: "15-25 páginas",
      features: "Métricas avanzadas"
    }).returning();
    
    const [rendimientoCampana] = await db.insert(reportTemplates).values({
      name: "Rendimiento de Campaña",
      description: "Análisis pre, durante y post campaña con seguimiento de KPIs y datos comparativos de referencia.",
      complexity: "high",
      pageRange: "20-30 páginas",
      features: "Análisis de tendencias"
    }).returning();
    
    const [plantillaPersonalizada] = await db.insert(reportTemplates).values({
      name: "Plantilla Personalizada",
      description: "Construye una estructura de informe personalizada basada en requisitos específicos del cliente y objetivos del proyecto.",
      complexity: "variable",
      pageRange: "Longitud variable",
      features: "Métricas personalizadas"
    }).returning();
    
    const [informeCrisis] = await db.insert(reportTemplates).values({
      name: "Informe de Crisis",
      description: "Monitoreo intensivo y análisis de situaciones críticas que requieren respuesta inmediata.",
      complexity: "high",
      pageRange: "10-20 páginas",
      features: "Alertas y recomendaciones"
    }).returning();
    
    const [informeMensual] = await db.insert(reportTemplates).values({
      name: "Informe Mensual",
      description: "Resumen periódico de KPIs principales, tendencias del mes y recomendaciones tácticas.",
      complexity: "medium",
      pageRange: "15-25 páginas",
      features: "Comparativa mensual"
    }).returning();
    
    // Insertar asignaciones de roles por plantilla
    
    // Dashboard Ejecutivo - Informe básico y conciso
    await db.insert(templateRoleAssignments).values([
      {
        templateId: dashboardEjecutivo.id,
        roleId: seniorAnalyst.id,
        hours: "6"
      },
      {
        templateId: dashboardEjecutivo.id,
        roleId: contentSpecialist.id,
        hours: "4"
      },
      {
        templateId: dashboardEjecutivo.id,
        roleId: projectManager.id,
        hours: "2"
      }
    ]);
    
    // Análisis Integral - Informe detallado con análisis profundo
    await db.insert(templateRoleAssignments).values([
      {
        templateId: analisisIntegral.id,
        roleId: seniorAnalyst.id,
        hours: "12"
      },
      {
        templateId: analisisIntegral.id,
        roleId: dataScientist.id,
        hours: "8"
      },
      {
        templateId: analisisIntegral.id,
        roleId: contentSpecialist.id,
        hours: "10"
      },
      {
        templateId: analisisIntegral.id,
        roleId: projectManager.id,
        hours: "6"
      }
    ]);
    
    // Rendimiento de Campaña - Análisis extenso antes, durante y después de campaña
    await db.insert(templateRoleAssignments).values([
      {
        templateId: rendimientoCampana.id,
        roleId: seniorAnalyst.id,
        hours: "15"
      },
      {
        templateId: rendimientoCampana.id,
        roleId: dataScientist.id,
        hours: "10"
      },
      {
        templateId: rendimientoCampana.id,
        roleId: contentSpecialist.id,
        hours: "12"
      },
      {
        templateId: rendimientoCampana.id,
        roleId: projectManager.id,
        hours: "8"
      }
    ]);
    
    // Informe de Crisis - Monitoreo intensivo y alerta temprana
    await db.insert(templateRoleAssignments).values([
      {
        templateId: informeCrisis.id,
        roleId: seniorAnalyst.id,
        hours: "20"
      },
      {
        templateId: informeCrisis.id,
        roleId: dataScientist.id,
        hours: "10"
      },
      {
        templateId: informeCrisis.id,
        roleId: contentSpecialist.id,
        hours: "8"
      },
      {
        templateId: informeCrisis.id,
        roleId: projectManager.id,
        hours: "12"
      }
    ]);
    
    // Informe Mensual - Actualización periódica con tendencias
    await db.insert(templateRoleAssignments).values([
      {
        templateId: informeMensual.id,
        roleId: seniorAnalyst.id,
        hours: "8"
      },
      {
        templateId: informeMensual.id,
        roleId: contentSpecialist.id,
        hours: "6"
      },
      {
        templateId: informeMensual.id,
        roleId: projectManager.id,
        hours: "4"
      }
    ]);

  } catch (error) {
    console.error("Error al reinicializar la base de datos:", error);
  }
}