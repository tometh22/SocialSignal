const { exec } = require('child_process');
const process = require('process');

console.log('Pushing schema to database...');

// Ejecutar el comando para forzar la migración sin interacción
const command = 'npx drizzle-kit push --accept-data-loss';
exec(command, (error, stdout, stderr) => {
  if (error) {
    console.error(`Error executing command: ${error.message}`);
    process.exit(1);
  }
  
  if (stderr) {
    console.error(`Command stderr: ${stderr}`);
  }
  
  console.log(`Command output:\n${stdout}`);
  console.log('Schema push completed successfully!');
});