# T048 实现本地服务执行器

## 任务

实现本地服务执行器，交付文件系统、Chrome、FFmpeg、转写、截图能力。验收重点是：脚本权限声明、运行时间限制、可取消。

## 完成内容

- 新增 `src/features/hyperframes-runtime/bridges/skills-bridge/localServiceSkillExecutor.ts`：
  - 定义 `LocalServiceSkillExecutor`、`LocalServiceSkillRuntime`、`LocalServiceScriptPermission`、`LocalServiceCapability`。
  - 定义本地能力：`filesystem`、`chrome`、`ffmpeg`、`transcription`、`screenshot`、`render-runtime`、`node`、`python`、`network`。
  - 实现 `inferLocalServiceCapabilities()`，从 `GenerationPlan` 的工具权限、模型能力和 render runtime 要求推导本地能力。
  - 实现 `createLocalServiceScriptPermissions()`，为每个能力生成脚本权限声明。
  - 每条权限声明包含 inputDirectories、outputDirectory、allowNetwork、maxRuntimeMs、cancellable 和 reason。
  - 实现 `checkPlan()`，确保权限声明可取消且有运行时上限。
  - 实现 `executeJob()`，只接受 `running` 状态的任务。
  - 执行前调用注入的 `LocalServiceSkillRuntime.checkRuntime()` 做本地运行时 preflight。
  - 通过注入的 `LocalServiceSkillRuntime.runSkill()` 执行实际本地服务任务。
  - 支持外部 `AbortSignal` 取消，并调用 `runtime.cancelJob(jobId, 'canceled')`。
  - 支持 `maxRuntimeMs` 超时，并调用 `runtime.cancelJob(jobId, 'timeout')`。
  - 返回统一 `HyperFramesSkillOutputBundle`，并追加本地服务执行日志。
- 新增导出：
  - `src/features/hyperframes-runtime/bridges/skills-bridge/index.ts`
  - `src/features/hyperframes-runtime/index.ts`
- 新增 `src/features/hyperframes-runtime/bridges/skills-bridge/localServiceSkillExecutor.test.ts`：
  - 验证文件系统、Chrome、FFmpeg、转写、截图、render runtime 能力推导。
  - 验证脚本权限声明包含输入目录、输出目录、最大运行时间和可取消能力。
  - 验证本地 runtime preflight 和执行请求携带权限声明。
  - 验证本地能力缺失时失败且不执行任务。
  - 验证超时会触发 runtime cancel。
  - 验证用户取消会触发 runtime cancel。

## 关键决策

- T048 不直接启动真实 Chrome、FFmpeg 或本地服务进程，而是定义 FreeCut 到本地服务的执行合同和门禁。真实服务接入、producer 迁移和渲染管线继续由后续任务承接。
- 上游 `skills/*/scripts` 仍不会被 UI 直接调用；本地服务执行器只接收已经迁移/声明过权限的 runtime。
- 每次本地执行都必须先生成权限声明，并把最大运行时间和可取消能力传入 runtime。
- 超时和用户取消都走统一 `cancelJob()` 入口，便于后续写入 FreeCut render job store 或任务日志。

## 验证

