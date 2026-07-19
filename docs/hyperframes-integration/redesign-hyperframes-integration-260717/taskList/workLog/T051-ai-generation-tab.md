# T051 实现 AI 生成页签

## 任务

在 FreeCut 主界面的 AI 页签中实现 HyperFrames 生成入口，提供自然语言输入、快速模板、技能推荐、生成计划和成本预估，并保持确认前不执行生成任务。

## 完成内容

- 新增 `src/features/hyperframes-runtime/components/HyperFramesGenerateTab.tsx`：
  - 提供片头、字幕、产品、网站、动态图形、音乐和解释视频快速模板。
  - 提供自然语言输入、推荐时长和画幅选择。
  - 复用 `recommendHyperFramesSkills()` 展示前三个匹配技能，并支持用户切换推荐技能。
  - 复用 `createHyperFramesGenerationPlan()` 生成含步骤、输出目录、模型预算和导入策略的草稿计划。
  - 复用 `confirmHyperFramesGenerationPlan()` 显式确认计划；确认前计划不可执行。
  - 展示输出类型、预计时长、画幅、模型能力、最高费用、透明背景、源链接和原生近似项策略。
- 新增 `src/features/hyperframes-runtime/components/uiSkillCatalog.ts`：
  - 通过 Vite raw glob 从已迁入 FreeCut 的 `upstream/skills/*/SKILL.md` 构建浏览器端技能目录。
  - 不在运行时读取外部 HyperFrames 仓库。
- 将 `HyperFramesGenerateTab` 挂载到现有 `AiPanel` 顶部，使用户可留在 FreeCut 主面板完成生成入口操作。
- 新增组件出口并从 `src/features/hyperframes-runtime/index.ts` 统一导出。
- 新增 `HyperFramesGenerateTab.test.tsx`，覆盖网站模板生成/确认计划，以及自然语言动态图形技能推荐。

## 关键决策

- 本任务只创建和确认生成计划，不直接运行技能或写入项目，符合“计划、确认、执行”三阶段边界。
- 浏览器技能目录以迁入的上游 `SKILL.md` 为数据源，并使用技能 ID 生成稳定的 UI 名称，避免上游文档标题变化影响界面。
- 成本预估使用技能模型需求形成保守上限；后续接入真实模型中心路由后可直接替换为实际供应商预算。
- 自然语言输入会推断字幕、动态图形和重剪意图，避免通用新视频技能压过更精确的推荐。

## 验证

- `PATH="/Users/changzechuan/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH" node node_modules/.bin/vp test run src/features/hyperframes-runtime/components/HyperFramesGenerateTab.test.tsx`
- `PATH="/Users/changzechuan/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH" node node_modules/.bin/vp check --no-fmt src/features/hyperframes-runtime/components/HyperFramesGenerateTab.tsx src/features/hyperframes-runtime/components/HyperFramesGenerateTab.test.tsx src/features/hyperframes-runtime/components/uiSkillCatalog.ts src/features/editor/components/ai-panel.tsx src/features/hyperframes-runtime/index.ts`
- `git diff --check`

## 结果

- T051 核心测试通过：1 个测试文件、2 个测试通过。
- 相关 5 个文件 lint 和类型检查通过，无警告。
- `git diff --check` 通过。
