const { exec } = require('child_process');

// Simular que presionamos '1' y luego ENTER para seleccionar "create column"
const process = exec('npm run db:push', (error, stdout, stderr) => {
  if (error) {
    console.error(`Error: ${error}`);
    return;
  }
  if (stderr) {
    console.error(`stderr: ${stderr}`);
  }
  console.log(`stdout: ${stdout}`);
});

// Cuando el proceso solicite input, enviar '1' seguido de ENTER
process.stdin.write('1\n');

// Dar tiempo para procesar
setTimeout(() => {
  process.stdin.end();
}, 1000);