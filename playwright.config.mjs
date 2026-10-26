// 端到端测试配置：用本机 Chrome（不下载 Playwright 自带浏览器），以 file:// 打开项目根的 index.html。
// 用例来源：docs/tests/functional-tests.md。
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: 'test/e2e',
  testMatch: '**/*.spec.mjs',
  timeout: 120_000,
  expect: { timeout: 10_000 },
  fullyParallel: true,
  reporter: [['list']],
  use: {
    channel: 'chrome',
    headless: true,
    viewport: { width: 1280, height: 800 },
    acceptDownloads: true,
  },
});
