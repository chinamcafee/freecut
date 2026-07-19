# T027 迁移 Studio 第一批源码

## 任务

把 HyperFrames `packages/studio` 中 FreeCut 主面板后续嵌入需要的第一批源码迁移到 FreeCut 专用源码目录中，覆盖 NLE 布局、预览、文件树、源码编辑、属性面板、player hooks 和 sourcePatcher，并确保源码镜像可以在 FreeCut 编译链路中通过类型检查，样式不污染主界面。

## 完成内容

- 通过 `scripts/sync-hyperframes-upstream.mjs` 同步 `packages/studio/src` 的第一批文件到 `src/features/hyperframes-runtime/upstream/studio`，并更新 `provenance/upstream-sync-state.json`。
- 建立 Studio 镜像入口 `index.ts`，集中导出 NLE、editor、player、utils 等 FreeCut 可消费 API。
- 迁移并适配 editor 侧组件：
  - `FileTree`、`FileTreeNodes`、`FileTreeIcons`。
  - 新增 `FileTreeModel.ts` 承载树节点类型与构建、排序、激活判断等纯逻辑。
  - `SourceEditor` 保留上游同名组件和 props，当前用 textarea 实现可编译版本。
  - `PropertyPanel` 提供第一批属性检查面板，用于展示单选、多选和空选择状态。
- 迁移并适配 NLE 侧组件：
  - `NLEPreview`、`CompositionBreadcrumb`、`previewZoom`。
  - 新增 `previewSizing.ts`，把预览尺寸和 player key 计算从 TSX 中拆出，避免 Fast Refresh 误报。
  - 新增 FreeCut 侧 `NLELayout` skeleton，提供 `data-hf-studio-surface="true"` 样式边界。
- 补齐 player 门面：
  - `player/Player.tsx`
  - `player/types.ts`
  - `player/hooks/useTimelinePlayer.ts`
  - `player/index.ts`
- 迁移 `sourcePatcher`、`htmlEditor`、`studioUiPreferences`，并为严格 TypeScript 补充空值守卫。
- 新增本地 `PhosphorIconShim` 和 `icons/SystemIcons`，把上游图标依赖映射到 FreeCut 已有的 `lucide-react`。
- 新增 `studioTelemetry` no-op 适配，避免嵌入式 Studio 镜像独立发送 telemetry。
- 新增 `freecut-runtime-mirror.test.tsx`，覆盖 NLELayout 样式边界、FileTree/SourceEditor 交互、PropertyPanel、预览尺寸、player hook、sourcePatcher/htmlEditor。
- 在 `provenance/patch-notes.md` 记录本批 Studio 源码迁移、改写、未迁移范围和验证结果。

## 关键决策

- 上游当前没有 `components/nle/NLELayout.tsx`，本任务按文档意图在 FreeCut 侧新增 `NLELayout` skeleton，后续 T028 的 `FreeCutStudioShell` 会把真实打开、关闭、保存、dirty 状态和快捷键作用域接入这里。
- 上游 `SourceEditor` 依赖 CodeMirror 与 `@phosphor-icons/react`。当前环境没有可用 `npm`，且目标要求不直接依赖 HyperFrames npm 包，因此本任务先保留同 props 的 textarea 版本，确保 FreeCut 编译和第一批源码边界可用。
- 上游完整 `PropertyPanel` 深度依赖 `@hyperframes/core` 与 DOM/GSAP/Layer/Motion 编辑模块，这些属于后续批次；本任务只提供可编译、可嵌入的第一批属性面板入口。
- 没有引入 Studio 全局 CSS；迁移组件使用局部 class 和 `data-hf-studio-surface` 边界，后续主面板样式接入仍应限制在 FreeCutStudioShell 内。

## 验证

- `PATH="/Users/changzechuan/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH" node node_modules/.bin/vp check --no-fmt src/features/hyperframes-runtime/upstream/studio`
- `PATH="/Users/changzechuan/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH" node node_modules/.bin/vp test run src/features/hyperframes-runtime/upstream/studio/freecut-runtime-mirror.test.tsx`
- `PATH="/Users/changzechuan/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH" node node_modules/.bin/vp test run src/types/hyperframes.test.ts src/types/timeline-hyperframes.test.ts src/shared/projects/migrations/index.test.ts src/features/hyperframes-runtime src/features/preview/components/hyperframes-preview-overlay.test.tsx src/features/preview/components/preview-stage.test.tsx src/features/preview/components/video-preview.sync.test.tsx`
- `PATH="/Users/changzechuan/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH" node scripts/check-hyperframes-runtime-imports.mjs`
- `git diff --check`
- `PATH="/Users/changzechuan/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH" node node_modules/.bin/vp check --no-fmt src vite.config.ts`
- `PATH="/Users/changzechuan/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH" node node_modules/.bin/vp build`

## 备注

- Studio 镜像子树类型检查通过：22 个文件，0 errors，0 warnings。
- T027 窄测试通过：1 个测试文件、5 个测试通过。
- T014-T027 联合测试通过：26 个测试文件、167 个测试通过。
- `check-hyperframes-runtime-imports` 确认没有直接 `@hyperframes/*` import。
- `vp check --no-fmt src vite.config.ts` 通过，仍有既有 `react(only-export-components)` 警告，位置为 `src/features/keyframes/components/dopesheet-editor/dopesheet-timeline-cells.tsx:35`，本任务未修改该文件。
- `vp build` 通过；仍有项目既有动态导入、chunk 大小和插件耗时 warning。

## 浏览器集成补充（2026-07-19）

- `FreeCutStudioPanels` 改为精确导入 Studio 组件和类型，避免 Studio barrel 把未使用的服务端/解析器入口拉入浏览器 chunk。
- Studio 在 1024x768 和 768x720 视口完成打开、布局和交互验收，未观察到 HyperFrames 面板重叠或不可操作状态。
