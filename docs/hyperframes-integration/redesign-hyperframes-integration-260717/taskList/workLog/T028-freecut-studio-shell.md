# T028 实现 FreeCutStudioShell

## 任务

把 HyperFrames 工作室接入 FreeCut 主面板浮层，实现打开、关闭、保存、dirty 状态和快捷键作用域。验收重点是：双击 HyperFrames 片段能打开工作室；存在未保存修改时，关闭会被阻止并要求用户选择保存或丢弃。

## 完成内容

- 新增 `src/features/hyperframes-runtime/bridges/studio-bridge`：
  - `FreeCutStudioShell.tsx`：FreeCut 顶层工作室浮层，负责加载状态、ready 状态、关闭确认和快捷键作用域。
  - `FreeCutStudioToolbar.tsx`：保存、关闭、预览播放控制、dirty 与诊断状态展示。
  - `FreeCutStudioPanels.tsx`：把 T027 迁移的 `NLELayout`、`FileTree`、`SourceEditor`、`NLEPreview`、`PropertyPanel` 组合成工作室主界面。
  - `useFreeCutStudioSession.ts`：从 `HyperFramesProjectRepository` 加载项目目录，管理 active file、draft content、dirty files、串行保存和快照。
  - `studioSaveQueue.ts`：串行化工作室保存，避免重复快捷键保存并发写入。
  - `studioEvents.ts`：定义 FreeCut 时间线到工作室浮层的打开事件通道。
  - `studioThemeAdapter.ts`：定义 `.freecut-hyperframes-studio` 根样式边界。
  - `studioUndoBridge.ts`：建立工作室 undo bridge 的最小接口，供后续跨边界 undo journal 接入。
- 接入 FreeCut editor 顶层：
  - `LoadedEditor` 监听工作室打开事件。
  - 选中 HyperFrames 片段后按 Enter 会打开工作室。
  - 工作室 Shell 使用 `lazy()` 按需加载，避免普通 editor 首屏静态拉入 Studio UI。
- 接入时间线双击：
  - `sourceKind: 'hyperframes'` 的 `composition` 双击会打开 FreeCut Studio。
  - 普通 FreeCut compound clip 仍保持原有进入子组合行为。
- 快捷键作用域：
  - Cmd/Ctrl+S 保存工作室文件，不触发主项目保存。
  - Escape 走 dirty-aware 关闭流程。
  - Space 控制工作室预览播放。
  - Delete/Backspace 在工作室非编辑目标上被拦截，避免误删主时间线项。
  - Cmd/Ctrl+Z 被拦截在工作室作用域内，后续接入 `studioUndoBridge`。
- dirty 关闭保护：
  - 源码编辑后关闭会打开确认弹窗。
  - 用户可继续编辑、丢弃修改或保存后关闭。
  - 保存会写回 `HyperFramesProjectRepository`，并更新 manifest `lastStudioSave`。

## 关键决策

- T028 只负责 Shell、session、dirty 和快捷键闭环；完整 `FreeCutStudioAdapter` 的 read/write/lint/selection/thumbnail/renderPreview 接口留给 T029。
- Shell 不直接读写 FreeCut store 或磁盘；它只通过 `HyperFramesProjectRepository` 访问 HyperFrames 项目目录。
- Editor 只保存当前打开的 `FreeCutStudioTimelineItem`，真实工作室 UI 通过 lazy chunk 按需加载。
- 时间线双击入口使用精确子模块 import，避免 timeline 基础模块通过 barrel 静态拉入整个 Studio Shell。

## 验证

- `PATH="/Users/changzechuan/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH" node node_modules/.bin/vp test run src/features/hyperframes-runtime/bridges/studio-bridge/FreeCutStudioShell.test.tsx src/features/timeline/components/timeline-item/use-timeline-item-pointer-handlers.test.tsx`
- `PATH="/Users/changzechuan/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH" node node_modules/.bin/vp check --no-fmt src/features/hyperframes-runtime/bridges/studio-bridge src/features/editor/components/editor.tsx src/features/timeline/components/timeline-item/use-timeline-item-pointer-handlers.ts src/features/timeline/components/timeline-item/use-timeline-item-pointer-handlers.test.tsx`
- `PATH="/Users/changzechuan/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH" node node_modules/.bin/vp test run src/types/hyperframes.test.ts src/types/timeline-hyperframes.test.ts src/shared/projects/migrations/index.test.ts src/features/hyperframes-runtime src/features/preview/components/hyperframes-preview-overlay.test.tsx src/features/preview/components/preview-stage.test.tsx src/features/preview/components/video-preview.sync.test.tsx src/features/timeline/components/timeline-item/use-timeline-item-pointer-handlers.test.tsx`
- `PATH="/Users/changzechuan/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH" node scripts/check-hyperframes-runtime-imports.mjs`
- `git diff --check`
- `PATH="/Users/changzechuan/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH" node node_modules/.bin/vp check --no-fmt src vite.config.ts`
- `PATH="/Users/changzechuan/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH" node node_modules/.bin/vp build`

## 备注

- T028 窄测试通过：2 个测试文件、15 个测试通过。
- T014-T028 联合测试通过：28 个测试文件、182 个测试通过。
- `check-hyperframes-runtime-imports` 确认没有直接 `@hyperframes/*` import。
- `vp check --no-fmt src vite.config.ts` 通过，仍有既有 `react(only-export-components)` 警告，位置为 `src/features/keyframes/components/dopesheet-editor/dopesheet-timeline-cells.tsx:35`，本任务未修改该文件。
- `vp build` 通过；`FreeCutStudioShell` 已拆成独立 lazy chunk，构建仍保留项目既有动态导入、chunk 大小和插件耗时 warning。
- T029 需要把当前 Shell session 替换/扩展为完整 `FreeCutStudioAdapter`，并严格证明 Studio 不能直接读写 FreeCut store 或磁盘。

## 冷启动与主面板验收补充（2026-07-19）

- Shell 和 Panels 改用精确浏览器入口，`sourceMutation` 的 CSS 规则复制复用本地浏览器安全扫描器，不再让 Studio lazy chunk 加载 Node 专用 `postcss` 链。
- 在真实 FreeCut 主面板通过时间线右键打开 Studio；冷启动后控制台为 0 warning、0 error。
- 保存、dirty 关闭保护、工作室快捷键作用域及 1024x768/768x720 响应式布局完成浏览器验收。
