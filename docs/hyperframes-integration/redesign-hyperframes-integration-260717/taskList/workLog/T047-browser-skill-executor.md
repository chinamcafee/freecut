# T047 实现浏览器轻量执行器

## 任务

实现浏览器轻量执行器，交付无文件系统需求的模型生成和内存项目目录输出。验收重点是：输出归一化为 `SkillOutputBundle`。

## 完成内容

- 新增 `src/features/hyperframes-runtime/bridges/skills-bridge/browserSkillExecutor.ts`：
  - 定义 `BrowserSkillExecutor`、`BrowserSkillExecutorError`、`BrowserSkillModelInvoker`、`BrowserSkillModelRequest`、`BrowserSkillModelResult`。
  - 实现 `checkBrowserSkillPlan()`，限制浏览器轻量执行器只接受浏览器/远程模型/内存输出能力。
  - 支持的权限：`filesystem.temp-write`、`network.access`、`tool.browser`、`material.*.read`。
  - 拒绝本地能力：FFmpeg、render runtime、本地命令行、Python、Node、本地服务步骤等。
  - `executeJob()` 只接受 `running` 状态的 `HyperFramesSkillJob`。
  - 对带模型步骤的 plan 调用注入的 `modelInvoker`，不在执行器里选择供应商。
  - 将模型输出归一化为内存中的 `HyperFramesProjectDirectory`。
  - 生成 `index.html`、`compositions/main.html`、`metadata/provenance.json`、`metadata/diagnostics.json`。
  - 复用现有 `hyperFramesLintAdapter` 对内存项目目录做浏览器侧 lint。
  - 返回统一 `HyperFramesSkillOutputBundle`，包含 projectDirectory、manifest、generatedFiles、sourceAssets、logs、diagnostics、modelUsage、suggestedImportStrategy。
- 安全和边界：
  - 不写本地文件系统。
  - 不执行上游技能脚本。
  - 不调用 Chrome、FFmpeg、Python、Node 或 HyperFrames CLI。
  - 模型返回的不安全路径会被丢弃，并生成 blocking diagnostic。
  - 支持 `AbortSignal`，取消时抛出 `BrowserSkillExecutorError('canceled')`。
- 新增导出：
  - `src/features/hyperframes-runtime/bridges/skills-bridge/index.ts`
  - `src/features/hyperframes-runtime/index.ts`
- 新增 `src/features/hyperframes-runtime/bridges/skills-bridge/browserSkillExecutor.test.ts`：
  - 验证模型驱动的 browser-light job 归一化为 `SkillOutputBundle`。
  - 验证本地 runtime/FFmpeg plan 被拒绝。
  - 验证 unsafe model file path 进入 blocking diagnostic。
  - 验证带模型步骤但没有 `modelInvoker` 时失败。

## 关键决策

- 浏览器轻量执行器只负责轻量 HTML/项目目录内存生成，不尝试覆盖本地生产渲染能力。
- 模型调用采用依赖注入的 `modelInvoker`，执行器只组装请求、记录日志和归一化输出，符合“技能不选择供应商”的模型中心边界。
- `filesystem.temp-write` 在浏览器执行器里解释为内存项目目录写入，不代表真实本地文件系统写入。
- `SkillOutputBundle` 由 T046 定义，T047 直接复用，后续本地服务执行器和导入预览会共享同一输出合同。
- lint 复用 FreeCut 内部镜像的 HyperFrames lint adapter，不依赖外部 `@hyperframes/*` 包。

## 验证

