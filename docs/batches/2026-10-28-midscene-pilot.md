# 2026-10-28 · midscene-pilot
> 六段 append-only，一段一作者：§1 讨论（主 agent）· §2 批次任务与设计（主 agent）· §3 设计评审（评审子代理）· §4 用户批准（主 agent）· §5 实施记录（实施者：主 agent ∥ coder）· §6 验证与收口（父代理）。
> 编制：主 agent · 2026-10-28 · 来源 = 用户 2026-10-28 原话「有没有别的网页测试工具可选？结合ai 视觉能力的，我不想页面一改就要改过去所有脚本」；「先把当前这批收口，再另开一批做 Midscene 试点」。
> 台账 = #6（id-copy-maker · 归批）。前情 = docs/batches/2026-10-27-test-skills.md（已收口）。
## §1 讨论（主 agent）
**状态行**：进行中（设计评审已通过，等待用户填 API Key 后开始实施）
- 起因：用户希望页面改版后不必改所有脚本，要求比较结合 AI 视觉的网页测试工具；比较后选 Midscene.js 试点（官网：「视觉定位不依赖特定的界面渲染结构」「也适用于 HTML canvas」，可接入 Playwright Test）。
- 方向：界面层的操作与「看起来对不对」用 Midscene 的 aiAct / aiAssert / aiWaitFor；导出文件的尺寸、像素、元数据仍用代码精确判定；选文件、截获下载仍用 Playwright 事件。
- 用户已定的三件事见 §4：模型 deepseek-flash（页面截图会发给 DeepSeek，素材为公开假样张）、试点范围 S7 与 S9、可以安装依赖。
- 台账 #6 在途；@midscene/web 与 dotenv 已装，.env 与 .env.example 已建，API Key 由用户自己填。

- 用户 2026-11-07 裁定两件事：① Playwright 端到端测试已废弃，已落地废弃记录（docs/deprecated/playwright-tests.md），README 与 AGENTS.md 已同步更新；② 收口时选方案 C——本批暂不收口，保持台账 #6 在途，视觉脚本（fixture-ai.mjs、s07-s09-watermark-ai.spec.mjs）与 model verify 仍待做，等用户填好 API Key 后继续。

## §2 批次任务与设计（主 agent）
**状态行**：设计完成
### 设计
- 目标：用 Midscene.js 试点 S7、S9 的视觉驱动版脚本。界面步骤（点水印开关、填用途、点导出、读徽标与提示）用 aiAct / aiAssert / aiWaitFor；导出文件的尺寸、像素、元数据仍用代码精确判定；选文件、截获下载仍用 Playwright 事件。现有 s07-s09-watermark.spec.mjs 保留，试点期间两版并存，对比后再定取舍。
- 最近先例：test/e2e/s07-s09-watermark.spec.mjs。对齐：沿用 helpers.mjs 的导出、解析、像素读取函数与场景编号命名；偏离：界面步骤改视觉驱动，原因是用户要页面改版后不必改全部脚本。
- 调查证据：已读 Midscene 官方「接入 Playwright Test」「使用模型 API Key」「模型高级配置与调试」三页，PlaywrightAiFixture、reporter、DeepSeek 的 family 取值均取自这三页；DeepSeek 的模型 ID 在 DeepSeek 自家接口上是否可用，待 model verify 实测。
- 模型配置：.env 四个变量（BASE_URL 为 https://api.deepseek.com，NAME 为 deepseek-flash，FAMILY 为 deepseek，API_KEY 由用户填），模板 .env.example 提交，.env、.env.* 与 midscene_run/ 由 .gitignore 忽略。family 取值已在 node_modules/@midscene/shared 的类型清单里核对；NAME 在 DeepSeek 接口上是否可用待 model verify。
- 隐私边界：页面截图发给 DeepSeek，素材只用公开假样张，不用真实证件（用户已确认）。

### 集成测试设计
- 本项目的需求追溯表是 docs/tests/functional-tests.md 的「4. 需求覆盖表」（需求点 → 场景），没有另设独立的需求追溯文件。
- 本批不新增场景，也不改变任何业务可观察结果：S7 对应 §7-4、§7-5，S9 对应 §7-1、§10-5，覆盖表的行不变。视觉版脚本是同一场景的第二种实现，用来对比取舍，不是新业务场景。
- 试点结束若决定以视觉版取代现有版，才改覆盖表里对应场景的执行方说明；试点期间 docs/tests/functional-tests.md 不改，对比读数只记在本批 §5、§6。

