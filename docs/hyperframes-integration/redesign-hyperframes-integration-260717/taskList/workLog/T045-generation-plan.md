# T045 实现生成计划 `GenerationPlan`

## 任务

实现生成计划 `GenerationPlan`，交付步骤、工具权限、模型调用预算、输出目录和预计时长。验收重点是：计划必须先展示并确认，不能直接执行写入。

## 完成内容

- 新增 `src/features/hyperframes-runtime/bridges/skills-bridge/generationPlan.ts`：
  - 定义 `HyperFramesGenerationPlan`、`HyperFramesGenerationPlanStep`、`HyperFramesGenerationToolPermission`、`HyperFramesGenerationModelBudget`、`HyperFramesGenerationOutputPlan` 等类型。
  - 支持 `draft` / `confirmed` 状态，默认生成 draft plan。
  - draft plan 设置 `requiresUserConfirmation: true`、`canExecute: false`。
  - `write-project-files` 步骤设置 `requiresPlanConfirmation: true`，确认前不可执行。
  - `confirmHyperFramesGenerationPlan()` 显式确认后才把 plan 和步骤切换为可执行。
  - `canExecuteHyperFramesGenerationPlan()` 只允许 confirmed plan 执行。
- 实现 `createHyperFramesGenerationPlan()`：
  - 从技能推荐结果、用户上下文和模型路由计划生成计划。
  - 输出固定进入临时 HyperFrames 输出目录，默认形如 `hyperframes/generated/<skill-id>-<timestamp>`。
  - 根据技能和意图选择导入策略：`source-link`、`source-link-with-approximations`、`rendered-media`。
  - 生成步骤：`collect-context`、`analyze-media`、`call-model`、`run-skill`、`write-project-files`、`lint`、`preview`、`render`、`prepare-import`。
  - 根据技能工具需求、素材类型、URL 和模型路由推导工具权限。
  - 根据模型中心 `ModelRoutingPlan` 生成模型预算、付费模型和确认要求。
  - 根据素材帧数估算输出时长。
- 新增导出：
  - `src/features/hyperframes-runtime/bridges/skills-bridge/index.ts`
  - `src/features/hyperframes-runtime/index.ts`
- 新增 `src/features/hyperframes-runtime/bridges/skills-bridge/generationPlan.test.ts`：
  - 验证产品发布视频 plan 包含步骤、权限、预算和临时输出目录。
  - 验证确认前不可执行，确认后才允许执行写入步骤。
  - 验证字幕包场景使用 render runtime 和 rendered-media 导入策略。

## 关键决策

- `GenerationPlan` 只描述可展示、可确认的计划，不执行技能，也不写入 FreeCut 项目。
- 输出目录是临时目录计划，后续任务队列和执行器只能在用户确认后使用。
- 模型预算接入 T036-T041 的模型中心结构，避免技能编排绕过模型配置、预算和权限门禁。
- 模型能力缺口保留为 warning，便于 UI 在计划确认前展示阻断原因或配置建议。
- 导入策略在计划层提前确定，便于后续任务队列、执行器和 FreeCut 导入预览保持同一语义。

## 验证

