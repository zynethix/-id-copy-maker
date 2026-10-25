# id-copy-maker · 子项目守则

## 本目录的身份
这里是产品「id-copy-maker」的开发工地。开发动作只发生在本目录内；开工前先读 docs/requirements.md，按需求文档行事，不扩大范围。

## 工作规矩
1. 每个开发批次开始前，先列出要动的文件；完成后展示 diff 并报告结果。
2. 完成一个阶段后，提醒用户做 Git 存档。
3. 删除/覆盖已有文件、安装依赖、联网部署、花钱操作，必须先请示。

## 部署规范
- 网站部署统一用 EdgeOne Pages（现已升级为 EdgeOne Makers，产品功能不变）：未安装 CLI 则先执行 npm i -g edgeone
- 部署命令：edgeone makers deploy -a overseas，参数 -a overseas 不可省略（海外节点、免备案），任何部署都必须带上
- 部署完成后把 Deploy URL 直接告诉用户
- 部署属于花钱/对外发布动作：执行前必须向用户确认一次


## 官方部署技能资源

部署相关的官方 Skill 清单（来源：EdgeOne Makers 官方技能包 edgeone-makers-tools，2026-10-03 核验）。部署场景优先使用这些官方技能，按需安装：

| Skill | 用途 |
| --- | --- |
| makers-deploy | 部署项目到 EdgeOne（部署主路径） |
| makers-cli | EdgeOne CLI 命令参考 |
| makers-recipes | 项目脚手架 |
| makers-agents | Agent 类项目开发 |
| makers-edge-functions | Edge Functions 开发 |
| makers-cloud-functions | Cloud Functions 开发 |
| makers-storage | KV / Blob 存储 |
| makers-middleware | 中间件 |
| makers-migration | 存量项目改造 |

安装方式：让 AI 执行「从 https://github.com/TencentEdgeOne/edgeone-makers-tools 安装 <技能名> 技能到当前项目」。

部署红线（守则级，不得违反）：
1. 部署命令必须带 -a overseas（海外节点、免备案），任何部署不得省略——官方 Skill 默认区域是 global（含大陆、触发备案），若 Skill 部署链不覆盖选区参数，必须改用 CLI 显式命令；
2. 部署动作执行前必须向用户确认；
3. 部署完成后把 Deploy URL 直接告诉用户。