### 步骤划分（S7、S9 视觉版）
| 场景 | 视觉驱动（aiAct、aiAssert、aiWaitFor） | 代码判定（Playwright 与现有辅助函数） |
|---|---|---|
| S7 | 点选水印模板、往用途与日期框填字、点导出；读导出按钮是否可点、徽标与提示文字、预览下方的待填写提示 | 选文件上传、导出文件的文件名、下载次数为 0、预览上有无水印及其样式（像素分析） |
| S9 | 取消勾选、重新勾选；读徽标「已关闭」、预览上有无水印 | 确认框由 Playwright 的 dialog 事件接住并按步骤点取消或确定、记下提示原文；两个导出文件里没有水印用纯色素材做像素判定 |
- 原生确认框不画在页面里，截图看不到，必须由代码接住；这是已知限制，视觉版也一样。

### 受影响文件与层级
| 文件 | 动作 | 层级 |
|---|---|---|
| playwright.config.mjs | 加载 dotenv；reporter 增加 @midscene/web/playwright-reporter；单用例超时按模型耗时放宽 | 测试配置 |
| test/e2e/fixture-ai.mjs | 新建，用 PlaywrightAiFixture 扩展 test，只被视觉版脚本引用 | 测试脚本 |
| test/e2e/s07-s09-watermark-ai.spec.mjs | 新建，S7、S9 视觉版 | 测试脚本 |
| test/e2e/helpers.mjs | 复用，不改；确需读 test/mock_data 的样张时再补一个读文件函数 | 测试脚本 |
| package.json、package-lock.json、.gitignore、.env.example | 已改 | 依赖与配置 |
| index.html、现有 15 个用例 | 不改 | — |
没有任何一项跨层级。

### 新名字的三问
| 名字 | 已有 | 结论 |
|---|---|---|
| .env.example、.env | 项目里没有 | 新建 |
| midscene_run/ | 项目里没有；是 Midscene 默认报告目录 | 沿用其默认，由 .gitignore 忽略 |
| fixture-ai.mjs、s07-s09-watermark-ai.spec.mjs | 无同名 | 新建，命名沿用「场景编号开头」 |
| MIDSCENE_MODEL_* 四个变量 | 项目里没有 | 取自 Midscene 官方文档 |
| 素材来源 | helpers.mjs 的 makeMockImage 现场生成；test/mock_data/ 三张公开样张 | 界面步骤用 mock_data 的证件样张，导出文件的像素判定仍用现场生成的纯色素材 |

### 异常与边界
- API Key 为空或模型服务不可达：视觉版脚本在文件开头检查 MIDSCENE_MODEL_API_KEY，缺失则整个文件 skip 并写明原因，默认的 `npm run test:e2e` 因此不依赖网络与密钥；模型服务不可达或断言失败则用例失败，不自动重试，按 test-triage 处理。
- 模型的不确定性：「连跑 3 次全过」指连续 3 次、每次都不靠重试通过，任何一次失败都如实记下失败的步骤与原因。
- 报告位置：Midscene 的报告在 midscene_run/report/，不并入 test/e2e/runs/；对比读数时在本批 §5 记下两处路径。

### 验收对照
| 条目 | 判据 |
|---|---|
| 密钥不入库 | `git check-ignore` 命中 .env；.env.example 的 API_KEY 为空 |
| 模型可用 | 固定到 @midscene/test 的具体版本（当前 npm 为 1.17.5）后执行 model verify，全部 PASS；该包只用 npx 临时取用，不装进项目 |
| 试点脚本 | 按文件运行 `npx playwright test test/e2e/s07-s09-watermark-ai.spec.mjs`，S7、S9 各连续 3 次通过 |
| 缺密钥 | 清空 API Key 后运行该文件，用例被跳过且写明原因 |
| 对比读数 | 记下单次耗时、模型调用次数、失败时 Midscene 报告里能否看到弹窗与取消的步骤 |
| 不回归 | 现有脚本与 index.html 不改，收口行写明现有 15 个用例未动；收口时按项目守则跑一次 `npm run test:e2e` |
| 依赖 | @midscene/web 与 dotenv 为精确版本的开发依赖，index.html 仍零依赖 |

## §3 设计评审（评审子代理）
**状态行**：评审通过



### 轮次 1（评审子代理）

