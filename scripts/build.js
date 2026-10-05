import fs from 'node:fs';

console.log('Validating build artifact...');

if (!fs.existsSync('index.html')) {
  console.error('index.html is missing!');
  process.exit(1);
}

const html = fs.readFileSync('index.html', 'utf8');

if (!html.includes('<!DOCTYPE html>') || !html.includes('</html>')) {
  console.error('Invalid HTML structure in index.html');
  process.exit(1);
}

console.log(`Build validation passed: index.html is valid (${html.length} bytes).`);
