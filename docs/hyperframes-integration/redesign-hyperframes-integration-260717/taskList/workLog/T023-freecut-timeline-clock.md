# T023 实现 FreeCut 播放头到 HyperFrames 时钟同步

## 任务

实现 `useFreeCutTimelineClock`，将 FreeCut 播放状态中的帧、播放/暂停、倍速、静音和音量同步到 `HyperFramesPlayerHost`。

## 完成内容

- 新增 `src/features/hyperframes-runtime/bridges/player-bridge/useFreeCutTimelineClock.ts`。
- 新增帧时间换算工具：
  - `freeCutFrameToHyperFramesSeconds`
  - `hyperFramesSecondsToFreeCutFrame`
- `useFreeCutTimelineClock` 从 `usePlaybackStore` 读取：
  - `currentFrame`
  - `isPlaying`
  - `playbackRate`
  - `muted`
  - `volume`
- 支持外层片段映射参数：
  - `fps`
  - `timelineStartFrame`
  - `sourceOffsetFrame`
  - `enabled`
  - `maxPlayingDriftFrames`
- 扩展 `HyperFramesPlayerHostHandle`：
  - `setPlaybackRate`
  - `setMuted`
  - `setVolume`
- player bridge 入口导出 clock hook 和换算工具。
- 新增 `useFreeCutTimelineClock.test.tsx`，覆盖：
  - FreeCut frame 与 HyperFrames seconds 双向换算。
  - 当前帧 seek。
  - play/pause 同步。
  - playbackRate 同步。
  - muted/volume 同步。
  - 播放状态下 1 帧内 drift 不重复 seek。
  - disabled 状态不触发 player 命令。

## 关键决策

- T023 只做桥接层 hook，不直接接入中央预览器；真正选择 HyperFrames 片段并展示在主预览器中留给 T025。
- 播放中允许 `maxPlayingDriftFrames` 默认 1 帧漂移，避免每个播放帧都强制 seek；暂停或漂移超过阈值时强制同步。
- 帧映射遵循文档公式：`组合内部时间 = (当前项目帧 - 片段起始帧 + 源偏移帧) / 项目帧率`。

## 验证

- `PATH="/Users/changzechuan/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH" node node_modules/.bin/vp test run src/features/hyperframes-runtime/bridges/player-bridge/useFreeCutTimelineClock.test.tsx`
- `PATH="/Users/changzechuan/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH" node node_modules/.bin/vp test run src/features/hyperframes-runtime/bridges/player-bridge/HyperFramesPlayerHost.test.tsx src/features/hyperframes-runtime/bridges/player-bridge/useFreeCutTimelineClock.test.tsx`
- `PATH="/Users/changzechuan/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH" node node_modules/.bin/vp test run src/features/hyperframes-runtime/upstream/parsers/freecut-runtime-mirror.test.ts src/features/hyperframes-runtime/upstream/lint/freecut-runtime-mirror.test.ts src/features/hyperframes-runtime/upstream/core/freecut-runtime-mirror.test.ts src/features/hyperframes-runtime/upstream/core/compiler/freecut-runtime-mirror.test.ts src/features/hyperframes-runtime/upstream/player/freecut-runtime-mirror.test.ts src/features/hyperframes-runtime/adapters/freecut-project/parser-adapter.test.ts src/features/hyperframes-runtime/adapters/freecut-project/lint-adapter.test.ts src/features/hyperframes-runtime/adapters/freecut-project/runtime-adapter.test.ts src/features/hyperframes-runtime/adapters/freecut-project/compiler-adapter.test.ts src/features/hyperframes-runtime/adapters/freecut-preview/preview-document.test.ts src/features/hyperframes-runtime/bridges/player-bridge/HyperFramesPlayerHost.test.tsx src/features/hyperframes-runtime/bridges/player-bridge/useFreeCutTimelineClock.test.tsx`
- `PATH="/Users/changzechuan/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH" node scripts/check-hyperframes-runtime-imports.mjs`
- `git diff --check`
- `PATH="/Users/changzechuan/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH" node node_modules/.bin/vp check --no-fmt src vite.config.ts`
- `PATH="/Users/changzechuan/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH" node node_modules/.bin/vp build`

## 备注

- T023 窄测试结果：1 个测试文件、4 个测试通过。
- player bridge 联合测试结果：2 个测试文件、8 个测试通过。
- T014-T023 联合测试结果：12 个测试文件、50 个测试通过。
- `check-hyperframes-runtime-imports` 确认没有直接 `@hyperframes/*` import。
- `vp check` 仍有既有 `react(only-export-components)` 警告，位置为 `src/features/keyframes/components/dopesheet-editor/dopesheet-timeline-cells.tsx:35`，本任务未修改该文件。
- `vp build` 通过；仍有既有动态导入、chunk 大小和插件耗时 warning。