| # | Category | Severity | Issue | Suggestion |
|---|----------|----------|-------|------------|
| 1 | Integration-test design | 🔴 | §2 has no integration-test design section built on the RTM. A glob for RTM files in the project found none, so the RTM the criteria start from does not exist in the project. §2 has no delta of rows broken, redundant or missing, no rows with entry, business result and requirement trace, and no statement that the change alters no business-observable result. The visual S7/S9 scripts are new cases for scenarios S7 ("水印没填完：导出被拦下") and S9 ("给自己存档：关闭水印") in docs/tests/functional-tests.md. | Add an integration-test section to §2 that starts from the RTM. If the project has no RTM, say so and give the reason, or create the RTM rows and fix their numbers before writing case titles. Alternatively state the single permitted reason with its justification. |
| 2 | Acceptance | 🔴 | The acceptance table carries a full-suite run: "现有 15 个用例 `npm run test:e2e` 仍全过". That turns the release gate into a round cost. The design adds new files and dependencies and changes no product code, so the full suite proves nothing new in the implementing round. The count "15" is `unverified` against the repo. | Change the criterion to the changed-face check: run the new visual spec files by file (`npx playwright test <file>`). Alternatively state that existing specs are untouched and report the full suite in the closeout line. |
| 3 | Clarity | 🔴 | The §2 template placeholder is still in place: "<§2 模板占位：本批条目（覆盖） / 设计档落点 / 机制设计 / 受影响文件与测试覆盖 / 验收对照 / 关键决策 / 上抛项>". There is no affected-files list. The new spec file names, helpers.mjs (reused or extended?), package.json, .env.example, .gitignore and the Playwright config (how PlaywrightAiFixture is wired in) are all unnamed. AGENTS.md requires: "每个开发批次开始前，先列出要动的文件". The tier check (criterion 8) cannot be done without a file list. | Add an affected-files table. Add the tier conclusion line, either "none crosses a tier" or the split plan per file that does. Remove the placeholder lines. |
| 4 | Feasibility / Clarity | 🟡 | The S9 flow in docs/tests/functional-tests.md ("弹出一次确认框…在确认框点取消") involves a native confirm dialog. Screenshot-driven aiAct cannot see or operate such a dialog; Playwright's dialog event must handle it. The design says only "选文件、截获下载仍用 Playwright 事件" and does not list dialog handling. The comparison criterion "失败时报告里能否看到弹窗与取消的步骤" presupposes the dialog shows up in the report. | State how the dialog is captured and answered (Playwright event, code-decided). State which S7 and S9 steps are visual and which are code-decided. |
| 5 | Acceptance | 🟡 | The acceptance table does not cover error and edge paths: empty API_KEY in .env, unreachable model service, aiAssert failure (fail or skip?), midscene_run/ reports versus the test/e2e/runs/<时间>/ convention. "连跑 3 次全过" for a model-driven flow needs a stated handling of non-determinism, such as whether a retry counts. | Add the expected behaviour for a missing key or unreachable service. State whether a case skips when no key is present, so the default `npm run test:e2e` does not depend on the network. |
| 6 | Methodology / pinning | 🟡 | The acceptance runs `npx @midscene/test@latest model verify`. @latest is an unpinned fetch, which conflicts with the "精确版本" dependency line below it. | Pin the version, or install @midscene/test as a pinned dev dependency and run it locally. |
| 7 | Doc hygiene / state | 🟡 | Both status lines are unfinished: §1 reads "🔄 进行中（…）" and §2 reads "（主 agent 写入时更新）". §1 and §2 keep their template placeholders. §1 still lists "待用户决定：① 视觉模型与接口…" although §4 records the decisions: scope S7/S9, dependencies approved, model deepseek-flash. §2 names no model, though .env carries NAME and FAMILY. | Settle the status lines and remove the placeholders. Write the confirmed model and FAMILY values (to be checked by model verify) into §2, and let the §1 pending items point to §4. |
| 8 | Existing-piece check | 🟡 | New names (.env.example, the visual spec files, midscene_run/, the four env variable names) carry no three-question answer (existing / none found / existing but unusable). test/mock_data/ is user-provided (§4), but the design never says whether the pilot uses it or the runtime-generated M1–M8 from helpers.mjs. | Add the three-question lines for the new names. State the pilot's material source. |
| 9 | Document ownership | 🟡 | docs/tests/functional-tests.md S7 and S9 say "执行方：自动（s07）" and "执行方：自动（s09）". Once the visual versions exist alongside, the design does not say whether this document is amended or left unchanged during the pilot, or whether results are recorded only in the batch record. Review limitation: no document map exists, so placement is checked against the Project Guide only. | State whether docs/tests/functional-tests.md is amended, and in which line. State that the pilot comparison lives in §5/§6. |
| 10 | Privacy | 🔵 | Page screenshots go to a third-party model service. §4 records the user's approval and that the material is fake data. Acceptable as recorded; .gitignore coverage of .env and midscene_run/ is already in the acceptance table. | None needed. Keep the fake-ID-only boundary visible in §2. |

Closest-precedent line and survey-evidence line are both present in §2 ("最近先例：test/e2e/s07-s09-watermark.spec.mjs", "调查证据：已读 Midscene 官方…"): pass. Counts: 🔴 3, 🟡 6, 🔵 1.

VERDICT: changes-required

### 轮次 2（评审子代理）

验证第 1 轮 10 条意见，对照当前文件逐条读过。

