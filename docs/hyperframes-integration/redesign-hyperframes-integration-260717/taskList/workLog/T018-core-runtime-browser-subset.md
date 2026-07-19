# T018 迁移 core runtime 浏览器子集

## 任务

迁移 `/Users/changzechuan/VideoAIEditProjects/hyperframes/packages/core/src/runtime` 中适合浏览器主流程使用的 core runtime 子集，并把必要类型和安全工具源码镜像到 FreeCut 专用目录。

## 完成内容

- 扩展 `scripts/sync-hyperframes-upstream.mjs`，新增 repeatable `--include`，支持按上游源码相对路径同步子集。
- 使用 include 白名单同步 20 个 core 文件到 `src/features/hyperframes-runtime/upstream/core`。
- 同步范围覆盖：
  - `runtime/getVariables.ts`、`validateVariables.ts`、`applyVariableBindings.ts`、`variableScope.ts`
  - `runtime/clock.ts`
  - `runtime/media.ts`、`mediaVolumeEnvelope.ts`
  - `runtime/protocol.ts`、`bridge.ts`、`types.ts`、`diagnostics.ts`、`globals.ts`
  - `core.types.ts`、`variables.ts`、`safePath.ts`、`tokenSlug.ts`
  - `inline-scripts/runtimeContract.ts`、`inline-scripts/pickerApi.ts`、`colorGrading.ts`
- 将迁入 core 中的 `@hyperframes/parsers` 和 `@hyperframes/parsers/composition` import/re-export 改写为本地 `upstream/parsers` 源码镜像。
- 新增 `upstream/core/freecut-runtime-mirror.test.ts`，验证变量读取/绑定、变量校验、时钟和媒体同步。
- 新增 `adapters/freecut-project/runtime-adapter.ts`，提供 FreeCut 侧 typed runtime adapter。
- 从 `adapters/freecut-project/index.ts` 和 `src/features/hyperframes-runtime/index.ts` 导出 runtime adapter API。
- 新增 `runtime-adapter.test.ts`，验证 globals 安装、诊断映射、runtime 注入计划和 control bridge。
- 更新 `provenance/upstream-sync-state.json` 和 `provenance/patch-notes.md`。

## 关键决策

- T018 只迁入 core runtime 浏览器子集，不提前迁入 `runtime/init.ts`、`entry.ts` 和高级 runtime adapters。
- `init.ts` 依赖 compiler、Studio helper、text、Player 等后续任务范围，留给 T019/T020/T021 逐步接入。
- runtime 注入先落地为 `createInjectionPlan` / `injectIntoHtml` 的受控计划生成器，完整 CSP/sandbox 和 runtime URL 策略留给 T020。
- `safePath.ts` 作为上游安全工具源码镜像进入 core，但浏览器主 bundle 不直接导入 Node-only 文件。

## 验证

- `PATH="/Users/changzechuan/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH" node node_modules/.bin/vp test run src/features/hyperframes-runtime/upstream/core/freecut-runtime-mirror.test.ts src/features/hyperframes-runtime/adapters/freecut-project/runtime-adapter.test.ts`
- `PATH="/Users/changzechuan/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH" node scripts/check-hyperframes-runtime-imports.mjs`
- `git diff --check`
- `PATH="/Users/changzechuan/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH" node node_modules/.bin/vp check --no-fmt src vite.config.ts`
- `PATH="/Users/changzechuan/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH" node node_modules/.bin/vp test run src/features/hyperframes-runtime/upstream/parsers/freecut-runtime-mirror.test.ts src/features/hyperframes-runtime/upstream/lint/freecut-runtime-mirror.test.ts src/features/hyperframes-runtime/upstream/core/freecut-runtime-mirror.test.ts src/features/hyperframes-runtime/adapters/freecut-project/parser-adapter.test.ts src/features/hyperframes-runtime/adapters/freecut-project/lint-adapter.test.ts src/features/hyperframes-runtime/adapters/freecut-project/runtime-adapter.test.ts`
- `PATH="/Users/changzechuan/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH" node node_modules/.bin/vp build`

## 备注

- T018 窄测试结果：2 个测试文件、8 个测试通过。
- T014-T018 联合测试结果：6 个测试文件、25 个测试通过。
- `check-hyperframes-runtime-imports` 确认没有直接 `@hyperframes/*` import。
- `vp check` 仍有既有 `react(only-export-components)` 警告，位置为 `src/features/keyframes/components/dopesheet-editor/dopesheet-timeline-cells.tsx:35`，本任务未修改该文件。
- `vp build` 通过；仍有既有动态导入、chunk 大小和插件耗时 warning。
