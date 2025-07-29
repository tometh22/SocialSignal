import { db } from './server/db.js';
import { activeProjects, quotations } from './server/schema.js';
import { eq } from 'drizzle-orm';

async function testProjectDates() {
  try {
    console.log('🔍 Checking project dates in database...\n');
    
    const projects = await db.select({
      id: activeProjects.id,
      startDate: activeProjects.startDate,
      expectedEndDate: activeProjects.expectedEndDate,
      projectName: quotations.projectName
    })
    .from(activeProjects)
    .innerJoin(quotations, eq(activeProjects.quotationId, quotations.id))
    .limit(10);
    
    projects.forEach(project => {
      console.log(`Project ${project.id}: ${project.projectName}`);
      console.log(`  startDate: ${project.startDate}`);
      console.log(`  startDate type: ${typeof project.startDate}`);
      console.log(`  expectedEndDate: ${project.expectedEndDate}`);
      console.log(`  expectedEndDate type: ${typeof project.expectedEndDate}`);
      console.log('---');
    });
    
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

testProjectDates();