- `PATH="/Users/changzechuan/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH" node node_modules/.bin/vp check --fix src/features/hyperframes-runtime/bridges/skills-bridge/browserSkillExecutor.ts src/features/hyperframes-runtime/bridges/skills-bridge/browserSkillExecutor.test.ts src/features/hyperframes-runtime/bridges/skills-bridge/index.ts src/features/hyperframes-runtime/index.ts`
- `PATH="/Users/changzechuan/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH" node node_modules/.bin/vp test run src/features/hyperframes-runtime/bridges/skills-bridge/browserSkillExecutor.test.ts`
- `PATH="/Users/changzechuan/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH" node node_modules/.bin/vp test run src/features/hyperframes-runtime/provenance/skills-resource-mirror.test.ts src/features/hyperframes-runtime/provenance/manifest.test.ts src/features/hyperframes-runtime/bridges/skills-bridge/skillDirectoryParser.test.ts src/features/hyperframes-runtime/bridges/skills-bridge/skillRecommender.test.ts src/features/hyperframes-runtime/bridges/skills-bridge/generationPlan.test.ts src/features/hyperframes-runtime/bridges/skills-bridge/skillJobQueue.test.ts src/features/hyperframes-runtime/bridges/skills-bridge/browserSkillExecutor.test.ts`
- `PATH="/Users/changzechuan/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH" node node_modules/.bin/vp test run src/shared/projects/migrations/sanitize-text-motion.test.ts src/shared/projects/migrations/index.test.ts src/types/hyperframes.test.ts src/types/timeline-hyperframes.test.ts src/features/hyperframes-runtime/provenance/skills-resource-mirror.test.ts src/features/hyperframes-runtime/provenance/manifest.test.ts src/features/hyperframes-runtime/bridges/player-bridge/useFreeCutTimelineClock.test.tsx src/features/hyperframes-runtime/bridges/player-bridge/HyperFramesPlayerHost.test.tsx src/features/hyperframes-runtime/bridges/player-bridge/runtimeMessageProtocol.test.ts src/features/hyperframes-runtime/bridges/skills-bridge/skillDirectoryParser.test.ts src/features/hyperframes-runtime/bridges/skills-bridge/skillRecommender.test.ts src/features/hyperframes-runtime/bridges/skills-bridge/generationPlan.test.ts src/features/hyperframes-runtime/bridges/skills-bridge/skillJobQueue.test.ts src/features/hyperframes-runtime/bridges/skills-bridge/browserSkillExecutor.test.ts src/features/preview/components/hyperframes-preview-overlay.test.tsx src/features/hyperframes-runtime/model-center/credentialCostBudget.test.ts src/features/hyperframes-runtime/model-center/modelCenterStore.test.ts src/features/hyperframes-runtime/model-center/modelRegistry.test.ts src/features/hyperframes-runtime/adapters/freecut-project/lint-adapter.test.ts src/features/hyperframes-runtime/adapters/freecut-project/parser-adapter.test.ts src/features/hyperframes-runtime/adapters/freecut-project/compiler-adapter.test.ts src/features/hyperframes-runtime/adapters/freecut-project/project-signatures.test.ts src/features/hyperframes-runtime/adapters/freecut-project/project-directory-bundle.test.ts src/features/hyperframes-runtime/adapters/freecut-project/runtime-adapter.test.ts src/features/hyperframes-runtime/adapters/freecut-project/file-system-project-repository.test.ts src/features/hyperframes-runtime/adapters/freecut-project/project-path-guards.test.ts src/features/hyperframes-runtime/adapters/freecut-project/project-repository.test.ts src/features/hyperframes-runtime/model-center/ModelCapabilityCenter.test.tsx src/features/hyperframes-runtime/model-center/providers/openAICompatibleProvider.test.ts src/features/hyperframes-runtime/model-center/providers/privateGatewayProvider.test.ts src/features/hyperframes-runtime/model-center/providers/localModelProvider.test.ts src/features/hyperframes-runtime/adapters/freecut-preview/preview-document.test.ts src/features/hyperframes-runtime/upstream/core/freecut-runtime-mirror.test.ts src/features/hyperframes-runtime/upstream/lint/freecut-runtime-mirror.test.ts src/features/hyperframes-runtime/bridges/studio-bridge/createFreeCutStudioRouteAdapter.test.ts src/features/hyperframes-runtime/bridges/studio-bridge/FreeCutStudioShell.test.tsx src/features/hyperframes-runtime/bridges/studio-bridge/createFreeCutStudioAdapter.test.ts src/features/hyperframes-runtime/bridges/studio-bridge/studioThemeAdapter.test.ts src/features/hyperframes-runtime/bridges/studio-bridge/studioFilePatchWorkflow.test.ts src/features/hyperframes-runtime/upstream/player/freecut-runtime-mirror.test.ts src/features/hyperframes-runtime/upstream/studio/freecut-runtime-mirror.test.tsx src/features/hyperframes-runtime/upstream/core/compiler/freecut-runtime-mirror.test.ts src/features/hyperframes-runtime/upstream/studio/components/editor/studioAdvancedEditing.test.tsx src/features/hyperframes-runtime/upstream/studio-server/helpers/freecut-runtime-mirror.test.ts src/features/hyperframes-runtime/upstream/parsers/freecut-runtime-mirror.test.ts src/features/timeline/components/timeline-item/use-timeline-item-pointer-handlers.test.tsx`
- `PATH="/Users/changzechuan/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH" node scripts/check-hyperframes-runtime-imports.mjs`
- `git diff --check`
- `PATH="/Users/changzechuan/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH" node node_modules/.bin/vp check --no-fmt`
- `PATH="/Users/changzechuan/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH" node node_modules/.bin/vp build`

## 备注

- T047 目标测试通过：1 个测试文件、4 个测试通过。
- T042-T047 组合测试通过：7 个测试文件、27 个测试通过。
- HyperFrames 相关回归通过：46 个测试文件、200 个测试通过。
- `check-hyperframes-runtime-imports` 确认没有直接 `@hyperframes/*` import。
- `git diff --check` 通过。
- `vp check --no-fmt` 通过，仍有 44 个既有 warning，主要来自 `.codex/skills/translate-app-locales/scripts/check-locale-coverage.mjs`、`headless/*.mjs` 的 `console.log` 和 `src/features/keyframes/components/dopesheet-editor/dopesheet-timeline-cells.tsx:35` 的 `react(only-export-components)`。
- `vp build` 通过；构建日志只有既有 dynamic import、chunk size 和 plugin timing 警告。
