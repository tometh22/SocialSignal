// Script para actualizar tarifas de roles y crear nuevo rol Tech Lead
import fetch from 'node-fetch';

// URL base para las API
const baseUrl = 'http://localhost:5000';

// Nuevo rol a crear
const newRole = {
  name: "Tech Lead",
  description: "Lidera los aspectos técnicos del proyecto y supervisa la implementación técnica.",
  defaultRate: 8.5
};

// Actualizaciones de tarifas para roles existentes
const roleUpdates = [
  { id: 20, name: "Account Director", defaultRate: 18.8 },
  { id: 12, name: "Project Manager Lead", defaultRate: 10.0 },
  { id: 9, name: "Analista Senior", defaultRate: 10.0 },
  { id: 11, name: "Analista Semi Senior", defaultRate: 8.7 },
  { id: 10, name: "Data Specialist", defaultRate: 9.2 },
  { id: 18, name: "Diseñador", defaultRate: 14.0 }
];

// Función para crear un nuevo rol
async function createRole(role) {
  try {
    const response = await fetch(`${baseUrl}/api/roles`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(role),
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Error al crear rol: ${JSON.stringify(error)}`);
    }
    
    const data = await response.json();
    console.log(`✅ Rol creado: ${data.name} con tarifa $${data.defaultRate}`);
    return data;
  } catch (error) {
    console.error(`❌ Error al crear rol:`, error);
    return null;
  }
}

// Función para actualizar un rol existente
async function updateRole(id, updates) {
  try {
    const response = await fetch(`${baseUrl}/api/roles/${id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(updates),
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Error al actualizar rol: ${JSON.stringify(error)}`);
    }
    
    const data = await response.json();
    console.log(`✅ Rol actualizado: ${data.name} con nueva tarifa $${data.defaultRate}`);
    return data;
  } catch (error) {
    console.error(`❌ Error al actualizar rol ${id}:`, error);
    return null;
  }
}

// Función principal
async function main() {
  console.log('Iniciando actualización de roles y tarifas...');
  
  // Crear nuevo rol Tech Lead
  const techLead = await createRole(newRole);
  
  // Actualizar tarifas de roles existentes
  for (const role of roleUpdates) {
    await updateRole(role.id, { defaultRate: role.defaultRate });
  }
  
  console.log('Proceso completado.');
}

// Ejecutar la función principal
main().catch(error => {
  console.error('Error general:', error);
});