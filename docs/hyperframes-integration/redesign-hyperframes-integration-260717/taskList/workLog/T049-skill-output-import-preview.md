# T049 实现技能输出归一化和导入预览

## 任务

实现技能输出归一化和导入预览，交付 `projectDirectory`、`manifest`、`diagnostics`、`modelUsage`、`suggestedImportStrategy`。验收重点是：导入前可预览、lint、估算成本、选择导入策略。

## 完成内容

- 新增 `src/features/hyperframes-runtime/bridges/skills-bridge/skillOutputImportPreview.ts`：
  - 定义 `HyperFramesSkillImportPreview`、文件树、资产列表、导入策略选项和费用汇总类型。
  - 实现 `normalizeSkillOutputBundle()`，支持从完整 `projectDirectory` 或 `manifest` + `generatedFiles` + `sourceAssets` 归一化出项目目录。
  - 对缺失 manifest、空输出、缺失 entry file、缺失 active composition 生成阻塞诊断。
  - 调用 `hyperFramesLintAdapter.lintProjectDirectory()`，在导入预览阶段复用统一 lint 诊断模型。
  - 仅在无阻塞诊断时创建 iframe `previewDocument`，用于导入确认前预览。
  - 汇总 `modelUsage` 为 `costSummary`，包含费用、输入 token、输出 token 和原始 usage。
  - 根据输出内容生成 `source-link`、`source-link-with-approximations`、`rendered-media` 导入策略选项。
  - 支持用户选择可用导入策略；不可用策略自动回退到第一个可用选项。
- 新增导出：
  - `src/features/hyperframes-runtime/bridges/skills-bridge/index.ts`
  - `src/features/hyperframes-runtime/index.ts`
- 新增 `src/features/hyperframes-runtime/bridges/skills-bridge/skillOutputImportPreview.test.ts`：
  - 验证 lint 后的导入预览包含文件树、资产、模型成本和 iframe 文档。
  - 验证缺失 active composition 时阻止确认导入，且不生成预览文档。
  - 验证用户可以选择不同的已启用导入策略。
  - 验证只提供 manifest、generatedFiles、sourceAssets 的 bundle 也能归一化。

## 关键决策

- T049 只建立导入预览和确认前检查，不在此阶段写入 FreeCut 项目或时间线；实际确认、回滚和修复由 T050 承接。
- 导入预览走真实 HyperFrames lint adapter，不用测试桩绕过安全规则。测试 fixture 明确注册 `window.__timelines`，确保组合 HTML 满足当前上游 lint 合约。
- `rendered-media` 策略只在输出含媒体资产或技能建议该策略时启用，避免把源码链接生成误判成已渲染素材。
- `canConfirmImport` 同时依赖无阻塞诊断和可生成预览文档，防止无预览的输出进入确认导入流程。

## 验证

