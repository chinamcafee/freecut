# T050 实现确认、回滚和失败修复

## 任务

实现确认、回滚和失败修复，交付同模型修复、切换模型修复、打开工作室修复。验收重点是：确认前不污染项目；确认后可撤销。

## 完成内容

- 新增 `src/features/hyperframes-runtime/bridges/skills-bridge/skillImportConfirmation.ts`：
  - 定义 `HyperFramesSkillImportConfirmation`、`HyperFramesSkillImportRollbackJournal`、导入变更记录和修复动作类型。
  - 实现 `confirmHyperFramesSkillImport()`，要求 `confirmedByUser: true`，且导入预览无阻塞诊断后才写入。
  - 确认时把技能输出项目目录写入 `HyperFramesProjectRepository`，并把 manifest 标记为 `confirmedByUser`。
  - 写入 FreeCut 项目副本，新增 `Project.hyperframes.projects`、`compositionLinks` 和源链接时间线项。
  - `source-link-with-approximations` 策略会从 `data-hf-item` 节点生成可识别的 FreeCut 原生近似项，权威源仍是 HyperFrames 项目目录。
  - 确认时生成 rollback journal，保存确认前 FreeCut project 快照和项目目录 snapshot 信息。
  - 实现 `rollbackHyperFramesSkillImport()`，可恢复 FreeCut project 快照，并按导入前状态恢复或删除 HyperFrames 项目目录。
  - 实现 `createHyperFramesSkillRepairOptions()`，提供同模型修复、切换模型修复、打开工作室手动修复三种动作。
- 扩展 `HyperFramesProjectRepository`：
  - 新增 `deleteProject(projectId)`，用于回滚本次新增的项目目录。
  - `InMemoryHyperFramesProjectRepository` 和 `FileSystemHyperFramesProjectRepository` 均实现删除能力。
- 新增/更新测试：
  - `src/features/hyperframes-runtime/bridges/skills-bridge/skillImportConfirmation.test.ts`
  - `src/features/hyperframes-runtime/adapters/freecut-project/project-repository.test.ts`
  - `src/features/hyperframes-runtime/adapters/freecut-project/file-system-project-repository.test.ts`
- 新增导出：
  - `src/features/hyperframes-runtime/bridges/skills-bridge/index.ts`
  - `src/features/hyperframes-runtime/index.ts`

## 关键决策

- 确认函数不原地修改传入的 FreeCut project；它返回带变更的新 project。调用方在用户确认后再持久化，保证确认前不污染项目。
- 新导入项目目录的回滚走 `deleteProject()`；覆盖已有项目目录时先创建 repository snapshot，回滚时恢复 snapshot。
- 失败修复动作只描述可执行选项，不直接调用模型、不直接打开 Studio、不直接写文件。后续 UI 可以根据动作触发同模型重试、模型切换或 Studio 打开流程。
- 近似项只是用户可编辑的辅助层，`compositionLinks` 和源链接组合仍记录权威 HyperFrames 源目录。

## 验证

