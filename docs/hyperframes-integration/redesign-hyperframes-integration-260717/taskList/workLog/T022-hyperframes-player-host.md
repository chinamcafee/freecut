# T022 实现 `HyperFramesPlayerHost`

## 任务

实现 FreeCut 侧 player bridge，用 `HyperFramesPlayerHost` 封装迁移后的 `hyperframes-player` Web Component，并把 srcdoc 加载、播放控制、iframe 解析和事件映射收敛到桥接层。

## 完成内容

- 新增 `src/features/hyperframes-runtime/bridges/player-bridge/HyperFramesPlayerHost.tsx`。
- 新增 `HyperFramesPlayerHostHandle` imperative API：
  - `load`
  - `seek`
  - `seekFrame`
  - `play`
  - `pause`
  - `dispose`
  - `getCurrentTime`
  - `getDuration`
  - `getPlayerElement`
  - `resolveIframe`
- 新增 `resolveHyperFramesIframe`，优先使用上游 Web Component 暴露的 `iframeElement`，并支持 shadow DOM fallback。
- 新增 `mapPlayerErrorToDiagnostic`，将 player `error` 事件映射为 FreeCut `HyperFramesDiagnostic`。
- 新增 `bridges/player-bridge/index.ts`，导出 player bridge、诊断、iframe helper，并复用 T020 preview document API。
- 更新 `bridges/README.md`，明确 FreeCut UI 应通过 bridge 使用迁移能力。
- 新增 `HyperFramesPlayerHost.test.tsx`，覆盖：
  - preview `srcdoc` 加载。
  - controls/muted/volume/playbackRate 属性同步。
  - imperative load/seek/seekFrame/play/pause。
  - ready/timeupdate/selection/error 事件映射。
  - iframe helper 和诊断 helper。

## 关键决策

- T022 不直接接入 editor 主预览器；中央预览器接入留给 T025。
- `HyperFramesPlayerHost` 显式 side-effect import 上游 `hyperframes-player.js`，确保 custom element 注册不会被类型擦除。
- `createPreviewDocument` 继续保留在 FreeCut adapter 层，并从 player bridge 入口 re-export，避免重新实现安全注入逻辑。
- 播放头自动同步只做 `currentFrame / fps` 的简单 seek；完整 FreeCut 时间线时钟 hook 留给 T023。

## 验证

- `PATH="/Users/changzechuan/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH" node node_modules/.bin/vp test run src/features/hyperframes-runtime/bridges/player-bridge/HyperFramesPlayerHost.test.tsx`
- `PATH="/Users/changzechuan/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH" node node_modules/.bin/vp test run src/features/hyperframes-runtime/upstream/player/freecut-runtime-mirror.test.ts src/features/hyperframes-runtime/bridges/player-bridge/HyperFramesPlayerHost.test.tsx src/features/hyperframes-runtime/adapters/freecut-preview/preview-document.test.ts`
- `PATH="/Users/changzechuan/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH" node node_modules/.bin/vp test run src/features/hyperframes-runtime/upstream/parsers/freecut-runtime-mirror.test.ts src/features/hyperframes-runtime/upstream/lint/freecut-runtime-mirror.test.ts src/features/hyperframes-runtime/upstream/core/freecut-runtime-mirror.test.ts src/features/hyperframes-runtime/upstream/core/compiler/freecut-runtime-mirror.test.ts src/features/hyperframes-runtime/upstream/player/freecut-runtime-mirror.test.ts src/features/hyperframes-runtime/adapters/freecut-project/parser-adapter.test.ts src/features/hyperframes-runtime/adapters/freecut-project/lint-adapter.test.ts src/features/hyperframes-runtime/adapters/freecut-project/runtime-adapter.test.ts src/features/hyperframes-runtime/adapters/freecut-project/compiler-adapter.test.ts src/features/hyperframes-runtime/adapters/freecut-preview/preview-document.test.ts src/features/hyperframes-runtime/bridges/player-bridge/HyperFramesPlayerHost.test.tsx`
- `PATH="/Users/changzechuan/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH" node scripts/check-hyperframes-runtime-imports.mjs`
- `git diff --check`
- `PATH="/Users/changzechuan/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH" node node_modules/.bin/vp check --no-fmt src vite.config.ts`
- `PATH="/Users/changzechuan/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH" node node_modules/.bin/vp build`

## 备注

- T022 窄测试结果：1 个测试文件、4 个测试通过。
- T022 相关组合测试结果：3 个测试文件、14 个测试通过。
- T014-T022 联合测试结果：11 个测试文件、46 个测试通过。
- `check-hyperframes-runtime-imports` 确认没有直接 `@hyperframes/*` import。
- `vp check` 仍有既有 `react(only-export-components)` 警告，位置为 `src/features/keyframes/components/dopesheet-editor/dopesheet-timeline-cells.tsx:35`，本任务未修改该文件。
- `vp build` 通过；仍有既有动态导入、chunk 大小和插件耗时 warning。
