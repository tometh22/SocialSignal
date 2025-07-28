const { spawn } = require('child_process');

// Run db:push with automatic input for both prompts
const child = spawn('npm', ['run', 'db:push'], {
  stdio: ['pipe', 'pipe', 'pipe']
});

// Send input for both prompts
setTimeout(() => {
  child.stdin.write('1\n'); // First prompt
  setTimeout(() => {
    child.stdin.write('1\n'); // Second prompt if any
    setTimeout(() => {
      child.stdin.end();
    }, 500);
  }, 500);
}, 1000);

// Capture output
child.stdout.on('data', (data) => {
  console.log(`stdout: ${data}`);
});

child.stderr.on('data', (data) => {
  console.error(`stderr: ${data}`);
});

child.on('close', (code) => {
  console.log(`Process exited with code ${code}`);
});