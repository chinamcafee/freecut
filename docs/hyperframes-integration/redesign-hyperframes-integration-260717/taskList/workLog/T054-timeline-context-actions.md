# T054 实现时间线右键动作

## 任务

为 HyperFrames 源链接组合增加打开工作室、重新渲染、重新链接、导出项目目录、转原生项和查看来源的时间线右键动作，并确保动作不把外层修剪写入源目录。

## 完成内容

- 扩展 `ItemContextMenu`，仅对 `sourceKind: hyperframes` 的组合显示 6 个专属动作：
  - Open HyperFrames Studio
  - Rerender HyperFrames cache
  - Relink HyperFrames project
  - Export HyperFrames project
  - Convert to native items
  - View HyperFrames source
- 打开工作室动作复用现有 `emitFreeCutStudioOpenRequest()`。
- 新增 `timelineActions.ts` 命令事件桥：
  - 定义 `HyperFramesTimelineAction` 和请求 schema。
  - 提供创建、发出和订阅动作请求的 API。
  - 请求只携带 timeline item ID、项目 ID、活动组合路径和 manifest 路径。
- 时间线片段把菜单动作映射到 Studio 桥或统一 HyperFrames timeline action 事件。
- 从 studio bridge 和 HyperFrames runtime 根入口导出动作协议。
- 新增协议和菜单测试。

## 关键决策

- 动作请求不包含外层 `from`、`durationInFrames`、trim 或 source range，确保移动/修剪 FreeCut 片段不会隐式修改 HyperFrames 内部时长。
- 菜单只负责发命令，不在 React 回调中直接读写项目目录；渲染、重链接、导出和转换服务可分别订阅同一类型化协议。
- 普通 FreeCut 组合不显示这些动作。

## 验证

- `PATH="/Users/changzechuan/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH" node node_modules/.bin/vp test run src/features/hyperframes-runtime/bridges/studio-bridge/timelineActions.test.ts src/features/timeline/components/timeline-item/item-context-menu.test.tsx`
- `PATH="/Users/changzechuan/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH" node node_modules/.bin/vp check --no-fmt src/features/hyperframes-runtime/bridges/studio-bridge/timelineActions.ts src/features/hyperframes-runtime/bridges/studio-bridge/timelineActions.test.ts src/features/hyperframes-runtime/bridges/studio-bridge/index.ts src/features/hyperframes-runtime/index.ts src/features/timeline/components/timeline-item/item-context-menu.tsx src/features/timeline/components/timeline-item/item-context-menu.test.tsx src/features/timeline/components/timeline-item/index.tsx`

## 结果

- T054 核心测试通过：2 个测试文件、9 个测试通过。
- 相关 7 个文件 lint 和类型检查通过，无警告。

## 主面板运行时验收补充（2026-07-19）

- 六个右键动作均已接入顶层 action controller，而不是停留在事件声明：打开 Studio、重新渲染、重链接、导出目录、转原生项和查看来源均有明确消费者。
- 导出、重链接、查看来源和转换动作完成浏览器交互验收；Producer 未配置时重新渲染会显示明确错误，不静默失败。
- 菜单动作与 Studio 打开链纳入本轮 15 文件、51 测试核心回归。
