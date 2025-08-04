#!/usr/bin/env node

// Simulate user input and push schema changes
const { spawn } = require('child_process');

const child = spawn('npm', ['run', 'db:push'], {
  stdio: ['pipe', 'pipe', 'pipe']
});

// Auto-answer the first question (create column)
child.stdin.write('+\n');

// Auto-answer any other questions with default choices
child.stdin.write('\n');
child.stdin.write('\n');
child.stdin.write('\n');

child.stdout.on('data', (data) => {
  console.log(data.toString());
});

child.stderr.on('data', (data) => {
  console.error(data.toString());
});

child.on('close', (code) => {
  console.log(`Schema push completed with code ${code}`);
  process.exit(code);
});

// Close stdin after a delay to ensure all questions are answered
setTimeout(() => {
  child.stdin.end();
}, 3000);