# id-copy-maker

> 一句话定位：身份证复印件生成器——浏览器内裁剪身份证正反面、加水印、拼到 A4 一页，导出 PDF/PNG。纯本地离线、零网络请求、隐私优先。

## 目录说明
- `index.html`：产品本体，单文件、原生 JS、零依赖，双击即可用
- `docs/requirements.md`：需求文档
- `docs/design/`：设计文档
- `docs/tests/`：功能用例集与执行记录
- `docs/deprecated/`：已废弃产物记录（Playwright 端到端测试）
- `AGENTS.md`：本项目的 AI 守则

## 如何本地运行
- 电脑：双击 `index.html` 即可使用，无需构建。
- 手机：将 `index.html` 部署为网站（EdgeOne Pages，见 AGENTS.md 部署规范）。

## 当前状态
- v1 产品已完成（第 1 号存档）。
- 功能用例集与端到端测试已建成（第 2、3 号存档）。
- Playwright 端到端测试已废弃，替代方案 Midscene 视觉驱动测试试点中（见 docs/deprecated/playwright-tests.md）。
