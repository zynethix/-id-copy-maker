// 端到端测试配置：用本机 Chrome（不下载 Playwright 自带浏览器），以 file:// 打开项目根的 index.html。
// 用例来源：docs/tests/functional-tests.md。证据（截图、trace、HTML 报告）每次都保留，
// 写进 E2E_RUN_DIR（由 test/e2e/run.mjs 按运行时间建目录）；直接跑 npx playwright test 时写进 test/e2e/runs/latest。
import { defineConfig } from '@playwright/test';

const runDir = process.env.E2E_RUN_DIR || 'test/e2e/runs/latest';

export default defineConfig({
  testDir: 'test/e2e',
  testMatch: '**/*.spec.mjs',
  timeout: 120_000,
  expect: { timeout: 10_000 },
  fullyParallel: true,
  outputDir: `${runDir}/artifacts`,
  reporter: [
    ['list'],
    ['html', { outputFolder: `${runDir}/report`, open: 'never' }],
    ['json', { outputFile: `${runDir}/results.json` }],
  ],
  use: {
    screenshot: 'on',
    trace: 'on',
    channel: 'chrome',
    headless: true,
    viewport: { width: 1280, height: 800 },
    acceptDownloads: true,
  },
});