- `PATH="/Users/changzechuan/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH" node node_modules/.bin/vp check --fix src/features/hyperframes-runtime/bridges/skills-bridge/skillImportConfirmation.ts src/features/hyperframes-runtime/bridges/skills-bridge/skillImportConfirmation.test.ts src/features/hyperframes-runtime/bridges/skills-bridge/index.ts src/features/hyperframes-runtime/index.ts src/features/hyperframes-runtime/adapters/freecut-project/project-repository.ts src/features/hyperframes-runtime/adapters/freecut-project/project-repository.test.ts src/features/hyperframes-runtime/adapters/freecut-project/file-system-project-repository.ts src/features/hyperframes-runtime/adapters/freecut-project/file-system-project-repository.test.ts`
- `PATH="/Users/changzechuan/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH" node node_modules/.bin/vp test run src/features/hyperframes-runtime/bridges/skills-bridge/skillImportConfirmation.test.ts src/features/hyperframes-runtime/adapters/freecut-project/project-repository.test.ts src/features/hyperframes-runtime/adapters/freecut-project/file-system-project-repository.test.ts`
- `PATH="/Users/changzechuan/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH" node node_modules/.bin/vp test run src/features/hyperframes-runtime/provenance/skills-resource-mirror.test.ts src/features/hyperframes-runtime/provenance/manifest.test.ts src/features/hyperframes-runtime/bridges/skills-bridge/skillDirectoryParser.test.ts src/features/hyperframes-runtime/bridges/skills-bridge/skillRecommender.test.ts src/features/hyperframes-runtime/bridges/skills-bridge/generationPlan.test.ts src/features/hyperframes-runtime/bridges/skills-bridge/skillJobQueue.test.ts src/features/hyperframes-runtime/bridges/skills-bridge/browserSkillExecutor.test.ts src/features/hyperframes-runtime/bridges/skills-bridge/localServiceSkillExecutor.test.ts src/features/hyperframes-runtime/bridges/skills-bridge/skillOutputImportPreview.test.ts src/features/hyperframes-runtime/bridges/skills-bridge/skillImportConfirmation.test.ts src/features/hyperframes-runtime/adapters/freecut-project/project-repository.test.ts src/features/hyperframes-runtime/adapters/freecut-project/file-system-project-repository.test.ts`
- `PATH="/Users/changzechuan/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH" node node_modules/.bin/vp test run src/shared/projects/migrations/sanitize-text-motion.test.ts src/shared/projects/migrations/index.test.ts src/types/hyperframes.test.ts src/types/timeline-hyperframes.test.ts src/features/hyperframes-runtime/provenance/skills-resource-mirror.test.ts src/features/hyperframes-runtime/provenance/manifest.test.ts src/features/hyperframes-runtime/bridges/player-bridge/useFreeCutTimelineClock.test.tsx src/features/hyperframes-runtime/bridges/player-bridge/HyperFramesPlayerHost.test.tsx src/features/hyperframes-runtime/bridges/player-bridge/runtimeMessageProtocol.test.ts src/features/hyperframes-runtime/bridges/skills-bridge/skillDirectoryParser.test.ts src/features/hyperframes-runtime/bridges/skills-bridge/skillRecommender.test.ts src/features/hyperframes-runtime/bridges/skills-bridge/generationPlan.test.ts src/features/hyperframes-runtime/bridges/skills-bridge/skillJobQueue.test.ts src/features/hyperframes-runtime/bridges/skills-bridge/browserSkillExecutor.test.ts src/features/hyperframes-runtime/bridges/skills-bridge/localServiceSkillExecutor.test.ts src/features/hyperframes-runtime/bridges/skills-bridge/skillOutputImportPreview.test.ts src/features/hyperframes-runtime/bridges/skills-bridge/skillImportConfirmation.test.ts src/features/preview/components/hyperframes-preview-overlay.test.tsx src/features/hyperframes-runtime/model-center/credentialCostBudget.test.ts src/features/hyperframes-runtime/model-center/modelCenterStore.test.ts src/features/hyperframes-runtime/model-center/modelRegistry.test.ts src/features/hyperframes-runtime/adapters/freecut-project/lint-adapter.test.ts src/features/hyperframes-runtime/adapters/freecut-project/parser-adapter.test.ts src/features/hyperframes-runtime/adapters/freecut-project/compiler-adapter.test.ts src/features/hyperframes-runtime/adapters/freecut-project/project-signatures.test.ts src/features/hyperframes-runtime/adapters/freecut-project/project-directory-bundle.test.ts src/features/hyperframes-runtime/adapters/freecut-project/runtime-adapter.test.ts src/features/hyperframes-runtime/adapters/freecut-project/file-system-project-repository.test.ts src/features/hyperframes-runtime/adapters/freecut-project/project-path-guards.test.ts src/features/hyperframes-runtime/adapters/freecut-project/project-repository.test.ts src/features/hyperframes-runtime/model-center/ModelCapabilityCenter.test.tsx src/features/hyperframes-runtime/model-center/providers/openAICompatibleProvider.test.ts src/features/hyperframes-runtime/model-center/providers/privateGatewayProvider.test.ts src/features/hyperframes-runtime/model-center/providers/localModelProvider.test.ts src/features/hyperframes-runtime/adapters/freecut-preview/preview-document.test.ts src/features/hyperframes-runtime/upstream/core/freecut-runtime-mirror.test.ts src/features/hyperframes-runtime/upstream/lint/freecut-runtime-mirror.test.ts src/features/hyperframes-runtime/bridges/studio-bridge/createFreeCutStudioRouteAdapter.test.ts src/features/hyperframes-runtime/bridges/studio-bridge/FreeCutStudioShell.test.tsx src/features/hyperframes-runtime/bridges/studio-bridge/createFreeCutStudioAdapter.test.ts src/features/hyperframes-runtime/bridges/studio-bridge/studioThemeAdapter.test.ts src/features/hyperframes-runtime/bridges/studio-bridge/studioFilePatchWorkflow.test.ts src/features/hyperframes-runtime/upstream/player/freecut-runtime-mirror.test.ts src/features/hyperframes-runtime/upstream/studio/freecut-runtime-mirror.test.tsx src/features/hyperframes-runtime/upstream/core/compiler/freecut-runtime-mirror.test.ts src/features/hyperframes-runtime/upstream/studio/components/editor/studioAdvancedEditing.test.tsx src/features/hyperframes-runtime/upstream/studio-server/helpers/freecut-runtime-mirror.test.ts src/features/hyperframes-runtime/upstream/parsers/freecut-runtime-mirror.test.ts src/features/timeline/components/timeline-item/use-timeline-item-pointer-handlers.test.tsx`
- `PATH="/Users/changzechuan/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH" node scripts/check-hyperframes-runtime-imports.mjs`
- `git diff --check`
- `PATH="/Users/changzechuan/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH" node node_modules/.bin/vp check --no-fmt`
- `PATH="/Users/changzechuan/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH" node node_modules/.bin/vp build`

## 备注

- T050 目标测试通过：3 个测试文件、18 个测试通过。
- T042-T050 组合测试通过：12 个测试文件、54 个测试通过。
- HyperFrames 相关回归通过：49 个测试文件、216 个测试通过。
- `check-hyperframes-runtime-imports` 确认没有直接 `@hyperframes/*` import。
- `git diff --check` 通过。
- `vp check --no-fmt` 通过，仍有 44 个既有 warning，主要来自 `.codex/skills/translate-app-locales/scripts/check-locale-coverage.mjs`、`headless/*.mjs` 的 `console.log` 和 `src/features/keyframes/components/dopesheet-editor/dopesheet-timeline-cells.tsx:35` 的 `react(only-export-components)`。
- `vp build` 通过；构建日志只有既有 dynamic import、chunk size 和 plugin timing 警告。
