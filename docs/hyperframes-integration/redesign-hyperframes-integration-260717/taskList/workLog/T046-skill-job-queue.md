# T046 实现技能任务队列

## 任务

实现技能任务队列，交付 `pending`、`running`、`waiting-confirmation`、`complete`、`failed`、`canceled` 状态、取消和重试。验收重点是：失败任务必须保留临时项目目录和日志。

## 完成内容

- 新增 `src/features/hyperframes-runtime/bridges/skills-bridge/skillJobQueue.ts`：
  - 定义 `HyperFramesSkillJobStatus`，覆盖 `pending`、`running`、`waiting-confirmation`、`complete`、`failed`、`canceled`。
  - 定义 `HyperFramesSkillJob`，记录任务编号、技能编号、用户输入、计划快照、模型配置快照、尝试次数、当前阶段、日志、输出目录、诊断、失败历史和清理要求。
  - 定义 `HyperFramesSkillOutputBundle`，供后续 T047/T048 执行器输出归一化复用。
  - 实现 `HyperFramesSkillJobQueue` 和 `createHyperFramesSkillJobQueue()`。
- 队列能力：
  - `enqueueJob()`：已确认计划进入 `pending`；未确认计划进入 `waiting-confirmation`。
  - `confirmWaitingJob()`：确认 plan 或 retry-limit 后进入 `pending`。
  - `startNextJob()` / `startJob()`：从 `pending` 进入 `running`，并累计 attempt。
  - `updateJobStage()` / `appendJobLog()`：记录阶段和日志。
  - `completeJob()`：完成后保存归一化输出 bundle。
  - `failJob()`：失败后进入 `failed`，保留 `outputDirectory`、日志、诊断和失败历史，且 `cleanupRequired: false`。
  - `cancelJob()`：支持取消 `pending`、`waiting-confirmation`、`running` 任务，保留输出目录和日志。
  - `retryJob()`：失败后可重试，保留临时目录和日志；超过 `maxAttempts` 时转入 `waiting-confirmation`，避免无限自动重试。
  - `subscribe()`：为后续主面板 UI 或任务托盘提供队列快照订阅。
- 新增导出：
  - `src/features/hyperframes-runtime/bridges/skills-bridge/index.ts`
  - `src/features/hyperframes-runtime/index.ts`
- 新增 `src/features/hyperframes-runtime/bridges/skills-bridge/skillJobQueue.test.ts`：
  - 验证 draft plan 入队后等待确认，确认后才能运行。
  - 验证运行、阶段日志和 complete output bundle。
  - 验证取消运行中任务不清理临时目录。
  - 验证失败保留临时项目目录、诊断和日志，并可重试。
  - 验证超过重试阈值后进入 `waiting-confirmation`。

## 关键决策

- T046 只实现任务队列状态机，不执行技能脚本、不访问文件系统、不调用模型，避免提前跨过 T047/T048 的执行器边界。
- 队列以 `GenerationPlan` 为输入；未确认 plan 不会进入可运行状态。
- 失败默认 `retryable: true`，但不会无限重试；达到阈值后必须再次确认。
- 失败任务始终保留 `outputDirectory`、日志、诊断和失败历史，方便后续模型修复、切换模型修复或打开工作室手动修复。
- `SkillOutputBundle` 先在队列层定义统一合同，后续浏览器轻量执行器、本地服务执行器和导入预览可以共享同一输出形状。

## 验证

