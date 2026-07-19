# T034 实现 Studio 自然语言 patch 流程

## 任务

实现 Studio 自然语言 patch 流程，交付 selection snapshot、patch proposal、diff、lint、确认和 undo journal。验收重点是：确认前不写文件；确认后可以回滚。

## 完成内容

- 扩展 `FreeCutStudioAdapter`：
  - 新增 `restoreSnapshot(projectId, snapshotId)`，把 Studio 侧回滚能力接到 HyperFrames project repository 的 snapshot 恢复接口。
- 新增 `studioFilePatchWorkflow`：
  - `captureStudioSelectionSnapshot()` 解析当前选区、目标源码文件、mutation target、内容 hash 和上下文 snippet。
  - `prepareStudioFilePatch()` 只读取文件并生成候选内容，不写入项目文件。
  - `createStudioFileDiff()` 生成确认前 diff，包含 before/after hash 和单 hunk 文本差异。
  - `confirmStudioFilePatch()` 要求显式 `confirmedByUser: true`，确认后先创建 snapshot，再写入源码，并记录 `lastModelMutation`。
  - `rollbackStudioFilePatch()` 通过 undo journal 中的 snapshot 恢复确认前状态。
- 接入源码 patch 和 lint：
  - patch 复用已迁入的 `sourceMutation`，保持 DOM 级修改走源码级 mutation。
  - 预览阶段运行迁入的 `lintHyperframeHtml()`。
  - blocking lint、stale hash、未命中目标和 no-op patch 都会阻止确认。
- 补充测试：
  - 覆盖确认前不调用 `writeFile()`。
  - 覆盖缺少显式确认时拒绝写入。
  - 覆盖确认后写入源码、记录 manifest `lastModelMutation`。
  - 覆盖 undo journal 回滚到原始源码。
  - 覆盖 unsafe path 和 stale proposal 在确认前被拒绝。
- 执行测试导入清理：
  - 将 `src/**/*.test.*` 中遗留的 `vitest` import 统一切换为 `vite-plus/test`。
  - 这是为了让全量 `vp check --no-fmt` 在当前 runtime 下通过；没有改动测试行为。

## 关键决策

- 自然语言 patch 被建模为“模型提案 + 用户确认 + 可回滚写入”，而不是模型直接写入源码。
- `baseContentHash` 是 stale proposal 防线；只要源文件在提案后变化，就禁止确认。
- undo journal 只保存 snapshot id、hash、proposal id 和模型用量摘要，不把 API key 或完整 prompt 作为敏感原文持久化。
- 路径统一走 `normalizeHyperFramesProjectPath()`，任何 `../` 逃逸都会在 preview 阶段阻断。
- lint 在确认前运行；确认后再次通过 adapter lint 取回最终诊断，保证写入后状态可审计。

## 验证

- `PATH="/Users/changzechuan/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH" node node_modules/.bin/vp check --fix src/features/hyperframes-runtime/bridges/studio-bridge src/features/hyperframes-runtime/index.ts`
- `PATH="/Users/changzechuan/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH" node node_modules/.bin/vp test run src/features/hyperframes-runtime/bridges/studio-bridge/studioFilePatchWorkflow.test.ts src/features/hyperframes-runtime/bridges/studio-bridge/createFreeCutStudioAdapter.test.ts`
- `PATH="/Users/changzechuan/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH" node node_modules/.bin/vp test run src/features/hyperframes-runtime/bridges/studio-bridge/studioFilePatchWorkflow.test.ts src/features/hyperframes-runtime/bridges/studio-bridge/createFreeCutStudioAdapter.test.ts src/features/hyperframes-runtime/bridges/studio-bridge/createFreeCutStudioRouteAdapter.test.ts src/features/hyperframes-runtime/bridges/studio-bridge/FreeCutStudioShell.test.tsx src/features/hyperframes-runtime/bridges/studio-bridge/studioThemeAdapter.test.ts`
- `PATH="/Users/changzechuan/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH" node node_modules/.bin/vp test run $(rg --files src/features/hyperframes-runtime src/features/preview src/types src/shared/projects/migrations | rg '(hyperframes|HyperFrames|timeline-hyperframes|studio|project|parser|preview-overlay|migrations).*[.]test[.](ts|tsx)$') src/features/timeline/components/timeline-item/use-timeline-item-pointer-handlers.test.tsx`
- `node scripts/check-hyperframes-runtime-imports.mjs`
- `git diff --check`
- `PATH="/Users/changzechuan/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH" node node_modules/.bin/vp check --no-fmt`
- `PATH="/Users/changzechuan/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH" node node_modules/.bin/vp build`

## 备注

- T034 核心测试通过：2 个测试文件、4 个测试通过。
- Studio bridge 回归通过：5 个测试文件、11 个测试通过。
- HyperFrames 相关回归通过：33 个测试文件、151 个测试通过。
- `check-hyperframes-runtime-imports` 确认没有直接 `@hyperframes/*` import。
- `vp check --no-fmt` 通过，仍有 44 个既有 warning，主要来自 `.codex/skills/translate-app-locales/scripts/check-locale-coverage.mjs`、`headless/*.mjs` 的 `console.log` 和 `src/features/keyframes/components/dopesheet-editor/dopesheet-timeline-cells.tsx:35` 的 `react(only-export-components)`。
- `vp build` 通过；构建日志只有既有 dynamic import、chunk size 和 plugin timing 警告。
