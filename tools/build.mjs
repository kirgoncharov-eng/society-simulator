// Build: concatenates engine and UI parts and inlines them into one self-contained page.
// Usage: node tools/build.mjs   ->  dist/index.html (the page), dist/sim.js (engine for Node tools)
import { readFileSync, writeFileSync, readdirSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const parts = dir => readdirSync(join(root, dir)).filter(f => f.endsWith('.js')).sort().map(f => readFileSync(join(root, dir, f), 'utf8').replace(/\n$/, '')).join('\n');
const engine = 'const SIM = (() => {\n' + parts('src/engine') + '\n})();\nif (typeof module !== \'undefined\') module.exports = SIM;\n';
const ui = '{\n' + parts('src/ui') + '\n}\n';
const atlas = readFileSync(join(root, 'src/ui/atlas-data.json'), 'utf8').trim();
let html = readFileSync(join(root, 'src/index.template.html'), 'utf8');
if (!html.includes('/*SIM*/') || !html.includes('/*UI*/')) throw new Error('template placeholders missing');
html = html.replace('/*SIM*/', () => engine).replace('/*UI*/', () => ui).replace('/*ATLAS*/[]', () => atlas);
mkdirSync(join(root, 'dist'), { recursive: true });
writeFileSync(join(root, 'dist/index.html'), html);
writeFileSync(join(root, 'dist/sim.cjs'), engine);
console.log(`built dist/index.html (${(html.length / 1024).toFixed(0)} KB) and dist/sim.cjs`);