| # | Orig# | File | Severity | Status | Notes |
|---|-------|------|----------|--------|-------|
| 1 | 1 | 本批记录 §2 | 🔴 | Fixed | 已有「集成测试设计」节，写明「本项目的需求追溯表是 docs/tests/functional-tests.md 的「4. 需求覆盖表」」，并写明「本批不新增场景，也不改变任何业务可观察结果」。S7 对应 §7-4、§7-5，S9 对应 §7-1、§10-5，与覆盖表核对一致。 |
| 2 | 2 | 本批记录 §2 | 🔴 | Accepted | 验收行改为「现有脚本与 index.html 不改，收口行写明现有 15 个用例未动；收口时按项目守则跑一次」，试点脚本按文件运行。这是第 1 轮建议的第二种做法，关闭。「15」仍未对仓库核实，属 🔵。 |
| 3 | 3 | 本批记录 §2 | 🔴 | Fixed | 占位行已删，新增「受影响文件与层级」表，并写明「没有任何一项跨层级」。 |
| 4 | 4 | 本批记录 §2 | 🟡 | Fixed | 步骤划分表逐场景分了视觉与代码判定，并写明「原生确认框不画在页面里，截图看不到，必须由代码接住」。 |
| 5 | 5 | 本批记录 §2 | 🟡 | Fixed | 新增「异常与边界」：缺密钥整个文件 skip，不可达或断言失败则失败且不重试，「连跑 3 次」的含义已定义，报告位置已定。 |
| 6 | 6 | 本批记录 §2 | 🟡 | Fixed | 已固定 @midscene/test 具体版本并只用 npx 临时取用。 |
| 7 | 7 | 本批记录 §1、§2 | 🟡 | Unfixed | 模型与 FAMILY 已写进 §2，§1 待决项已清。但两条状态行仍未定：§1 为「🔄 进行中（…）」，§2 为「（主 agent 写入时更新）」。可选，不阻塞。 |
| 8 | 8 | 本批记录 §2 | 🟡 | Fixed | 新增「新名字的三问」表，含素材来源一行。 |
| 9 | 9 | 本批记录 §2 | 🟡 | Fixed | 已写明试点期间 docs/tests/functional-tests.md 不改，对比读数只记在本批 §5、§6。 |
| 10 | 10 | 本批记录 §2 | 🔵 | Fixed | 「隐私边界」一条已写入 §2。 |

新问题：无 🔴。

VERDICT: pass

## §4 用户批准（主 agent）

- 用户 2026-10-28 14:29 原话「增加mock证件：test/mock_data/ .试点范围：S9 和 S7. 可以安装依赖」：同意试点范围为 S7、S9，同意安装依赖，并提供 mock 证件目录。
- 用户 2026-10-28 15:13 原话「素材是网上公开的样张，直接用。模型服务商是deepseek,模型是 deepseek-v4-pro」。此前我已在回复里写明：Midscene 会把页面截图发给所选模型服务商。
- 用户 2026-11-04 17:09 原话「就用deepseek-flash，你创建.env文件并填充你要的参数，我会把api key 等参数的值填写进去。证件样张直接用，都是假数据。」：模型改为 deepseek-flash（Midscene 官方文档写明 DeepSeek-V4-Pro 不支持视觉输入）；.env 由我建好，密钥由用户自己填。

## §5 实施记录（实施者：主 agent ∥ coder）

- 第一步已落地：`npm install --save-dev --save-exact @midscene/web@1.17.2 dotenv@18.0.9`（跳过浏览器下载）；`.gitignore` 增加 midscene_run/、.env、`.env.*` 与 `!.env.example`；新建 .env.example 与 .env（API_KEY 留空等用户填）。peer 依赖 @playwright/test ^1.45.0，现有 1.64.1 满足。
- 安装后 `npm audit` 报 16 条（1 中危 15 高危），主要是 zod、chromium-bidi 等传递依赖；npm 给的修复是把 Midscene 降到 1.12.5（破坏性变更），未动。这些包只在本机跑测试时用，不进 index.html。
- 代码评审第 1 轮（advisor #1，pass，3🟡 2🔵）：#1 批次记录缺批准与设计记录，已补 §2、§4；#2 模型 ID 未实测，官方文档列有 deepseek-flash 与 family deepseek，DeepSeek 自家接口是否接受该 ID 待 model verify，先标 unverified；#3 .env 变体文件未忽略，已在 .gitignore 加 `.env.*` 与 `!.env.example`；#4 dotenv 启动输出，写 playwright.config.mjs 时核对，必要时传 quiet；#5 midscene_run/ 整目录忽略是设计取舍，不改。
- 设计评审两轮：第 1 轮 changes-required（3🔴 6🟡 1🔵），第 2 轮 pass，意见处置见 §3。待办：填好 API Key 后跑固定版本的 model verify，再写 playwright.config.mjs、fixture-ai.mjs 与视觉版脚本。

## §6 验证与收口（父代理）
