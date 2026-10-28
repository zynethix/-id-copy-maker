// 端到端测试运行入口：为本次运行建证据目录，跑 Playwright，在 docs/tests/run-log.md 追加一行执行记录，
// 并只保留最近 KEEP 次的证据目录（更早的删除）。证据目录在 test/e2e/runs/ 下，不进版本库。
// 用法：npm run test:e2e [-- 触发原因]
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const KEEP = 10;
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const runsDir = path.join(root, 'test/e2e/runs');
const logFile = path.join(root, 'docs/tests/run-log.md');

const p = (n) => String(n).padStart(2, '0');
const d = new Date();
const stamp = `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
const runDir = path.join(runsDir, stamp);
fs.mkdirSync(runDir, { recursive: true });

const reason = process.argv.slice(2).join(' ').trim() || '未注明';
const jsonOut = path.join(runDir, 'results.json');
const res = spawnSync('npx', ['playwright', 'test'], {
  cwd: root,
  stdio: 'inherit',
  env: { ...process.env, E2E_RUN_DIR: runDir },
});

// 读 Playwright 的 JSON 报告得出通过数与失败场景
let summary = '无结果（运行未产出报告）';
try {
  const r = JSON.parse(fs.readFileSync(jsonOut, 'utf8'));
  const specs = [];
  const walk = (s) => { (s.specs || []).forEach((x) => specs.push(x)); (s.suites || []).forEach(walk); };
  (r.suites || []).forEach(walk);
  const bad = specs.filter((x) => !x.ok);
  const failedIds = [...new Set(bad.map((x) => (x.title.match(/^S\d+/) || [x.title])[0]))];
  const passed = specs.length - bad.length;
  if (specs.length === 0) summary = '无用例（运行失败）';
  else summary = bad.length ? `${passed}/${specs.length} 用例通过；失败场景 ${failedIds.join('、')}` : `${passed}/${specs.length} 用例通过`;
} catch { /* 报告缺失时如实记「无结果」 */ }

const when = `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
const row = `| ${when} | npm run test:e2e | ${summary} | test/e2e/runs/${stamp}/ | ${reason.replace(/\|/g, '/')} |\n`;
fs.appendFileSync(logFile, row);

// 只保留最近 KEEP 次的证据目录
const dirs = fs.readdirSync(runsDir).filter((n) => /^\d{8}-\d{6}$/.test(n)).sort();
for (const old of dirs.slice(0, Math.max(0, dirs.length - KEEP))) {
  fs.rmSync(path.join(runsDir, old), { recursive: true, force: true });
}

console.log(`\n证据：test/e2e/runs/${stamp}/（报告：npx playwright show-report test/e2e/runs/${stamp}/report）`);
console.log(`执行记录已追加：docs/tests/run-log.md — ${summary}`);
process.exit(res.status ?? 1);
