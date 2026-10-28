# 2026-10-27 · test-skills
> 六段 append-only，一段一作者：§1 讨论（主 agent）· §2 批次任务与设计（主 agent）· §3 设计评审（评审子代理）· §4 用户批准（主 agent）· §5 实施记录（实施者：主 agent ∥ coder）· §6 验证与收口（父代理）。
> 编制：主 agent · 2026-10-27 · 来源 = 用户 2026-10-26/27 会话 grilling 问答 Q1–Q22 定案；原话「测试技能分4种：用例设计能力，脚本生成能力，用例执行+记录能力，失败用例排查能力。skills先放本项目」；「开始」。
> 台账 = #5（id-copy-maker · 归批）。前情 = docs/batches/2026-10-26-e2e-playwright.md（已收口）。
## §1 讨论（主 agent）
**状态行**：已收口 2026-10-28
<§1 模板占位：本批条目 / 关键判据 / 授权口径>

- 本批条目：① 四个测试技能（用例设计 / 脚本生成 / 执行与记录 / 失败排查），放本项目 `.thincoder/skills/`，只写通用方法；② 证据配置：每次保留截图、trace 与 HTML 报告，证据目录不进 Git、只留最近 10 次，自动执行记录写进 `docs/tests/run-log.md`；③ 把用例集与设计文档 §14.3 里的方法性句子搬进技能，原处只留本项目事实。
- 授权口径：grilling 问答 Q1–Q22 定案（用户原话见本档来源行）；搬迁清单经用户「确认」后实施。
- 台账 #5 已登记并推进到在途。

> 不适用：§3 —— 本批未做独立设计评审；方案经 grilling 问答与用户逐条确认后落地，落地后做了两轮代码评审（第 1 轮 pass 6🟡2🔵，第 2 轮 pass 1🟡8🔵），评审意见与处置记在 §5。
- 用户追问 S9 执行记录里看不到「弹出提示 / 点取消」：已核实 trace 底层有 Dismiss/Accept dialog 记录，HTML 报告步骤列表里没有，原因是脚本未用 test.step、未把提示原文挂成附件。经 Playwright 能力对照与 AI 视觉工具比较，用户决定另开批次试点 Midscene.js，本批不改。
- 收口全量回归：`npm run test:e2e -- "测试技能批收口全量回归"`，15/15 用例通过（15.4s），证据 test/e2e/runs/20261028-141209/，run-log.md 已追加。

## §2 批次任务与设计（主 agent）
**状态行**：（主 agent 写入时更新）
<§2 模板占位：本批条目（覆盖） / 设计档落点 / 机制设计 / 受影响文件与测试覆盖 / 验收对照 / 关键决策 / 上抛项>

### 设计
- 技能章节骨架：
  - test-case-design：何时使用 · 输入 · 需求点记法 · 从需求推业务场景 · 用例格式 · 素材与执行约定 · 需求覆盖表 · 用例数量保持平稳 · 产出与自查。
  - test-script-gen：何时使用 · 输入 · 原则 · 文件与命名 · Playwright 写法 · 文档与脚本一致 · 产出与自查。
  - test-run：何时使用 · 运行 · 证据 · 执行记录 · 批次记录里写什么 · 失败时 · 产出与自查。
  - test-triage：何时使用 · 步骤（复现、看证据、对照、判定、写依据、报告并停下）· 确认后去哪 · 不做。
- 证据：`playwright.config.mjs` 用 `E2E_RUN_DIR` 决定输出位置；`test/e2e/run.mjs` 按运行时间建目录、跑测试、追加执行记录、删除第 10 次以前的证据目录（只删 `test/e2e/runs/` 下名字为 `YYYYMMDD-HHMMSS` 的目录）。
- 执行记录列：时间 · 命令 · 结果（用例通过数/总数，失败列场景编号）· 证据目录 · 触发原因。

### 验收对照
| 条目 | 判据 |
|---|---|
| 四个技能 | 四个 SKILL.md 存在，章节与上面骨架一致，正文不含本项目的场景、文件名之外的具体事实 |
| 证据 | 一次 `npm run test:e2e` 后，本次目录下有 report/、artifacts/、results.json；报告里能打开每个用例的截图与 trace |
| 保留 10 次 | 第 11 次运行后最早的证据目录被删除 |
| 执行记录 | run-log.md 每次完整运行多一行 |
| 搬迁 | functional-tests.md 与 design §14.3 只留本项目事实和技能指针 |
| 全绿 | 收口前 `npm run test:e2e` 15/15 通过 |

