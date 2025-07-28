// Script to push schema changes for negotiation history
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

async function pushSchema() {
  try {
    console.log('Pushing schema changes...');
    
    // Run drizzle-kit push with automatic confirmation
    const { stdout, stderr } = await execAsync('yes | npm run db:push');
    
    console.log('Schema push output:', stdout);
    if (stderr) console.error('Schema push errors:', stderr);
    
    console.log('Schema push completed successfully');
  } catch (error) {
    console.error('Error pushing schema:', error);
    process.exit(1);
  }
}

pushSchema();