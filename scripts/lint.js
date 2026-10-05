import fs from 'node:fs';
import vm from 'node:vm';

console.log('Running linter...');

const html = fs.readFileSync('index.html', 'utf8');

// 1. Check for scripts syntax
const scriptRegex = /<script(?![^>]*src=)[^>]*>([\s\S]*?)<\/script>/gi;
let match;
let scriptIndex = 0;
let errors = 0;

while ((match = scriptRegex.exec(html)) !== null) {
  scriptIndex++;
  const code = match[1];
  try {
    new vm.Script(code);
  } catch (err) {
    console.error(`Syntax error in <script> block ${scriptIndex}:`, err.message);
    errors++;
  }
}

if (errors > 0) {
  console.error(`Lint failed with ${errors} error(s).`);
  process.exit(1);
}

console.log('Lint passed successfully with 0 errors.');