- `PATH="/Users/changzechuan/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH" node node_modules/.bin/vp check --fix src/features/hyperframes-runtime/bridges/skills-bridge/localServiceSkillExecutor.ts src/features/hyperframes-runtime/bridges/skills-bridge/localServiceSkillExecutor.test.ts src/features/hyperframes-runtime/bridges/skills-bridge/index.ts src/features/hyperframes-runtime/index.ts`
- `PATH="/Users/changzechuan/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH" node node_modules/.bin/vp test run src/features/hyperframes-runtime/bridges/skills-bridge/localServiceSkillExecutor.test.ts`
- `PATH="/Users/changzechuan/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH" node node_modules/.bin/vp test run src/features/hyperframes-runtime/provenance/skills-resource-mirror.test.ts src/features/hyperframes-runtime/provenance/manifest.test.ts src/features/hyperframes-runtime/bridges/skills-bridge/skillDirectoryParser.test.ts src/features/hyperframes-runtime/bridges/skills-bridge/skillRecommender.test.ts src/features/hyperframes-runtime/bridges/skills-bridge/generationPlan.test.ts src/features/hyperframes-runtime/bridges/skills-bridge/skillJobQueue.test.ts src/features/hyperframes-runtime/bridges/skills-bridge/browserSkillExecutor.test.ts src/features/hyperframes-runtime/bridges/skills-bridge/localServiceSkillExecutor.test.ts`
- `PATH="/Users/changzechuan/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH" node node_modules/.bin/vp test run src/shared/projects/migrations/sanitize-text-motion.test.ts src/shared/projects/migrations/index.test.ts src/types/hyperframes.test.ts src/types/timeline-hyperframes.test.ts src/features/hyperframes-runtime/provenance/skills-resource-mirror.test.ts src/features/hyperframes-runtime/provenance/manifest.test.ts src/features/hyperframes-runtime/bridges/player-bridge/useFreeCutTimelineClock.test.tsx src/features/hyperframes-runtime/bridges/player-bridge/HyperFramesPlayerHost.test.tsx src/features/hyperframes-runtime/bridges/player-bridge/runtimeMessageProtocol.test.ts src/features/hyperframes-runtime/bridges/skills-bridge/skillDirectoryParser.test.ts src/features/hyperframes-runtime/bridges/skills-bridge/skillRecommender.test.ts src/features/hyperframes-runtime/bridges/skills-bridge/generationPlan.test.ts src/features/hyperframes-runtime/bridges/skills-bridge/skillJobQueue.test.ts src/features/hyperframes-runtime/bridges/skills-bridge/browserSkillExecutor.test.ts src/features/hyperframes-runtime/bridges/skills-bridge/localServiceSkillExecutor.test.ts src/features/preview/components/hyperframes-preview-overlay.test.tsx src/features/hyperframes-runtime/model-center/credentialCostBudget.test.ts src/features/hyperframes-runtime/model-center/modelCenterStore.test.ts src/features/hyperframes-runtime/model-center/modelRegistry.test.ts src/features/hyperframes-runtime/adapters/freecut-project/lint-adapter.test.ts src/features/hyperframes-runtime/adapters/freecut-project/parser-adapter.test.ts src/features/hyperframes-runtime/adapters/freecut-project/compiler-adapter.test.ts src/features/hyperframes-runtime/adapters/freecut-project/project-signatures.test.ts src/features/hyperframes-runtime/adapters/freecut-project/project-directory-bundle.test.ts src/features/hyperframes-runtime/adapters/freecut-project/runtime-adapter.test.ts src/features/hyperframes-runtime/adapters/freecut-project/file-system-project-repository.test.ts src/features/hyperframes-runtime/adapters/freecut-project/project-path-guards.test.ts src/features/hyperframes-runtime/adapters/freecut-project/project-repository.test.ts src/features/hyperframes-runtime/model-center/ModelCapabilityCenter.test.tsx src/features/hyperframes-runtime/model-center/providers/openAICompatibleProvider.test.ts src/features/hyperframes-runtime/model-center/providers/privateGatewayProvider.test.ts src/features/hyperframes-runtime/model-center/providers/localModelProvider.test.ts src/features/hyperframes-runtime/adapters/freecut-preview/preview-document.test.ts src/features/hyperframes-runtime/upstream/core/freecut-runtime-mirror.test.ts src/features/hyperframes-runtime/upstream/lint/freecut-runtime-mirror.test.ts src/features/hyperframes-runtime/bridges/studio-bridge/createFreeCutStudioRouteAdapter.test.ts src/features/hyperframes-runtime/bridges/studio-bridge/FreeCutStudioShell.test.tsx src/features/hyperframes-runtime/bridges/studio-bridge/createFreeCutStudioAdapter.test.ts src/features/hyperframes-runtime/bridges/studio-bridge/studioThemeAdapter.test.ts src/features/hyperframes-runtime/bridges/studio-bridge/studioFilePatchWorkflow.test.ts src/features/hyperframes-runtime/upstream/player/freecut-runtime-mirror.test.ts src/features/hyperframes-runtime/upstream/studio/freecut-runtime-mirror.test.tsx src/features/hyperframes-runtime/upstream/core/compiler/freecut-runtime-mirror.test.ts src/features/hyperframes-runtime/upstream/studio/components/editor/studioAdvancedEditing.test.tsx src/features/hyperframes-runtime/upstream/studio-server/helpers/freecut-runtime-mirror.test.ts src/features/hyperframes-runtime/upstream/parsers/freecut-runtime-mirror.test.ts src/features/timeline/components/timeline-item/use-timeline-item-pointer-handlers.test.tsx`
- `PATH="/Users/changzechuan/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH" node scripts/check-hyperframes-runtime-imports.mjs`
- `git diff --check`
- `PATH="/Users/changzechuan/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH" node node_modules/.bin/vp check --no-fmt`
- `PATH="/Users/changzechuan/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH" node node_modules/.bin/vp build`

## 备注

- T048 目标测试通过：1 个测试文件、5 个测试通过。
- T042-T048 组合测试通过：8 个测试文件、32 个测试通过。
- HyperFrames 相关回归通过：47 个测试文件、205 个测试通过。
- `check-hyperframes-runtime-imports` 确认没有直接 `@hyperframes/*` import。
- `git diff --check` 通过。
- `vp check --no-fmt` 通过，仍有 44 个既有 warning，主要来自 `.codex/skills/translate-app-locales/scripts/check-locale-coverage.mjs`、`headless/*.mjs` 的 `console.log` 和 `src/features/keyframes/components/dopesheet-editor/dopesheet-timeline-cells.tsx:35` 的 `react(only-export-components)`。
- `vp build` 通过；构建日志只有既有 dynamic import、chunk size 和 plugin timing 警告。
