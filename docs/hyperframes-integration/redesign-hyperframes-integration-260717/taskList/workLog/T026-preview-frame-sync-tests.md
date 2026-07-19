# T026 实现预览性能与帧同步测试

## 任务

把预览渲染设计中的帧同步门禁落成测试：覆盖 FreeCut 时间线 fps 与 HyperFrames 组合 fps 不同时，第 0 帧、中间帧、尾帧的预览同步误差不超过 1 帧，并避免播放中因 1 帧以内漂移反复 seek。

## 完成内容

- 扩展 `useFreeCutTimelineClock` 的帧映射参数：
  - `fps` 继续表示 FreeCut 时间线 fps。
  - 新增 `sourceFps` 表示 HyperFrames 源组合 fps。
  - 新增 `speed` 支持源链接组合的播放速度。
- 调整 `freeCutFrameToHyperFramesSeconds` 与 `hyperFramesSecondsToFreeCutFrame`：
  - `sourceStart/sourceOffsetFrame` 按 HyperFrames 源帧率解释。
  - timeline local frames 按 FreeCut 时间线 fps 解释。
  - 不同 fps round-trip 时使用秒作为中间域，测试门禁保持在 1 帧以内。
- 中央预览 `HyperFramesPreviewOverlay` 在 manifest 加载完成后，把 `manifest.canvas.fps` 传给 `useFreeCutTimelineClock`，避免用 FreeCut 项目 fps 错算 HyperFrames 源时间。
- 补充测试：
  - `useFreeCutTimelineClock.test.tsx` 覆盖 29.97fps 时间线到 23.976fps HyperFrames 源的第 0 帧、中间帧、尾帧 round-trip。
  - `hyperframes-preview-overlay.test.tsx` 覆盖中央预览在 60fps FreeCut 时间线和 30fps HyperFrames manifest 下的首帧、中帧、尾帧 seek 时间。

## 关键决策

- 保持既有 `fps` 字段语义为 FreeCut 时间线 fps，`sourceFps` 缺省回退到 `fps`，因此旧调用路径不需要迁移。
- `sourceOffsetFrame` 保持源媒体帧单位，这与 FreeCut 现有 `sourceStart/sourceFps` 约定一致。
- 本任务先建立预览帧同步门禁；生产器和导出帧对齐会在后续渲染、导出任务中复用同一时间映射原则继续补全。

## 验证

- `PATH="/Users/changzechuan/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH" node node_modules/.bin/vp test run src/features/hyperframes-runtime/bridges/player-bridge/useFreeCutTimelineClock.test.tsx src/features/preview/components/hyperframes-preview-overlay.test.tsx`
- `PATH="/Users/changzechuan/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH" node node_modules/.bin/vp test run src/features/preview/components/hyperframes-preview-overlay.test.tsx src/features/preview/components/preview-stage.test.tsx src/features/preview/components/video-preview.sync.test.tsx src/features/hyperframes-runtime/bridges/player-bridge/HyperFramesPlayerHost.test.tsx src/features/hyperframes-runtime/bridges/player-bridge/useFreeCutTimelineClock.test.tsx`
- `PATH="/Users/changzechuan/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH" node node_modules/.bin/vp test run src/types/hyperframes.test.ts src/types/timeline-hyperframes.test.ts src/shared/projects/migrations/index.test.ts src/features/hyperframes-runtime src/features/preview/components/hyperframes-preview-overlay.test.tsx src/features/preview/components/preview-stage.test.tsx src/features/preview/components/video-preview.sync.test.tsx`
- `PATH="/Users/changzechuan/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH" node scripts/check-hyperframes-runtime-imports.mjs`
- `git diff --check`
- `PATH="/Users/changzechuan/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH" node node_modules/.bin/vp check --no-fmt src vite.config.ts`
- `PATH="/Users/changzechuan/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH" node node_modules/.bin/vp build`

## 备注

- T026 窄测试结果：2 个测试文件、9 个测试通过。
- T025/T026 预览回归测试结果：5 个测试文件、75 个测试通过。
- T014-T026 联合测试结果：25 个测试文件、162 个测试通过。
- `check-hyperframes-runtime-imports` 确认没有直接 `@hyperframes/*` import。
- `vp check` 仍有既有 `react(only-export-components)` 警告，位置为 `src/features/keyframes/components/dopesheet-editor/dopesheet-timeline-cells.tsx:35`，本任务未修改该文件。
- `vp build` 通过；仍有项目既有动态导入、chunk 大小和插件耗时 warning。
