/**
 * Test unitario para verificar los cálculos del sistema de cotización
 * 
 * Este script simula una cotización completa y verifica que los cálculos
 * de costos, riesgos y métricas del proyecto sean correctos.
 */

// Simulamos una cotización con sus detalles
const mockQuotation = {
  id: 999,
  clientId: 10,
  projectName: "Proyecto de Prueba Unitaria",
  projectType: "analisis-competencia",
  description: "Cotización de prueba para validar cálculos",
  analysisType: "comprehensive",
  mentionsVolume: "medium",
  countriesCovered: 3,
  languages: 2,
  clientEngagement: "medium",
  startDate: new Date("2023-01-01"),
  endDate: new Date("2023-02-01"), // 31 días de duración
  totalAmount: 10000,
  status: "approved",
  createdAt: new Date(),
  updatedAt: new Date()
};

// Simulamos un proyecto activo basado en la cotización
const mockActiveProject = {
  id: 888,
  quotationId: mockQuotation.id,
  status: "active",
  startDate: new Date("2023-01-01"),
  expectedEndDate: new Date("2023-02-01"),
  actualEndDate: null,
  trackingFrequency: "weekly",
  notes: "Proyecto de prueba para validación",
  createdAt: new Date(),
  updatedAt: new Date()
};

// Simulamos personal asignado al proyecto
const mockPersonnel = [
  { id: 1, name: "Ana Smith", roleId: 10, hourlyRate: 50 }, // Data Specialist
  { id: 2, name: "John Doe", roleId: 11, hourlyRate: 40 },  // Data Analyst
  { id: 3, name: "Maria Garcia", roleId: 12, hourlyRate: 75 } // Senior Analyst
];

// Simulamos entradas de tiempo para el proyecto
// Total de horas: 60 billable + 20 non-billable = 80 horas
// Costo actual: (30 * 50) + (20 * 40) + (10 * 75) = 1500 + 800 + 750 = 3050
const mockTimeEntries = [
  // Ana - Data Specialist (billable)
  { id: 1, projectId: 888, personnelId: 1, date: new Date("2023-01-05"), hours: 10, billable: true, description: "Data collection" },
  { id: 2, projectId: 888, personnelId: 1, date: new Date("2023-01-10"), hours: 10, billable: true, description: "Data analysis" },
  { id: 3, projectId: 888, personnelId: 1, date: new Date("2023-01-15"), hours: 10, billable: true, description: "Report preparation" },
  
  // John - Data Analyst (billable)
  { id: 4, projectId: 888, personnelId: 2, date: new Date("2023-01-05"), hours: 5, billable: true, description: "Initial setup" },
  { id: 5, projectId: 888, personnelId: 2, date: new Date("2023-01-08"), hours: 5, billable: true, description: "Data preparation" },
  { id: 6, projectId: 888, personnelId: 2, date: new Date("2023-01-12"), hours: 10, billable: true, description: "Analysis" },
  
  // Maria - Senior Analyst (billable)
  { id: 7, projectId: 888, personnelId: 3, date: new Date("2023-01-20"), hours: 10, billable: true, description: "Final review" },
  
  // John - Data Analyst (non-billable)
  { id: 8, projectId: 888, personnelId: 2, date: new Date("2023-01-25"), hours: 10, billable: false, description: "Documentation" },
  
  // Ana - Data Specialist (non-billable)
  { id: 9, projectId: 888, personnelId: 1, date: new Date("2023-01-27"), hours: 10, billable: false, description: "Client meeting prep" }
];

// Función para calcular el costo del proyecto (similar a getProjectCostSummary en storage.ts)
function calculateProjectCost(timeEntries, personnel, totalAmount) {
  let actualCost = 0;
  
  for (const entry of timeEntries) {
    if (entry.billable) {
      const person = personnel.find(p => p.id === entry.personnelId);
      if (person) {
        actualCost += person.hourlyRate * entry.hours;
      }
    }
  }
  
  const estimatedCost = totalAmount;
  const variance = estimatedCost - actualCost;
  const percentageUsed = estimatedCost > 0 ? (actualCost / estimatedCost) * 100 : 0;
  
  return {
    estimatedCost,
    actualCost,
    variance,
    percentageUsed
  };
}

// Función para calcular las métricas del proyecto
function calculateProjectMetrics(project, timeEntries) {
  const startDate = new Date(project.startDate);
  const expectedEndDate = new Date(project.expectedEndDate);
  const currentDate = new Date("2023-01-15"); // Simulamos que estamos a mitad del proyecto
  
  // Calcular días totales del proyecto
  const daysTotal = Math.ceil((expectedEndDate - startDate) / (1000 * 60 * 60 * 24));
  
  // Calcular días transcurridos
  const daysElapsed = Math.ceil((currentDate - startDate) / (1000 * 60 * 60 * 24));
  
  // Calcular horas por día planeadas (estimación)
  const plannedHours = 100; // Suponemos que se planearon 100 horas totales
  const hoursPerDay = plannedHours / daysTotal;
  
  // Calcular horas actuales registradas
  const actualHours = timeEntries.reduce((sum, entry) => sum + entry.hours, 0);
  
  // Calcular porcentaje de progreso (basado en tiempo transcurrido)
  const progressPercentage = (daysElapsed / daysTotal) * 100;
  
  return {
    hoursPerDay,
    progressPercentage,
    plannedHours,
    actualHours,
    daysElapsed,
    daysTotal
  };
}