## §3 设计评审（评审子代理）
## §4 用户批准（主 agent）

- 用户 2026-10-27 00:16 原话「开始」：同意开本批。
- 用户 2026-10-27 00:22 原话「确认」：同意搬迁清单与实施清单，其中包括「保留最近 10 次运行的证据……删掉第 10 次之前的旧目录。这是删除动作，只作用于 `test/e2e/runs/` 下面的过程产物」。run.mjs 的自动删除即依此授权。

- 用户 2026-10-28 14:11 原话「先把当前这批收口，再另开一批做 Midscene 试点」：同意本批收口；Midscene.js 视觉测试试点另开批次。
- 用户此前对 S9 两处改断言（固定水印日期、PDF 正反两面）的原话「先改，不要执行」，随后「先跑一个e2e测试看效果」。

## §5 实施记录（实施者：主 agent ∥ coder）

主 agent 直接实施（进行中）。
- 已落地：.thincoder/skills/ 下 test-case-design、test-script-gen、test-run、test-triage 四个 SKILL.md；docs/tests/run-log.md；test/e2e/run.mjs（建证据目录、跑 Playwright、追加执行记录、只留最近 10 次）；package.json 的 test:e2e 改为 node test/e2e/run.mjs；playwright.config.mjs 加 screenshot/trace on、html 与 json 报告、outputDir 指向本次证据目录；.gitignore 加 test/e2e/runs/、.thincoder/*、!.thincoder/skills/；functional-tests.md 开头、执行方「自动」行、:15 素材说明、§5 按搬迁清单改写；design §14.3 第三条去掉写法原则、加技能指针；AGENTS.md 工作规矩加第 4 条。
- 首跑：`npm run test:e2e -- 证据配置首跑`，13/15 通过，失败 S6、S9；证据 test/e2e/runs/20261027-002516/。
- 排查（按 test-triage，未修改任何代码，等待用户确认）：
  - S6：控制台多出 2 条「Connecting to 'blob:null/…' violates … connect-src 'none'」。同一用例关闭 trace（--trace off）单独跑通过。判定：脚本侧缺陷，trace 录制在页面上下文里读取 blob 地址，被产品 CSP 拦下并记为控制台错误；产品行为符合需求 §8-1。
  - S9：line 123 对 PDF 内 JPEG 套用了完整样式断言，墨色三通道差 15.21，阈值 <15。关闭 trace 连跑 3 次读数完全相同（15.2059…），与 trace 无关。上一批 3 次全绿时日期为 10 月 26 日，今日水印文字的日期变为 27 日，笔画像素不同，JPEG 色度误差落到阈值外。判定：脚本侧缺陷，S1 已写明 JPEG 压缩会把三通道拉开十几到二十、只看斜度与行数，S9 对 PDF 用同一阈值与此矛盾；产品水印颜色由 PNG 断言覆盖且通过。

- 代码评审第 1 轮（advisor #58，pass，6🟡 2🔵）：已修 #1 #2 #3 #5 #6 #7 #8——functional-tests.md §5 手工清单补 S8 逐字比对；test-script-gen 写明证据配置项与 trace 带出的 blob/CSP 消息口径；batch §1/§2/§4 补齐；test-triage 写明单独重跑命令、`--trace off` 对照、新增「配置缺陷」一类及其去向；test-run 与 run-log.md 写明执行记录只记完整运行、按用例计数；run.mjs 失败编号去重；test-case-design 去掉清单字段名。#4 随用户确认处理（见下）。
- 用户 2026-10-27 00:42 原话「确认」：按 S6 / S9 改法修。S6 归类改为配置缺陷（trace 引起），S9 为脚本缺陷。
  - S6：`test/e2e/s04-s06-crop-and-files.spec.mjs:132-136` 控制台过滤单独放过 `Connecting to 'blob:` 且含 `connect-src 'none'` 的消息，注释写明原因；其它错误仍判失败。
  - S9：`test/e2e/s07-s09-watermark.spec.mjs:122-128` 对 PDF 内 JPEG 只断言有水印、斜度 15°–60°、至少 2 行；颜色与透明度由 :121 的 PNG 断言覆盖。
- 回归：`npm run test:e2e -- "S6/S9 修复后回归 N"` 连跑 3 次，均 15/15 用例通过（8.1s、8.8s、7.5s）；run-log.md 新增 3 行。单次证据约 41 MB。
- 证据核对：证据目录 20261027-004351 下有 report/、artifacts/、results.json；artifacts 下 15 个 trace.zip、35 张截图。用 `npx playwright show-report` 起本地服务、浏览器打开：报告首页 15/15 Passed，用例页列出逐步 Test Steps 与「View Trace」；trace 页时间轴有逐帧截图，左侧操作列表每步可点，中间显示该步页面快照（Action/Before/After），下方有 Console、Network、Attachments。Q21 的预期成立，无需关键步骤另行截图。临时服务已结束，临时脚本与截图已删除。

- 代码评审第 2 轮（advisor #59，pass，1🟡 8🔵）：
  - #1 保留 10 次：造 7 个假目录 20261001-000001…07（连同 4 个真实目录共 11 个），跑一次 `npm run test:e2e -- "保留 10 次清理验证"`（15/15），跑后 12 个目录剩 10 个，最早的 000001、000002 被删，新目录 20261027-004940 保留。验证后删除剩下的 5 个假目录（空目录）。
  - #2 S6 注释补「§8-1 由 S11 的请求计数兜底」。#5 test-case-design 示例换成中性说法。#6 test-run 列说明补「按用例计数」。#7 functional-tests.md 自动一行写明单独重跑命令与证据位置 `test/e2e/runs/latest/`。#8 run.mjs 零用例时记「无用例（运行失败）」。
  - #3（S9 的 PDF 检查补反面）与 #4（S9 带水印导出前填固定日期）属于改断言，按「改测试前先告诉用户」待用户确认。#9 收口时处理。

- 用户 2026-10-27 11:21 原话「先改，不要执行」：按第 2 轮 #3、#4 改 S9，不运行测试。
  - #4：`test/e2e/s07-s09-watermark.spec.mjs:117-118` 在带水印导出前把水印日期固定为 2026-01-05。
  - #3：`test/e2e/s07-s09-watermark.spec.mjs:123-131` 对 PDF 内 JPEG 的有水印、斜度、行数检查改为正反两面循环。
  - 只做了语法检查（lint 通过），未运行测试；按 AGENTS.md 第 4 条，收口前须跑 `npm run test:e2e` 全部通过。

## §6 验证与收口（父代理）

- 交付：
  - 四个测试技能：`.thincoder/skills/test-case-design`、`test-script-gen`、`test-run`、`test-triage`（各一份 SKILL.md）。
  - 证据配置：`playwright.config.mjs` 开启 screenshot/trace，生成 html 与 json 报告；`test/e2e/run.mjs` 建按时间命名的证据目录、追加执行记录、只留最近 10 次；`package.json` 的 `test:e2e` 指向 run.mjs；`.gitignore` 忽略证据目录、只放行 `.thincoder/skills/`。
  - `docs/tests/run-log.md` 执行记录；`functional-tests.md` 与 design §14.3 只留本项目事实和技能指针；`AGENTS.md` 工作规矩第 4 条。
  - 脚本修复：S6 放过 trace 带出的 blob/CSP 消息（配置缺陷），S9 对 PDF 只查有水印、斜度、行数并覆盖正反两面，带水印导出前固定水印日期。
- 验收对照（§2 表）：四个技能章节与骨架一致；证据目录含 report/、artifacts/、results.json，报告与 trace 实测可逐步回放；保留 10 次实测通过（12 个目录剩 10 个）；run-log 每次完整运行一行；搬迁完成；收口全量回归 15/15。
- 测试行：本批未改产品代码；集成测试 15 个用例全部通过，修复后共跑全量 5 次全部 15/15。未自动化部分（S1 第 10 步、S8 逐字比对、S15 Edge/Safari/旧浏览器、真机 S12/S13-3/S6-4/S11-4）本批未执行。
- 已知限制：HTML 报告的步骤列表不显示原生提示框的出现与「取消/确定」（只在 trace 里有），转入 Midscene.js 试点批次处理。单次证据约 41 MB。
