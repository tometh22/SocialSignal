import { db } from "./db";
import { roles, personnel, clients, reportTemplates } from "@shared/schema";

export async function initializeDatabase() {
  try {
    // Verificar si ya hay datos en la base de datos
    const existingRoles = await db.select().from(roles);
    if (existingRoles.length > 0) {
      return;
    }


    // Insertar roles
    const [seniorAnalyst] = await db.insert(roles).values({
      name: "Senior Analyst",
      description: "Provides expertise in analyzing complex social data and creating strategic insights.",
      defaultRate: 85
    }).returning();

    const [dataScientist] = await db.insert(roles).values({
      name: "Data Scientist",
      description: "Develops custom metrics and advanced data modeling for deeper insights.",
      defaultRate: 95
    }).returning();

    const [contentSpecialist] = await db.insert(roles).values({
      name: "Content Specialist",
      description: "Creates engaging visualizations and narrative for report presentation.",
      defaultRate: 75
    }).returning();

    const [projectManager] = await db.insert(roles).values({
      name: "Project Manager",
      description: "Oversees project delivery and client communication.",
      defaultRate: 80
    }).returning();

    // Insertar personal
    await db.insert(personnel).values([
      // Miembros originales
      { name: "John Davis", roleId: seniorAnalyst.id, hourlyRate: 85 },
      { name: "Sarah Miller", roleId: seniorAnalyst.id, hourlyRate: 90 },
      { name: "Michael Wong", roleId: seniorAnalyst.id, hourlyRate: 85 },
      { name: "Alex Chen", roleId: dataScientist.id, hourlyRate: 95 },
      { name: "Emma Rodriguez", roleId: dataScientist.id, hourlyRate: 100 },
      { name: "Rachel Kim", roleId: contentSpecialist.id, hourlyRate: 75 },
      { name: "Jason Thompson", roleId: contentSpecialist.id, hourlyRate: 80 },
      { name: "David Johnson", roleId: projectManager.id, hourlyRate: 80 },
      
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
        name: "Acme Corporation",
        contactName: "Jane Doe",
        contactEmail: "jane@acmecorp.com",
        contactPhone: "+1-555-123-4567"
      },
      {
        name: "TechStart Inc.",
        contactName: "John Smith",
        contactEmail: "john@techstart.com",
        contactPhone: "+1-555-987-6543"
      },
      {
        name: "Global Media Group",
        contactName: "Emily Wilson",
        contactEmail: "emily@globalmedia.com",
        contactPhone: "+1-555-456-7890"
      }
    ]);

    // Insertar plantillas de informes
    await db.insert(reportTemplates).values([
      {
        name: "Executive Dashboard",
        description: "Concise, high-level metrics with key insights and strategic recommendations. Ideal for executive stakeholders.",
        complexity: "low",
        pageRange: "5-10 pages",
        features: "Core metrics only"
      },
      {
        name: "Comprehensive Analysis",
        description: "Detailed evaluation with extensive metrics, audience segmentation, and demographic breakdown.",
        complexity: "medium",
        pageRange: "15-25 pages",
        features: "Advanced metrics"
      },
      {
        name: "Campaign Performance",
        description: "Pre, during, and post campaign analysis with KPI tracking and comparative benchmark data.",
        complexity: "high",
        pageRange: "20-30 pages",
        features: "Trend analysis"
      },
      {
        name: "Custom Template",
        description: "Build a custom report structure based on specific client requirements and project goals.",
        complexity: "variable",
        pageRange: "Variable length",
        features: "Custom metrics"
      }
    ]);

  } catch (error) {
    console.error("Error al inicializar la base de datos:", error);
  }
}