- `PATH="/Users/changzechuan/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH" node node_modules/.bin/vp test run src/features/hyperframes-runtime/bridges/skills-bridge/skillOutputImportPreview.test.ts`
- `PATH="/Users/changzechuan/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH" node node_modules/.bin/vp check --fix src/features/hyperframes-runtime/bridges/skills-bridge/skillOutputImportPreview.ts src/features/hyperframes-runtime/bridges/skills-bridge/skillOutputImportPreview.test.ts src/features/hyperframes-runtime/bridges/skills-bridge/index.ts src/features/hyperframes-runtime/index.ts`
- `PATH="/Users/changzechuan/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH" node node_modules/.bin/vp test run src/features/hyperframes-runtime/provenance/skills-resource-mirror.test.ts src/features/hyperframes-runtime/provenance/manifest.test.ts src/features/hyperframes-runtime/bridges/skills-bridge/skillDirectoryParser.test.ts src/features/hyperframes-runtime/bridges/skills-bridge/skillRecommender.test.ts src/features/hyperframes-runtime/bridges/skills-bridge/generationPlan.test.ts src/features/hyperframes-runtime/bridges/skills-bridge/skillJobQueue.test.ts src/features/hyperframes-runtime/bridges/skills-bridge/browserSkillExecutor.test.ts src/features/hyperframes-runtime/bridges/skills-bridge/localServiceSkillExecutor.test.ts src/features/hyperframes-runtime/bridges/skills-bridge/skillOutputImportPreview.test.ts`
- `PATH="/Users/changzechuan/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH" node node_modules/.bin/vp test run src/shared/projects/migrations/sanitize-text-motion.test.ts src/shared/projects/migrations/index.test.ts src/types/hyperframes.test.ts src/types/timeline-hyperframes.test.ts src/features/hyperframes-runtime/provenance/skills-resource-mirror.test.ts src/features/hyperframes-runtime/provenance/manifest.test.ts src/features/hyperframes-runtime/bridges/player-bridge/useFreeCutTimelineClock.test.tsx src/features/hyperframes-runtime/bridges/player-bridge/HyperFramesPlayerHost.test.tsx src/features/hyperframes-runtime/bridges/player-bridge/runtimeMessageProtocol.test.ts src/features/hyperframes-runtime/bridges/skills-bridge/skillDirectoryParser.test.ts src/features/hyperframes-runtime/bridges/skills-bridge/skillRecommender.test.ts src/features/hyperframes-runtime/bridges/skills-bridge/generationPlan.test.ts src/features/hyperframes-runtime/bridges/skills-bridge/skillJobQueue.test.ts src/features/hyperframes-runtime/bridges/skills-bridge/browserSkillExecutor.test.ts src/features/hyperframes-runtime/bridges/skills-bridge/localServiceSkillExecutor.test.ts src/features/hyperframes-runtime/bridges/skills-bridge/skillOutputImportPreview.test.ts src/features/preview/components/hyperframes-preview-overlay.test.tsx src/features/hyperframes-runtime/model-center/credentialCostBudget.test.ts src/features/hyperframes-runtime/model-center/modelCenterStore.test.ts src/features/hyperframes-runtime/model-center/modelRegistry.test.ts src/features/hyperframes-runtime/adapters/freecut-project/lint-adapter.test.ts src/features/hyperframes-runtime/adapters/freecut-project/parser-adapter.test.ts src/features/hyperframes-runtime/adapters/freecut-project/compiler-adapter.test.ts src/features/hyperframes-runtime/adapters/freecut-project/project-signatures.test.ts src/features/hyperframes-runtime/adapters/freecut-project/project-directory-bundle.test.ts src/features/hyperframes-runtime/adapters/freecut-project/runtime-adapter.test.ts src/features/hyperframes-runtime/adapters/freecut-project/file-system-project-repository.test.ts src/features/hyperframes-runtime/adapters/freecut-project/project-path-guards.test.ts src/features/hyperframes-runtime/adapters/freecut-project/project-repository.test.ts src/features/hyperframes-runtime/model-center/ModelCapabilityCenter.test.tsx src/features/hyperframes-runtime/model-center/providers/openAICompatibleProvider.test.ts src/features/hyperframes-runtime/model-center/providers/privateGatewayProvider.test.ts src/features/hyperframes-runtime/model-center/providers/localModelProvider.test.ts src/features/hyperframes-runtime/adapters/freecut-preview/preview-document.test.ts src/features/hyperframes-runtime/upstream/core/freecut-runtime-mirror.test.ts src/features/hyperframes-runtime/upstream/lint/freecut-runtime-mirror.test.ts src/features/hyperframes-runtime/bridges/studio-bridge/createFreeCutStudioRouteAdapter.test.ts src/features/hyperframes-runtime/bridges/studio-bridge/FreeCutStudioShell.test.tsx src/features/hyperframes-runtime/bridges/studio-bridge/createFreeCutStudioAdapter.test.ts src/features/hyperframes-runtime/bridges/studio-bridge/studioThemeAdapter.test.ts src/features/hyperframes-runtime/bridges/studio-bridge/studioFilePatchWorkflow.test.ts src/features/hyperframes-runtime/upstream/player/freecut-runtime-mirror.test.ts src/features/hyperframes-runtime/upstream/studio/freecut-runtime-mirror.test.tsx src/features/hyperframes-runtime/upstream/core/compiler/freecut-runtime-mirror.test.ts src/features/hyperframes-runtime/upstream/studio/components/editor/studioAdvancedEditing.test.tsx src/features/hyperframes-runtime/upstream/studio-server/helpers/freecut-runtime-mirror.test.ts src/features/hyperframes-runtime/upstream/parsers/freecut-runtime-mirror.test.ts src/features/timeline/components/timeline-item/use-timeline-item-pointer-handlers.test.tsx`
- `PATH="/Users/changzechuan/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH" node scripts/check-hyperframes-runtime-imports.mjs`
- `git diff --check`
- `PATH="/Users/changzechuan/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH" node node_modules/.bin/vp check --no-fmt`
- `PATH="/Users/changzechuan/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH" node node_modules/.bin/vp build`

## 备注

- T049 目标测试通过：1 个测试文件、4 个测试通过。
- T042-T049 组合测试通过：9 个测试文件、36 个测试通过。
- HyperFrames 相关回归通过：48 个测试文件、209 个测试通过。
- `check-hyperframes-runtime-imports` 确认没有直接 `@hyperframes/*` import。
- `git diff --check` 通过。
- `vp check --no-fmt` 通过，仍有 44 个既有 warning，主要来自 `.codex/skills/translate-app-locales/scripts/check-locale-coverage.mjs`、`headless/*.mjs` 的 `console.log` 和 `src/features/keyframes/components/dopesheet-editor/dopesheet-timeline-cells.tsx:35` 的 `react(only-export-components)`。
- `vp build` 通过；构建日志只有既有 dynamic import、chunk size 和 plugin timing 警告。
