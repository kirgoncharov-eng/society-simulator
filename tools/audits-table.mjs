// Builds docs/AUDITS.md from the saved audits in docs/audits/*.json: one row per model version and island set.
// Usage: node tools/audits-table.mjs
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
const dir = new URL('../docs/audits/', import.meta.url);
const recs = readdirSync(dir).filter(f => f.endsWith('.json')).map(f => JSON.parse(readFileSync(new URL(f, dir), 'utf8')))
  .sort((a, b) => (+a.model.slice(1) - +b.model.slice(1)) || (a.offset - b.offset) || (a.islands - b.islands));
const COLS = [
  ['Модель', r => r.model], ['Острова', r => `${r.islands}×${r.years}${r.offset ? ` (с ${r.offset})` : ''}`], ['Дата', r => r.date],
  ['Война %', r => r.deaths.war], ['Вода и море %', r => r.deaths.waterSea], ['Голод %', r => r.deaths.hunger], ['Старость и болезни %', r => r.deaths.oldAgeSickness],
  ['Детская смертность', r => r.childMortality], ['Медиана деревни', r => r.medianVillage], ['Домов на семью', r => r.housesPerFamily],
  ['Наследственная власть %', r => r.hereditary], ['Вече или совет %', r => r.assembly], ['Власть над деревней %', r => r.overlord],
  ['Дуга у 40+ %', r => r.arcsOver40], ['Повторы в судьбах %', r => r.dramaRepeats], ['Политическая строка 30+ %', r => r.politicalOver30],
  ['Характер изменился 40+ %', r => r.characterChanged], ['Работа: близко / далеко, ч', r => r.workNear != null ? `${r.workNear} / ${r.workFar}` : '']
];
const v = x => x === null || x === undefined ? '—' : String(x);
const md = `# Аудиты по версиям модели

Собирается командой \`node tools/audits-table.mjs\` из файлов \`docs/audits/*.json\`, которые пишет \`npm run audit -- 24 80 --save\`. Набор «с 24» — второй набор островов (\`--offset=24\`): разница между наборами показывает шум. Коридоры и правила — в AGENTS.md (правило 5) и в MECHANICS («Сверка с реальностью»).

| ${COLS.map(c => c[0]).join(' | ')} |
|${COLS.map(() => '---').join('|')}|
${recs.map(r => `| ${COLS.map(c => v(c[1](r))).join(' | ')} |`).join('\n')}
`;
writeFileSync(new URL('../docs/AUDITS.md', import.meta.url), md);
console.log(`docs/AUDITS.md: ${recs.length} rows`);
