
import { Pool } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import * as schema from '../shared/schema.js';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle({ client: pool, schema });

interface HistoricalCostData {
  personnelId: number;
  year: number;
  month: number;
  hourlyRateARS?: number;
  monthlySalaryARS?: number;
}

async function migrateHistoricalCosts() {
  console.log('🚀 Starting migration of personnel historical costs...');

  try {
    // Get all personnel with historical cost data
    const personnel = await db.select({
      id: schema.personnel.id,
      name: schema.personnel.name,
      // 2025 ARS hourly rates
      jan2025HourlyRateARS: schema.personnel.jan2025HourlyRateARS,
      feb2025HourlyRateARS: schema.personnel.feb2025HourlyRateARS,
      mar2025HourlyRateARS: schema.personnel.mar2025HourlyRateARS,
      apr2025HourlyRateARS: schema.personnel.apr2025HourlyRateARS,
      may2025HourlyRateARS: schema.personnel.may2025HourlyRateARS,
      jun2025HourlyRateARS: schema.personnel.jun2025HourlyRateARS,
      jul2025HourlyRateARS: schema.personnel.jul2025HourlyRateARS,
      aug2025HourlyRateARS: schema.personnel.aug2025HourlyRateARS,
      sep2025HourlyRateARS: schema.personnel.sep2025HourlyRateARS,
      oct2025HourlyRateARS: schema.personnel.oct2025HourlyRateARS,
      nov2025HourlyRateARS: schema.personnel.nov2025HourlyRateARS,
      dec2025HourlyRateARS: schema.personnel.dec2025HourlyRateARS,
      // 2025 ARS monthly salaries
      jan2025MonthlySalaryARS: schema.personnel.jan2025MonthlySalaryARS,
      feb2025MonthlySalaryARS: schema.personnel.feb2025MonthlySalaryARS,
      mar2025MonthlySalaryARS: schema.personnel.mar2025MonthlySalaryARS,
      apr2025MonthlySalaryARS: schema.personnel.apr2025MonthlySalaryARS,
      may2025MonthlySalaryARS: schema.personnel.may2025MonthlySalaryARS,
      jun2025MonthlySalaryARS: schema.personnel.jun2025MonthlySalaryARS,
      jul2025MonthlySalaryARS: schema.personnel.jul2025MonthlySalaryARS,
      aug2025MonthlySalaryARS: schema.personnel.aug2025MonthlySalaryARS,
      sep2025MonthlySalaryARS: schema.personnel.sep2025MonthlySalaryARS,
      oct2025MonthlySalaryARS: schema.personnel.oct2025MonthlySalaryARS,
      nov2025MonthlySalaryARS: schema.personnel.nov2025MonthlySalaryARS,
      dec2025MonthlySalaryARS: schema.personnel.dec2025MonthlySalaryARS,
    }).from(schema.personnel);

    const monthMap = [
      'jan', 'feb', 'mar', 'apr', 'may', 'jun',
      'jul', 'aug', 'sep', 'oct', 'nov', 'dec'
    ];

    const historicalCosts: HistoricalCostData[] = [];

    // Process each person
    for (const person of personnel) {
      console.log(`📝 Processing ${person.name}...`);

      // Process each month of 2025
      for (let month = 1; month <= 12; month++) {
        const monthKey = monthMap[month - 1];
        const hourlyRateKey = `${monthKey}2025HourlyRateARS` as keyof typeof person;
        const monthlySalaryKey = `${monthKey}2025MonthlySalaryARS` as keyof typeof person;

        const hourlyRate = person[hourlyRateKey] as number | null;
        const monthlySalary = person[monthlySalaryKey] as number | null;

        // Only create record if there's data for this month
        if (hourlyRate !== null || monthlySalary !== null) {
          historicalCosts.push({
            personnelId: person.id,
            year: 2025,
            month: month,
            hourlyRateARS: hourlyRate || undefined,
            monthlySalaryARS: monthlySalary || undefined,
          });
        }
      }
    }

    console.log(`💾 Inserting ${historicalCosts.length} historical cost records...`);

    // Insert in batches to avoid memory issues
    const batchSize = 100;
    for (let i = 0; i < historicalCosts.length; i += batchSize) {
      const batch = historicalCosts.slice(i, i + batchSize);
      
      await db.insert(schema.personnelHistoricalCosts).values(
        batch.map(cost => ({
          personnelId: cost.personnelId,
          year: cost.year,
          month: cost.month,
          hourlyRateARS: cost.hourlyRateARS?.toString(),
          monthlySalaryARS: cost.monthlySalaryARS?.toString(),
          adjustmentReason: 'Migrated from legacy columns',
          createdBy: 1, // System user
        }))
      );

      console.log(`✅ Inserted batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(historicalCosts.length / batchSize)}`);
    }

    console.log('🎉 Migration completed successfully!');
    console.log(`📊 Total records migrated: ${historicalCosts.length}`);

  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

// Run migration if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  migrateHistoricalCosts()
    .then(() => {
      console.log('Migration completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Migration failed:', error);
      process.exit(1);
    });
}

export { migrateHistoricalCosts };
