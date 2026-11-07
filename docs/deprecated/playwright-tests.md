# Playwright 端到端测试（已废弃）

> 状态：已废弃 · 2026-11-05
> 替代方向：Midscene.js 视觉驱动测试（试点中）

## 废弃原因

手写 Playwright 脚本靠 DOM 选择器定位界面元素，页面结构一改就要连带改所有脚本。用户决定改用结合 AI 视觉能力的 Midscene.js 试点：视觉定位不依赖特定界面渲染结构。试点范围 S7、S9，模型 deepseek-flash，素材用公开假样张（见 docs/batches/2026-10-28-midscene-pilot.md）。

## 废弃范围与处置

| # | 资产 | 处置 |
|---|---|---|
| 1 | test/e2e/*.spec.mjs（5 个）+ helpers.mjs + run.mjs | 已废弃，原地保留作历史 |
| 2 | test/e2e/runs/ | 历史运行证据，原地保留 |
| 3 | playwright.config.mjs | 废弃手写脚本用法；Midscene 视觉版仍以 Playwright Test 为宿主，此配置将按试点设计改造 |
| 4 | docs/tests/functional-tests.md | 业务场景与需求覆盖表仍作追溯来源；废弃的是「执行方 = 手写 Playwright」的对应 |
| 5 | docs/tests/run-log.md | 历史执行记录，原地保留 |
| 6 | docs/batches/2026-10-26-e2e-playwright.md | 历史批记录，原地保留 |
| 7 | .thincoder/skills/ 四个测试技能 | test-script-gen 的 Playwright 写法随本弃用；用例设计/执行/排查技能继续适用 |
| 8 | package.json 的 @playwright/test 依赖 | 保留：Midscene 视觉版仍跑在 Playwright Test 上 |

## 替代现状（2026-11-05）

Midscene 试点批尚未收口：@midscene/web 与 dotenv 已装、.env 已建待用户填 API Key，视觉版脚本（fixture-ai.mjs、s07-s09-watermark-ai.spec.mjs）与 playwright.config.mjs 改造尚未落地。试点结论（是否以视觉版取代现有版）未定。
