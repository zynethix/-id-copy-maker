# 2026-10-26 · e2e-playwright
> 六段 append-only，一段一作者：§1 讨论（主 agent）· §2 批次任务与设计（主 agent）· §3 设计评审（评审子代理）· §4 用户批准（主 agent）· §5 实施记录（实施者：主 agent ∥ coder）· §6 验证与收口（父代理）。
> 编制：主 agent · 2026-10-26 · 来源 = 用户 2026-10-26 会话：选型「按你的」（只上 Playwright，Midscene 以后再说）；「不用保留」（不跑 init-agents）；「开始」（同意装 @playwright/test@1.64.1 与文件清单）。
> 台账 = #4（id-copy-maker · 归批）。前情 = docs/batches/2026-10-26-functional-test-design.md（已收口）。
## §1 讨论（主 agent）
**状态行**：已收口 2026-10-27
<§1 模板占位：本批条目 / 关键判据 / 授权口径>

- 用户裁定：选型只上 Playwright（「按你的」）；不跑 init-agents（「不用保留」）；同意装依赖与文件清单（「开始」）。
- 台账 #4 已登记并推进到在途，task_book 指向本记录。

- 代码评审：advisor 第 1 轮 changes-required（1🔴 4🟡 6🔵），11 项修复后第 2 轮起各轮均 pass，修复后代码未再改动。
- 用户对过程证据与测试方法的追问经 grilling 问答定案（Q1–Q22），结论另起批次落地：四个测试技能 + 每次保留截图、trace 与 HTML 报告；本批原样收口（用户原话「当前批次先原样收口，证据配置和技能一起另开一批」）。
> 不适用：§3 —— 本批未做独立设计评审，落地后做了代码评审（见上一行），评审结论记在 §5。

## §2 批次任务与设计（主 agent）
**状态行**：（主 agent 写入时更新）
<§2 模板占位：本批条目（覆盖） / 设计档落点 / 机制设计 / 受影响文件与测试覆盖 / 验收对照 / 关键决策 / 上抛项>

### 本批任务
按 docs/tests/functional-tests.md 把桌面可自动的场景写成 Playwright 端到端测试，在本机 Chrome 上以 file:// 运行。

### 落点
- 依赖：`@playwright/test` 1.64.1（开发依赖，版本写死）；不下载 Playwright 自带浏览器，配置 `channel: 'chrome'`。
- 新增：package.json（`npm run test:e2e`）、package-lock.json、playwright.config.mjs、.gitignore、test/e2e/helpers.mjs、5 个场景文件（s01、s02-s03、s04-s06、s07-s09、s10-s15）。
- 文档：docs/tests/functional-tests.md 执行方表加「自动」，各场景标明自动或手工、真机；design §14.3 第三条改为说明集成测试的位置、运行方式与边界。
- 未改：index.html。

### 做法
- 只通过用户操作驱动：点按钮、文件选择器选文件、鼠标拖动裁剪框与角点、处理确认框。不调用页面内部函数。唯一例外是 S7 里把禁用的导出按钮改为可点后硬点，模拟用户绕过禁用。
- mock 素材在测试里用画布生成，带品红角标判断方向；EXIF 方向与 GPS 段在 Node 侧拼进 JPEG；HEIC 用带文件头的假数据。
- 导出文件从下载事件取得，在 Node 侧解析 PNG 块、JPEG 段与 PDF 文本，在页面里解码取像素，判断版面、颜色、水印与尺寸。

### 不在本批
Midscene 等 AI 视觉检查；init-agents（用户裁定不保留）；手工与真机部分。

## §3 设计评审（评审子代理）
## §4 用户批准（主 agent）

用户 2026-10-27 00:02 对共识第 10 条「先把当前批次原样收口（必要时先存档）」及 Q22「收口后马上存档」的确认，原话「按你的」。

## §5 实施记录（实施者：主 agent ∥ coder）

主 agent 直接实施。
- 安装：`PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 npm install --save-dev --save-exact @playwright/test@1.64.1`，added 3 packages，0 vulnerabilities。
- 运行：`npx playwright test`，15 passed（9.0s）；再跑两次，均为 15 passed（6.4s、6.3s）。
- 调试中修正的脚本问题（均为测试脚本自身，非产品缺陷）：裁剪框读法从「白色像素外接框」改为「过框中心扫白色边线」（角点方块在图边被截掉）；S1 素材改为 3600×2000，使最大框高度顶满；S1 拖角点改为沿对角线方向。
- 产品缺陷：本轮未发现。
- 运行产物 test-results/ 与 /tmp 日志已删除；node_modules/ 由 .gitignore 忽略。

### 代码评审第 1 轮修复（advisor #1，VERDICT changes-required）
- #1 S9：改用纯色素材，水印像素在 Node 侧分离（页面 CSP 不允许页内 eval，页面只回传像素）；断言开水印时预览、PNG、PDF 两张卡片都有水印，取消关闭后预览仍有，确定关闭后预览、PNG、PDF 两张卡片水印像素为 0，重新开启后恢复；删去错误的交叉引用注释。
- #2 S2：空白一面改查卡片位置外扩 30 像素的区域（frontOuter/backOuter）。
- #3 S4：转正改为点三次，导出后断言红块在卡片左半（左 >5%，右 <1%）；歪 5° 照片导出后量卡片上边两列高差 >15 像素，证明未纠斜。
- #4 S1：补 §7-3 样式断言（PNG 上墨色三通道差 <15、透明度 0.2–0.4、斜度 15°–60°、至少 2 行；PDF 上斜度与行数）。
- #5 S8：导出画面核对水印存在与样式；逐字内容靠徽标，文档已写明画面逐字比对需目视。
- #6 S11：补 reload，注释写清离线模式与判据。#7 S10：用页面内观察者在徽标变成「解码中…」的同一刻点清除并记录点击时徽标文字；清除前把用途、日期、自定义文字、开关都改过。撤销读取中的 blob 地址带来的一条控制台消息被单独放过，其它错误仍判失败。
- #8 S15 断言 #old-warn 存在且隐藏；S14 第二页、S6 检查控制台错误。#9 S3 来回切换时检查预览；S6 检查预览画面不变。
- #10 makeMockImage 加 try/finally；PAGE_URL 改用 import.meta.url；package.json 加 engines node>=20（@playwright/test 1.64.1 自身声明 node >=20）；文档写明运行前提。#11 .gitignore 加 .DS_Store。
- 读数：`npx playwright test` 连跑 3 次，均 15 passed（6.3s、6.4s、6.4s）。临时探针脚本与 test-results/ 已删除。

## §6 验证与收口（父代理）

- 交付：@playwright/test 1.64.1（开发依赖）、playwright.config.mjs、package.json、.gitignore、test/e2e/ 下 helpers 与 5 个场景文件；functional-tests.md 标明自动/手工/真机；design §14.3 改写集成测试说明。index.html 未改。
- 验证：修复后 `npx playwright test` 连跑 3 次均 15 passed；代码评审第 2 轮起 pass；doc_check 对两份文档 0 命中。
- 测试行：集成测试 15 个场景用例落在 test/e2e/，本批未写单元测试。未自动化部分（S1 第 10 步打印量尺、Edge 与 Safari、真机 S12/S13-3/S6-4/S11-4）由所有者手工执行，本批未执行。
- 已知限制：当前配置不保留截图、trace 与报告，由后续批次处理。
