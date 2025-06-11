/**
 * Test unitario para verificar los cálculos de alerta del sistema de cotización
 * 
 * Para ejecutar este test: node server/tests/quotation-critical-test.js
 * 
 * Este script simula una cotización en estado crítico para verificar que las
 * alertas y cálculos de riesgo funcionen correctamente.
 */

// Simulamos una cotización con sus detalles
const mockQuotation = {
  id: 999,
  clientId: 10,
  projectName: "Proyecto Crítico de Prueba",
  projectType: "analisis-competencia",
  description: "Cotización con sobrecostos para validar alertas",
  analysisType: "comprehensive",
  mentionsVolume: "high",
  countriesCovered: 5,
  languages: 3,
  clientEngagement: "high",
  startDate: new Date("2023-01-01"),
  endDate: new Date("2023-02-15"), // 45 días de duración
  totalAmount: 8000, // Presupuesto bajo para las horas registradas
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
  expectedEndDate: new Date("2023-02-15"),
  actualEndDate: null,
  trackingFrequency: "weekly",
  notes: "Proyecto de prueba para validación de alertas",
  createdAt: new Date(),
  updatedAt: new Date()
};

// Simulamos personal asignado al proyecto
const mockPersonnel = [
  { id: 1, name: "Ana Smith", roleId: 10, hourlyRate: 60 }, // Data Specialist
  { id: 2, name: "John Doe", roleId: 11, hourlyRate: 45 },  // Data Analyst
  { id: 3, name: "Maria Garcia", roleId: 12, hourlyRate: 80 } // Senior Analyst
];

// Simulamos entradas de tiempo para el proyecto (muchas más horas de lo presupuestado)
// Total de horas: 170 billable + 20 non-billable = 190 horas
// Costo actual: (60 * 60) + (70 * 45) + (40 * 80) = 3600 + 3150 + 3200 = 9950
const mockTimeEntries = [
  // Ana - Data Specialist (billable)
  { id: 1, projectId: 888, personnelId: 1, date: new Date("2023-01-05"), hours: 15, billable: true, description: "Data collection" },
  { id: 2, projectId: 888, personnelId: 1, date: new Date("2023-01-10"), hours: 20, billable: true, description: "Data analysis" },
  { id: 3, projectId: 888, personnelId: 1, date: new Date("2023-01-15"), hours: 25, billable: true, description: "Report preparation" },
  
  // John - Data Analyst (billable)
  { id: 4, projectId: 888, personnelId: 2, date: new Date("2023-01-05"), hours: 15, billable: true, description: "Initial setup" },
  { id: 5, projectId: 888, personnelId: 2, date: new Date("2023-01-08"), hours: 25, billable: true, description: "Data preparation" },
  { id: 6, projectId: 888, personnelId: 2, date: new Date("2023-01-12"), hours: 30, billable: true, description: "Analysis" },
  
  // Maria - Senior Analyst (billable)
  { id: 7, projectId: 888, personnelId: 3, date: new Date("2023-01-08"), hours: 15, billable: true, description: "Strategy planning" },
  { id: 8, projectId: 888, personnelId: 3, date: new Date("2023-01-20"), hours: 25, billable: true, description: "Final review" },
  
  // Non-billable hours
  { id: 9, projectId: 888, personnelId: 2, date: new Date("2023-01-25"), hours: 10, billable: false, description: "Documentation" },
  { id: 10, projectId: 888, personnelId: 1, date: new Date("2023-01-27"), hours: 10, billable: false, description: "Client meeting prep" }
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
  const currentDate = new Date("2023-01-20"); // Simulamos una fecha a 20 días del inicio
  
  // Calcular días totales del proyecto
  const daysTotal = Math.ceil((expectedEndDate - startDate) / (1000 * 60 * 60 * 24));
  
  // Calcular días transcurridos
  const daysElapsed = Math.ceil((currentDate - startDate) / (1000 * 60 * 60 * 24));
  
  // Calcular horas por día planeadas (estimación)
  const plannedHours = 120; // Suponemos que se planearon 120 horas totales
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
  
  // Añadir riesgo adicional por varianza negativa (sobrecostos)
  if (costSummary.variance < -1000) budgetRisk += 15;
  else if (costSummary.variance < -500) budgetRisk += 10;
  
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



// Verificación de resultados esperados en un escenario crítico




// Verificación de la lógica de generación de detalles de alertas
const alertDetails = [];

// Alerta de riesgo de presupuesto
if (riskIndicators.budgetRisk >= 75) {
  alertDetails.push({
    type: 'budget',
    title: 'Riesgo Alto de Sobrecosto',
    severity: 'high',
    value: `${riskIndicators.budgetRisk}% de probabilidad de exceder el presupuesto`
  });
}

// Alerta de sobrecosto
if (costSummary.percentageUsed > 110) {
  alertDetails.push({
    type: 'variance',
    title: 'Desviación Significativa de Costos',
    severity: 'high',
    value: `+${(costSummary.percentageUsed - 100).toFixed(1)}% sobre lo presupuestado`
  });
}

if (alertDetails.length > 0) {
  alertDetails.forEach((alert, index) => {
  });
} else {
}