# T019 迁移 core compiler 子集

## 任务

迁移 HyperFrames core compiler 子集，覆盖 HTML bundler、子组合、资产路径和 timing compiler，为 FreeCut 后续预览与导出管线提供项目目录到预览 HTML 的源码级能力。

## 完成内容

- 使用 `sync-hyperframes-upstream --include` 同步 core compiler 相关源码。
- 新增源码镜像：
  - `src/features/hyperframes-runtime/upstream/core/compiler/*`
  - `src/features/hyperframes-runtime/upstream/core/runtime/flattenedRoot.ts`
  - `src/features/hyperframes-runtime/upstream/core/generated/runtime-inline.ts`
  - `src/features/hyperframes-runtime/upstream/core/utils/cssSelector.ts`
- 将 compiler 中的直接上游包引用改写到本地 mirror：
  - `@hyperframes/parsers/asset-paths` -> `../../parsers/assetPaths.js` 或 `../../parsers/rewriteSubCompPaths.js`
  - `@hyperframes/parsers/sub-composition-validity` -> `../../parsers/subCompositionValidity.js`
  - `@hyperframes/lint` -> `../../lint/browser.js`
- 新增 `compiler-adapter.ts`。
- `compiler-adapter` 从 `HyperFramesProjectDirectory` 读取活动组合，执行：
  - `compileTimingAttrs`
  - manifest asset duration 注入
  - `inlineSubCompositions`
  - 子组合样式和脚本注入
  - T018 runtime 注入计划
  - 缺失活动组合和缺失子组合诊断
- 从 `adapters/freecut-project/index.ts` 和运行时根入口导出 compiler adapter API。
- 新增 `compiler/freecut-runtime-mirror.test.ts` 和 `compiler-adapter.test.ts`。
- 更新 `provenance/upstream-sync-state.json` 和 `provenance/patch-notes.md`。

## 关键决策

- `htmlBundler.ts` 作为源码镜像保留并可编译，但 FreeCut 浏览器 adapter 不直接导入它，避免 Node/FS/esbuild 路径进入主 bundle。
- 第一版 FreeCut 预览 HTML 编译走内存项目目录 adapter，满足项目目录、子组合、资产路径和 timing compiler 的 P2 验收。
- `inlineSubCompositions` 的上游 `document` 参数当前未使用，但保留 API 形状；本地用 `void document` 满足 FreeCut 严格 noUnused。
- 完整本地服务 bundling、Producer 编译和 runtime URL 策略留给后续 T020、render bridge 和 producer-node 任务。

## 验证

- `PATH="/Users/changzechuan/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH" node node_modules/.bin/vp test run src/features/hyperframes-runtime/upstream/core/compiler/freecut-runtime-mirror.test.ts src/features/hyperframes-runtime/adapters/freecut-project/compiler-adapter.test.ts`
- `PATH="/Users/changzechuan/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH" node scripts/check-hyperframes-runtime-imports.mjs`
- `git diff --check`
- `PATH="/Users/changzechuan/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH" node node_modules/.bin/vp check --no-fmt src vite.config.ts`
- `PATH="/Users/changzechuan/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH" node node_modules/.bin/vp test run src/features/hyperframes-runtime/upstream/parsers/freecut-runtime-mirror.test.ts src/features/hyperframes-runtime/upstream/lint/freecut-runtime-mirror.test.ts src/features/hyperframes-runtime/upstream/core/freecut-runtime-mirror.test.ts src/features/hyperframes-runtime/upstream/core/compiler/freecut-runtime-mirror.test.ts src/features/hyperframes-runtime/adapters/freecut-project/parser-adapter.test.ts src/features/hyperframes-runtime/adapters/freecut-project/lint-adapter.test.ts src/features/hyperframes-runtime/adapters/freecut-project/runtime-adapter.test.ts src/features/hyperframes-runtime/adapters/freecut-project/compiler-adapter.test.ts`
- `PATH="/Users/changzechuan/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH" node node_modules/.bin/vp build`

## 备注

- T019 窄测试结果：2 个测试文件、6 个测试通过。
- T014-T019 联合测试结果：8 个测试文件、31 个测试通过。
- `check-hyperframes-runtime-imports` 确认没有直接 `@hyperframes/*` import。
- `vp check` 仍有既有 `react(only-export-components)` 警告，位置为 `src/features/keyframes/components/dopesheet-editor/dopesheet-timeline-cells.tsx:35`，本任务未修改该文件。
- `vp build` 通过；仍有既有动态导入、chunk 大小和插件耗时 warning。
