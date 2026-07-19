# T053 实现时间线源链接组合视觉

## 任务

让普通 FreeCut 组合和 HyperFrames 源链接组合在时间线上可清楚区分，展示 HF 标记、缓存状态、诊断状态、渲染状态和未保存 Studio 修改。

## 完成内容

- 新增 `HyperFramesTimelineVisualState`，作为 `composition` 时间线项的可选视觉状态，不新增独立轨道类型。
- 新增 `hyperframes-clip-visual-state.ts`：
  - 仅识别 `sourceKind: hyperframes` 的组合。
  - 根据诊断、缓存和渲染状态返回稳定的片段边框/底色。
  - 普通 FreeCut 组合返回空状态并沿用原紫色视觉。
- 新增 `HyperFramesClipBadges`：
  - 左上角显示 `HF` 源链接标记。
  - 右下角显示 live、cached、stale、warning、error 或 rendering 状态。
  - Studio 有未保存修改时显示橙色状态点。
- 在现有 `TimelineItem` 壳层接入颜色和 badge，不改变拖拽、修剪、复制、吸附或导出行为。
- `ClipContent` 支持显示 HyperFrames 缩略图缓存 URL；没有缩略图时仍显示组合名称。
- 项目库插入源链接组合时初始化诊断和缓存视觉状态。
- `FreeCutStudioShell` 增加 `onDirtyChange`，编辑器把 Studio dirty 状态同步到对应时间线项；状态未变化时不写时间线，避免仅打开 Studio 就污染 undo/dirty 状态。
- 新增视觉状态测试，覆盖缓存、未保存、错误和普通组合隔离。

## 关键决策

- 外层时间线仍只操作 FreeCut 组合片段；视觉状态不改变 HyperFrames 源目录内容和内部时长。
- 视觉字段是可选状态，旧项目和普通组合无需迁移即可保持原行为。
- Studio dirty 同步只在布尔状态变化时执行，避免无意义的时间线更新。

## 验证

- `PATH="/Users/changzechuan/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH" node node_modules/.bin/vp test run src/features/timeline/components/timeline-item/hyperframes-clip-badges.test.tsx src/features/timeline/components/timeline-item/clip-content.test.tsx src/features/hyperframes-runtime/bridges/studio-bridge/FreeCutStudioShell.test.tsx`
- `PATH="/Users/changzechuan/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH" node node_modules/.bin/vp check --no-fmt src/features/timeline/components/timeline-item/hyperframes-clip-visual-state.ts src/features/timeline/components/timeline-item/hyperframes-clip-badges.tsx src/features/timeline/components/timeline-item/hyperframes-clip-badges.test.tsx src/features/timeline/components/timeline-item/index.tsx src/features/timeline/components/timeline-item/clip-content.tsx src/features/editor/components/editor.tsx src/features/editor/components/hyperframes-project-library-tab.tsx src/features/hyperframes-runtime/bridges/studio-bridge/FreeCutStudioShell.tsx src/types/hyperframes.ts src/types/timeline.ts src/types/project.ts`

## 结果

- T053 核心测试通过：3 个测试文件、11 个测试通过。
- 相关 11 个文件 lint 和类型检查通过，无警告。