- `PATH="/Users/changzechuan/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH" node node_modules/.bin/vp check --fix src/features/hyperframes-runtime/bridges/skills-bridge/generationPlan.ts src/features/hyperframes-runtime/bridges/skills-bridge/generationPlan.test.ts src/features/hyperframes-runtime/bridges/skills-bridge/index.ts src/features/hyperframes-runtime/index.ts`
- `PATH="/Users/changzechuan/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH" node node_modules/.bin/vp test run src/features/hyperframes-runtime/bridges/skills-bridge/generationPlan.test.ts`
- `PATH="/Users/changzechuan/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH" node node_modules/.bin/vp test run src/features/hyperframes-runtime/provenance/skills-resource-mirror.test.ts src/features/hyperframes-runtime/provenance/manifest.test.ts src/features/hyperframes-runtime/bridges/skills-bridge/skillDirectoryParser.test.ts src/features/hyperframes-runtime/bridges/skills-bridge/skillRecommender.test.ts src/features/hyperframes-runtime/bridges/skills-bridge/generationPlan.test.ts`
- `PATH="/Users/changzechuan/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH" node node_modules/.bin/vp test run src/shared/projects/migrations/sanitize-text-motion.test.ts src/shared/projects/migrations/index.test.ts src/types/hyperframes.test.ts src/types/timeline-hyperframes.test.ts src/features/hyperframes-runtime/provenance/skills-resource-mirror.test.ts src/features/hyperframes-runtime/provenance/manifest.test.ts src/features/hyperframes-runtime/bridges/player-bridge/useFreeCutTimelineClock.test.tsx src/features/hyperframes-runtime/bridges/player-bridge/HyperFramesPlayerHost.test.tsx src/features/hyperframes-runtime/bridges/player-bridge/runtimeMessageProtocol.test.ts src/features/hyperframes-runtime/bridges/skills-bridge/skillDirectoryParser.test.ts src/features/hyperframes-runtime/bridges/skills-bridge/skillRecommender.test.ts src/features/hyperframes-runtime/bridges/skills-bridge/generationPlan.test.ts src/features/preview/components/hyperframes-preview-overlay.test.tsx src/features/hyperframes-runtime/model-center/credentialCostBudget.test.ts src/features/hyperframes-runtime/model-center/modelCenterStore.test.ts src/features/hyperframes-runtime/model-center/modelRegistry.test.ts src/features/hyperframes-runtime/adapters/freecut-project/lint-adapter.test.ts src/features/hyperframes-runtime/adapters/freecut-project/parser-adapter.test.ts src/features/hyperframes-runtime/adapters/freecut-project/compiler-adapter.test.ts src/features/hyperframes-runtime/adapters/freecut-project/project-signatures.test.ts src/features/hyperframes-runtime/adapters/freecut-project/project-directory-bundle.test.ts src/features/hyperframes-runtime/adapters/freecut-project/runtime-adapter.test.ts src/features/hyperframes-runtime/adapters/freecut-project/file-system-project-repository.test.ts src/features/hyperframes-runtime/adapters/freecut-project/project-path-guards.test.ts src/features/hyperframes-runtime/adapters/freecut-project/project-repository.test.ts src/features/hyperframes-runtime/model-center/ModelCapabilityCenter.test.tsx src/features/hyperframes-runtime/model-center/providers/openAICompatibleProvider.test.ts src/features/hyperframes-runtime/model-center/providers/privateGatewayProvider.test.ts src/features/hyperframes-runtime/model-center/providers/localModelProvider.test.ts src/features/hyperframes-runtime/adapters/freecut-preview/preview-document.test.ts src/features/hyperframes-runtime/upstream/core/freecut-runtime-mirror.test.ts src/features/hyperframes-runtime/upstream/lint/freecut-runtime-mirror.test.ts src/features/hyperframes-runtime/bridges/studio-bridge/createFreeCutStudioRouteAdapter.test.ts src/features/hyperframes-runtime/bridges/studio-bridge/FreeCutStudioShell.test.tsx src/features/hyperframes-runtime/bridges/studio-bridge/createFreeCutStudioAdapter.test.ts src/features/hyperframes-runtime/bridges/studio-bridge/studioThemeAdapter.test.ts src/features/hyperframes-runtime/bridges/studio-bridge/studioFilePatchWorkflow.test.ts src/features/hyperframes-runtime/upstream/player/freecut-runtime-mirror.test.ts src/features/hyperframes-runtime/upstream/studio/freecut-runtime-mirror.test.tsx src/features/hyperframes-runtime/upstream/core/compiler/freecut-runtime-mirror.test.ts src/features/hyperframes-runtime/upstream/studio/components/editor/studioAdvancedEditing.test.tsx src/features/hyperframes-runtime/upstream/studio-server/helpers/freecut-runtime-mirror.test.ts src/features/hyperframes-runtime/upstream/parsers/freecut-runtime-mirror.test.ts src/features/timeline/components/timeline-item/use-timeline-item-pointer-handlers.test.tsx`
- `PATH="/Users/changzechuan/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH" node scripts/check-hyperframes-runtime-imports.mjs`
- `git diff --check`
- `PATH="/Users/changzechuan/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH" node node_modules/.bin/vp check --no-fmt`
- `PATH="/Users/changzechuan/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH" node node_modules/.bin/vp build`

## 备注

- T045 目标测试通过：1 个测试文件、3 个测试通过。
- skills bridge 组合测试通过：5 个测试文件、18 个测试通过。
- HyperFrames 相关回归通过：44 个测试文件、191 个测试通过。
- `check-hyperframes-runtime-imports` 确认没有直接 `@hyperframes/*` import。
- `git diff --check` 通过。
- `vp check --no-fmt` 通过，仍有 44 个既有 warning，主要来自 `.codex/skills/translate-app-locales/scripts/check-locale-coverage.mjs`、`headless/*.mjs` 的 `console.log` 和 `src/features/keyframes/components/dopesheet-editor/dopesheet-timeline-cells.tsx:35` 的 `react(only-export-components)`。
- `vp build` 通过；构建日志只有既有 dynamic import、chunk size 和 plugin timing 警告。