- `PATH="/Users/changzechuan/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH" node node_modules/.bin/vp check --fix src/features/hyperframes-runtime/bridges/skills-bridge/skillJobQueue.ts src/features/hyperframes-runtime/bridges/skills-bridge/skillJobQueue.test.ts src/features/hyperframes-runtime/bridges/skills-bridge/index.ts src/features/hyperframes-runtime/index.ts`
- `PATH="/Users/changzechuan/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH" node node_modules/.bin/vp test run src/features/hyperframes-runtime/bridges/skills-bridge/skillJobQueue.test.ts`
- `PATH="/Users/changzechuan/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH" node node_modules/.bin/vp test run src/features/hyperframes-runtime/provenance/skills-resource-mirror.test.ts src/features/hyperframes-runtime/provenance/manifest.test.ts src/features/hyperframes-runtime/bridges/skills-bridge/skillDirectoryParser.test.ts src/features/hyperframes-runtime/bridges/skills-bridge/skillRecommender.test.ts src/features/hyperframes-runtime/bridges/skills-bridge/generationPlan.test.ts src/features/hyperframes-runtime/bridges/skills-bridge/skillJobQueue.test.ts`
- `PATH="/Users/changzechuan/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH" node node_modules/.bin/vp test run src/shared/projects/migrations/sanitize-text-motion.test.ts src/shared/projects/migrations/index.test.ts src/types/hyperframes.test.ts src/types/timeline-hyperframes.test.ts src/features/hyperframes-runtime/provenance/skills-resource-mirror.test.ts src/features/hyperframes-runtime/provenance/manifest.test.ts src/features/hyperframes-runtime/bridges/player-bridge/useFreeCutTimelineClock.test.tsx src/features/hyperframes-runtime/bridges/player-bridge/HyperFramesPlayerHost.test.tsx src/features/hyperframes-runtime/bridges/player-bridge/runtimeMessageProtocol.test.ts src/features/hyperframes-runtime/bridges/skills-bridge/skillDirectoryParser.test.ts src/features/hyperframes-runtime/bridges/skills-bridge/skillRecommender.test.ts src/features/hyperframes-runtime/bridges/skills-bridge/generationPlan.test.ts src/features/hyperframes-runtime/bridges/skills-bridge/skillJobQueue.test.ts src/features/preview/components/hyperframes-preview-overlay.test.tsx src/features/hyperframes-runtime/model-center/credentialCostBudget.test.ts src/features/hyperframes-runtime/model-center/modelCenterStore.test.ts src/features/hyperframes-runtime/model-center/modelRegistry.test.ts src/features/hyperframes-runtime/adapters/freecut-project/lint-adapter.test.ts src/features/hyperframes-runtime/adapters/freecut-project/parser-adapter.test.ts src/features/hyperframes-runtime/adapters/freecut-project/compiler-adapter.test.ts src/features/hyperframes-runtime/adapters/freecut-project/project-signatures.test.ts src/features/hyperframes-runtime/adapters/freecut-project/project-directory-bundle.test.ts src/features/hyperframes-runtime/adapters/freecut-project/runtime-adapter.test.ts src/features/hyperframes-runtime/adapters/freecut-project/file-system-project-repository.test.ts src/features/hyperframes-runtime/adapters/freecut-project/project-path-guards.test.ts src/features/hyperframes-runtime/adapters/freecut-project/project-repository.test.ts src/features/hyperframes-runtime/model-center/ModelCapabilityCenter.test.tsx src/features/hyperframes-runtime/model-center/providers/openAICompatibleProvider.test.ts src/features/hyperframes-runtime/model-center/providers/privateGatewayProvider.test.ts src/features/hyperframes-runtime/model-center/providers/localModelProvider.test.ts src/features/hyperframes-runtime/adapters/freecut-preview/preview-document.test.ts src/features/hyperframes-runtime/upstream/core/freecut-runtime-mirror.test.ts src/features/hyperframes-runtime/upstream/lint/freecut-runtime-mirror.test.ts src/features/hyperframes-runtime/bridges/studio-bridge/createFreeCutStudioRouteAdapter.test.ts src/features/hyperframes-runtime/bridges/studio-bridge/FreeCutStudioShell.test.tsx src/features/hyperframes-runtime/bridges/studio-bridge/createFreeCutStudioAdapter.test.ts src/features/hyperframes-runtime/bridges/studio-bridge/studioThemeAdapter.test.ts src/features/hyperframes-runtime/bridges/studio-bridge/studioFilePatchWorkflow.test.ts src/features/hyperframes-runtime/upstream/player/freecut-runtime-mirror.test.ts src/features/hyperframes-runtime/upstream/studio/freecut-runtime-mirror.test.tsx src/features/hyperframes-runtime/upstream/core/compiler/freecut-runtime-mirror.test.ts src/features/hyperframes-runtime/upstream/studio/components/editor/studioAdvancedEditing.test.tsx src/features/hyperframes-runtime/upstream/studio-server/helpers/freecut-runtime-mirror.test.ts src/features/hyperframes-runtime/upstream/parsers/freecut-runtime-mirror.test.ts src/features/timeline/components/timeline-item/use-timeline-item-pointer-handlers.test.tsx`
- `PATH="/Users/changzechuan/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH" node scripts/check-hyperframes-runtime-imports.mjs`
- `git diff --check`
- `PATH="/Users/changzechuan/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH" node node_modules/.bin/vp check --no-fmt`
- `PATH="/Users/changzechuan/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH" node node_modules/.bin/vp build`

## 备注

- T046 目标测试通过：1 个测试文件、5 个测试通过。
- skills bridge 组合测试通过：6 个测试文件、23 个测试通过。
- HyperFrames 相关回归通过：45 个测试文件、196 个测试通过。
- `check-hyperframes-runtime-imports` 确认没有直接 `@hyperframes/*` import。
- `git diff --check` 通过。
- `vp check --no-fmt` 通过，仍有 44 个既有 warning，主要来自 `.codex/skills/translate-app-locales/scripts/check-locale-coverage.mjs`、`headless/*.mjs` 的 `console.log` 和 `src/features/keyframes/components/dopesheet-editor/dopesheet-timeline-cells.tsx:35` 的 `react(only-export-components)`。
- `vp build` 通过；构建日志只有既有 dynamic import、chunk size 和 plugin timing 警告。
