import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import ws from 'ws';
import { costMultipliers } from '../shared/schema.ts';

neonConfig.webSocketConstructor = ws;

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle({ client: pool });

const multipliers = [
  // Complexity Category
  {
    category: 'complexity',
    subcategory: 'basic',
    multiplier: 0,
    label: 'Análisis Básico',
    description: 'Metodología estándar sin complejidad adicional',
    isActive: true
  },
  {
    category: 'complexity',
    subcategory: 'standard',
    multiplier: 0.1,
    label: 'Análisis Estándar',
    description: 'Metodología estándar que requiere más recursos técnicos (+10%)',
    isActive: true
  },
  {
    category: 'complexity',
    subcategory: 'deep',
    multiplier: 0.15,
    label: 'Análisis Profundo',
    description: 'Metodología avanzada con herramientas especializadas (+15%)',
    isActive: true
  },

  // Mentions Volume Category
  {
    category: 'mentions_volume',
    subcategory: 'small',
    multiplier: 0,
    label: 'Volumen Pequeño',
    description: 'Hasta 10,000 menciones mensuales',
    isActive: true
  },
  {
    category: 'mentions_volume',
    subcategory: 'medium',
    multiplier: 0.1,
    label: 'Volumen Medio',
    description: '10,001 - 50,000 menciones mensuales (+10%)',
    isActive: true
  },
  {
    category: 'mentions_volume',
    subcategory: 'large',
    multiplier: 0.2,
    label: 'Volumen Grande',
    description: '50,001 - 200,000 menciones mensuales (+20%)',
    isActive: true
  },
  {
    category: 'mentions_volume',
    subcategory: 'xlarge',
    multiplier: 0.3,
    label: 'Volumen Extra Grande',
    description: 'Más de 200,000 menciones mensuales (+30%)',
    isActive: true
  },

  // Countries Category
  {
    category: 'countries',
    subcategory: '1',
    multiplier: 0,
    label: '1 País',
    description: 'Monitoreo en un solo país',
    isActive: true
  },
  {
    category: 'countries',
    subcategory: '2-5',
    multiplier: 0.05,
    label: '2-5 Países',
    description: 'Monitoreo en múltiples países (+5%)',
    isActive: true
  },
  {
    category: 'countries',
    subcategory: '6-10',
    multiplier: 0.15,
    label: '6-10 Países',
    description: 'Monitoreo regional amplio (+15%)',
    isActive: true
  },
  {
    category: 'countries',
    subcategory: '10+',
    multiplier: 0.25,
    label: 'Más de 10 Países',
    description: 'Monitoreo global (+25%)',
    isActive: true
  },

  // Urgency Category (Client Engagement)
  {
    category: 'urgency',
    subcategory: 'low',
    multiplier: 0,
    label: 'Interacción Baja',
    description: 'Reportes automáticos, mínima interacción',
    isActive: true
  },
  {
    category: 'urgency',
    subcategory: 'medium',
    multiplier: 0.05,
    label: 'Interacción Media',
    description: 'Reuniones regulares y reportes personalizados (+5%)',
    isActive: true
  },
  {
    category: 'urgency',
    subcategory: 'high',
    multiplier: 0.15,
    label: 'Interacción Alta',
    description: 'Gestión intensiva y comunicación constante (+15%)',
    isActive: true
  },

  // Project Type Category (Template Complexity)
  {
    category: 'project_type',
    subcategory: 'low',
    multiplier: 0,
    label: 'Complejidad Baja',
    description: 'Plantilla estándar sin customización',
    isActive: true
  },
  {
    category: 'project_type',
    subcategory: 'medium',
    multiplier: 0.1,
    label: 'Complejidad Media',
    description: 'Plantilla con algunas customizaciones (+10%)',
    isActive: true
  },
  {
    category: 'project_type',
    subcategory: 'high',
    multiplier: 0.2,
    label: 'Complejidad Alta',
    description: 'Plantilla altamente personalizada (+20%)',
    isActive: true
  },
  {
    category: 'project_type',
    subcategory: 'variable',
    multiplier: 0.15,
    label: 'Complejidad Variable',
    description: 'Plantilla con elementos variables (+15%)',
    isActive: true
  }
];

async function initCostMultipliers() {
  try {
    console.log('Inicializando multiplicadores de costos...');
    
    // Verificar si ya existen multiplicadores
    const existing = await db.select().from(costMultipliers).limit(1);
    
    if (existing.length > 0) {
      console.log('Los multiplicadores ya están inicializados.');
      return;
    }
    
    // Insertar multiplicadores
    for (const multiplier of multipliers) {
      await db.insert(costMultipliers).values(multiplier);
      console.log(`✓ Agregado: ${multiplier.category}/${multiplier.subcategory} - ${multiplier.label}`);
    }
    
    console.log(`\n✅ Inicialización completa. ${multipliers.length} multiplicadores agregados.`);
    console.log('\nCategorías configuradas:');
    console.log('- Complejidad (3 opciones)');
    console.log('- Volumen de Menciones (4 opciones)');
    console.log('- Países Cubiertos (4 opciones)');
    console.log('- Urgencia/Interacción (3 opciones)');
    console.log('- Tipo de Proyecto (4 opciones)');
    
  } catch (error) {
    console.error('Error al inicializar multiplicadores:', error);
  } finally {
    await pool.end();
  }
}

initCostMultipliers();