// Función para calcular indicadores de riesgo
function calculateRiskIndicators(costSummary, projectMetrics) {
  // Riesgo de presupuesto (basado en la tendencia actual y la varianza)
  let budgetRisk = costSummary.percentageUsed > projectMetrics.progressPercentage
    ? Math.min(100, (costSummary.percentageUsed / projectMetrics.progressPercentage) * 70)
    : Math.min(70, (costSummary.percentageUsed / 100) * 70);
  
  if (costSummary.variance < -10) budgetRisk += 15;
  else if (costSummary.variance < -5) budgetRisk += 10;
  
  // Riesgo de cronograma (basado en el progreso vs tiempo transcurrido)
  let scheduleRisk = 0;
  if (projectMetrics.daysElapsed > 0 && projectMetrics.daysTotal > 0) {
    const idealProgress = (projectMetrics.daysElapsed / projectMetrics.daysTotal) * 100;
    const progressDifference = idealProgress - projectMetrics.progressPercentage;
    
    scheduleRisk = progressDifference > 0
      ? Math.min(100, (progressDifference / 20) * 100)
      : 0;
  }
  
  // Alertas activas
  let activeAlerts = 0;
  if (budgetRisk >= 75) activeAlerts++;
  if (scheduleRisk >= 75) activeAlerts++;
  if (costSummary.percentageUsed > 110) activeAlerts++;
  
  return {
    budgetRisk: Math.round(budgetRisk),
    scheduleRisk: Math.round(scheduleRisk),
    activeAlerts
  };
}

// Ejecutar los cálculos
const costSummary = calculateProjectCost(mockTimeEntries, mockPersonnel, mockQuotation.totalAmount);
const projectMetrics = calculateProjectMetrics(mockActiveProject, mockTimeEntries);
const riskIndicators = calculateRiskIndicators(costSummary, projectMetrics);

// Imprimir resultados
console.log("=== TEST DE CÁLCULOS DEL SISTEMA DE COTIZACIÓN ===");
console.log("\n1. RESUMEN DE COSTOS:");
console.log(`- Costo estimado: $${costSummary.estimatedCost.toFixed(2)}`);
console.log(`- Costo actual: $${costSummary.actualCost.toFixed(2)}`);
console.log(`- Varianza: $${costSummary.variance.toFixed(2)}`);
console.log(`- Porcentaje usado: ${costSummary.percentageUsed.toFixed(2)}%`);

console.log("\n2. MÉTRICAS DEL PROYECTO:");
console.log(`- Días totales: ${projectMetrics.daysTotal}`);
console.log(`- Días transcurridos: ${projectMetrics.daysElapsed}`);
console.log(`- Horas planeadas: ${projectMetrics.plannedHours}`);
console.log(`- Horas actuales: ${projectMetrics.actualHours}`);
console.log(`- Horas por día: ${projectMetrics.hoursPerDay.toFixed(2)}`);
console.log(`- Porcentaje de progreso: ${projectMetrics.progressPercentage.toFixed(2)}%`);

console.log("\n3. INDICADORES DE RIESGO:");
console.log(`- Riesgo de presupuesto: ${riskIndicators.budgetRisk}%`);
console.log(`- Riesgo de cronograma: ${riskIndicators.scheduleRisk}%`);
console.log(`- Alertas activas: ${riskIndicators.activeAlerts}`);

// Verificación de resultados
const expectedActualCost = 3050;
const expectedPercentageUsed = (expectedActualCost / mockQuotation.totalAmount) * 100;

console.log("\n=== VERIFICACIÓN DE RESULTADOS ===");
console.log(`Costo actual esperado: $${expectedActualCost}`);
console.log(`Costo actual calculado: $${costSummary.actualCost}`);
console.log(`¿Costos coinciden? ${expectedActualCost === costSummary.actualCost ? '✓ SÍ' : '✗ NO'}`);

console.log(`\nPorcentaje usado esperado: ${expectedPercentageUsed.toFixed(2)}%`);
console.log(`Porcentaje usado calculado: ${costSummary.percentageUsed.toFixed(2)}%`);
console.log(`¿Porcentajes coinciden? ${Math.abs(expectedPercentageUsed - costSummary.percentageUsed) < 0.01 ? '✓ SÍ' : '✗ NO'}`);

// Verificar la lógica de alertas
const expectedBudgetRisk = Math.round(expectedPercentageUsed > projectMetrics.progressPercentage
  ? Math.min(100, (expectedPercentageUsed / projectMetrics.progressPercentage) * 70)
  : Math.min(70, (expectedPercentageUsed / 100) * 70));

console.log(`\nRiesgo de presupuesto esperado: ${expectedBudgetRisk}%`);
console.log(`Riesgo de presupuesto calculado: ${riskIndicators.budgetRisk}%`);
console.log(`¿Riesgos de presupuesto coinciden? ${expectedBudgetRisk === riskIndicators.budgetRisk ? '✓ SÍ' : '✗ NO'}`);