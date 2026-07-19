# T006 扩展时间线组合项的源链接字段

## 任务

扩展 FreeCut 现有 `composition` 时间线项，使其可表示 HyperFrames 源链接组合片段，同时不新增独立时间线类型。

## 完成内容

- 在 `src/types/hyperframes.ts` 中新增 `HyperFramesTimelineSourceKind`。
- 在 `src/types/timeline.ts` 的 `CompositionItem` 上新增：
  - `sourceKind?: 'freecut' | 'hyperframes'`
  - `hyperframesProjectId?: string`
  - `activeCompositionPath?: string`
  - `hyperframesManifestPath?: string`
- 在 `src/types/project.ts` 的持久化 timeline item 结构中新增同名字段。
- 新增 `src/types/timeline-hyperframes.test.ts`，验证 HyperFrames 片段仍然使用现有 `composition` 类型。

## 关键决策

- `compositionId` 对 HyperFrames 片段继续存在，可映射到 `hyperframesProjectId`，便于复用现有组合项流程。
- 外层时间线修剪只修改 FreeCut item；HyperFrames 内部组合时长后续由 Studio 和项目目录控制。

## 验证

- `PATH="/Users/changzechuan/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH" node node_modules/.bin/vp test run src/types/hyperframes.test.ts src/types/timeline-hyperframes.test.ts src/features/hyperframes-runtime/provenance/manifest.test.ts`
