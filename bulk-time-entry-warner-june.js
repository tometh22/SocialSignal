// Script para cargar masivamente las horas de Warner en junio 2025
import fetch from 'node-fetch';

const projectId = 26; // Contrato 2025
const sessionCookie = 'sessionId=s%3AnUDsFESwJN1iNwrSqaO61dpITv7andIS.hHkJZtsvVMg3ztAN0GjtWYjdT6oWAFRYfSki4452dow';

// Mapeo de nombres desde la imagen con las horas correspondientes para JUNIO 2025
const warnerHoursJune = [
  { name: "Vicky Puricelli", hours: 6.0 },
  { name: "Victoria Achabal", hours: 6.0 },
  { name: "Dolores Camara", hours: 117.7 },
  { name: "Xavier Aranza", hours: 35.0 },
  { name: "Vanina Lanza", hours: 0.0 }, // 0 horas, no crear registro
  { name: "Tomas Facio", hours: 53.0 },
  { name: "Aylen Magali", hours: 105.4 },
  { name: "Cata Astiz", hours: 33.0 },
  { name: "Trinidad Petreigne", hours: 0.0 }, // Sin horas en la imagen, no crear registro
  { name: "Romi Figueroa", hours: 156.1 },
  { name: "Malena Quiroga", hours: 30.0 }, // "MALE QUIROGA" -> "Malena Quiroga"
  { name: "Gastón Guntren", hours: 59.7 },
  { name: "Ina Ceravolo", hours: 159.5 },
  { name: "Maricel Perez", hours: 84.5 },
  { name: "Matías", hours: 8.20 },
  { name: "Santiago Berisso", hours: 155.3 },
  { name: "Rosario Merello", hours: 0.0 } // 0 horas, no crear registro
];

// Mapeo de personal del sistema (obtenido de la API)
const personnel = [
  { id: 29, name: "Vicky Puricelli", hourlyRate: 20.8 },
  { id: 30, name: "Victoria Achabal", hourlyRate: 20.1 },
  { id: 33, name: "Dolores Camara", hourlyRate: 14 },
  { id: 32, name: "Xavier Aranza", hourlyRate: 15.8 },
  { id: 36, name: "Vanina Lanza", hourlyRate: 10.6 },
  { id: 41, name: "Tomas Facio", hourlyRate: 9.2 },
  { id: 42, name: "Aylen Magali", hourlyRate: 8.3 },
  { id: 43, name: "Cata Astiz", hourlyRate: 7.1 },
  { id: 39, name: "Trinidad Petreigne", hourlyRate: 8.2 },
  { id: 37, name: "Romi Figueroa", hourlyRate: 10.1 },
  { id: 38, name: "Malena Quiroga", hourlyRate: 10.9 },
  { id: 31, name: "Gastón Guntren", hourlyRate: 16.3 },
  { id: 40, name: "Ina Ceravolo", hourlyRate: 8.3 },
  { id: 45, name: "Maricel Perez", hourlyRate: 9.2 },
  { id: 46, name: "Matías", hourlyRate: 9.2 },
  { id: 47, name: "Santiago Berisso", hourlyRate: 9.9 },
  { id: 34, name: "Rosario Merello", hourlyRate: 14 }
];

async function createTimeEntry(personnelId, hours, hourlyRate, personnelName) {
  const timeEntry = {
    projectId: projectId,
    personnelId: personnelId,
    hours: hours,
    description: `Trabajo en proyecto Warner - Junio 2025`,
    date: "2025-06-15T00:00:00.000Z", // Fecha en junio 2025
    entryType: "hours",
    hourlyRateAtTime: hourlyRate,
    totalCost: hours * hourlyRate
  };

  try {
    const response = await fetch('http://localhost:5000/api/time-entries', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': sessionCookie
      },
      body: JSON.stringify(timeEntry)
    });

    if (response.ok) {
      const result = await response.json();
      console.log(`✅ Registrado: ${personnelName} - ${hours}h ($${(hours * hourlyRate).toFixed(2)})`);
      return result;
    } else {
      const error = await response.text();
      console.log(`❌ Error para ${personnelName}: ${error}`);
      return null;
    }
  } catch (error) {
    console.log(`❌ Error de conexión para ${personnelName}: ${error.message}`);
    return null;
  }
}

async function bulkCreateTimeEntries() {
  console.log('🚀 Iniciando carga masiva de horas para proyecto Warner - JUNIO 2025...\n');
  
  let totalHours = 0;
  let totalCost = 0;
  let successCount = 0;
  let skippedCount = 0;
  
  for (const warnerEntry of warnerHoursJune) {
    // Saltar entradas con 0 horas
    if (warnerEntry.hours === 0) {
      console.log(`⏭️  Saltando: ${warnerEntry.name} - 0 horas`);
      skippedCount++;
      continue;
    }
    
    // Buscar la persona en el sistema
    const person = personnel.find(p => p.name === warnerEntry.name);
    
    if (person) {
      const result = await createTimeEntry(
        person.id, 
        warnerEntry.hours, 
        person.hourlyRate, 
        person.name
      );
      
      if (result) {
        totalHours += warnerEntry.hours;
        totalCost += (warnerEntry.hours * person.hourlyRate);
        successCount++;
      }
      
      // Pausa pequeña entre requests
      await new Promise(resolve => setTimeout(resolve, 150));
    } else {
      console.log(`⚠️  No se encontró en el sistema: ${warnerEntry.name}`);
    }
  }
  
  console.log('\n📊 Resumen de la carga JUNIO 2025:');
  console.log(`✅ Registros creados: ${successCount}`);
  console.log(`⏭️  Registros saltados (0 horas): ${skippedCount}`);
  console.log(`⏰ Total de horas: ${totalHours.toFixed(2)}h`);
  console.log(`💰 Costo total: $${totalCost.toFixed(2)}`);
}

// Ejecutar la carga masiva
bulkCreateTimeEntries().catch(console.error);