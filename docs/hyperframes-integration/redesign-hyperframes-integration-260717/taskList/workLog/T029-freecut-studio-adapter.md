# T029 实现 FreeCutStudioAdapter

## 任务

实现 FreeCut 与迁移版 HyperFrames Studio 之间的适配层，交付文件树、read/write、previewUrl、lint、selection、thumbnail、renderPreview 能力。验收重点是：Studio Shell 和面板不能直接读写 FreeCut store 或磁盘，所有项目目录访问都必须经过受控 adapter。

## 完成内容

- 新增 `createFreeCutStudioAdapter`：
  - `listFiles(projectId)`：从 HyperFrames 项目目录生成 Studio 文件树。
  - `resolveProject(projectId)`：读取当前 HyperFrames 项目目录。
  - `readFile(projectId, path)` / `writeFile(projectId, path, content, patchMeta)`：受控读写项目文件，并返回内容 hash。
  - `previewUrl(projectId, compositionPath)`：生成 composition HTML 的浏览器预览 data URL。
  - `lint(projectId, compositionPath)`：运行 browser-safe HyperFrames lint，并补充本地 asset 引用缺失诊断。
  - `getSelection(projectId)` / `updateSelection(projectId, selection)`：维护 Studio 选区状态。
  - `generateThumbnail(projectId, options)`：生成缩略图 data URL 占位结果，后续可替换为真实截图管线。
  - `renderPreview(projectId, options)`：聚合 `previewUrl` 和 `lint`，返回可渲染状态与诊断。
  - `createSnapshot` / `writeManifest`：保留给 session 保存流程使用，仍由 adapter 统一转发到 repository。
- 新增 `StudioSelectionMapper`，把 runtime 选区消息规范化为 Studio 选区模型。
- 改造 `useFreeCutStudioSession`：
  - session 通过 `adapterFactory` 创建 `FreeCutStudioAdapter`。
  - load/save/lint/manifest 写入都经过 adapter。
  - 原有 `repositoryFactory` 仅保留为测试兼容入口，并被包装进 adapter，不再让 Shell/session 直接操作存储实现。
- 改造 `FreeCutStudioShell`：
  - 增加 `adapterFactory` 注入能力。
  - 浮层继续只关心 session 状态，不接触 FreeCut store 或底层磁盘 API。
- 新增 `createFreeCutStudioAdapter.test.ts`，覆盖文件树、读写 hash、previewUrl、缺失 asset lint、selection、thumbnail 和 renderPreview。

## 关键决策

- T029 的 adapter 只使用 FreeCut 内部源码镜像和 FreeCut 项目目录 repository，不依赖 `@hyperframes/*` npm 包。
- Studio 面板层不引入 `workspace-fs`、`fs-primitives`、FreeCut store 或 repository 创建函数；这些能力集中在 `createFreeCutStudioAdapter` 内部。
- `lint` 改为直接使用 `upstream/lint/browser.js`，避免把 Node-only parser/lint adapter 带入 Studio 浏览器 chunk。
- `renderPreview` 使用闭包里的 adapter 实例调用 `previewUrl` 和 `lint`，避免方法解构后丢失 `this` 绑定。
- 缩略图先交付可测试、可替换的 adapter 形态；真实截图和 waveform/preview helper 会在 T030/T031 继续接入。

## 验证

- `PATH="/Users/changzechuan/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH" node node_modules/.bin/vp test run src/features/hyperframes-runtime/bridges/studio-bridge/createFreeCutStudioAdapter.test.ts src/features/hyperframes-runtime/bridges/studio-bridge/FreeCutStudioShell.test.tsx src/features/timeline/components/timeline-item/use-timeline-item-pointer-handlers.test.tsx`
- `PATH="/Users/changzechuan/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH" node node_modules/.bin/vp check --no-fmt src/features/hyperframes-runtime/bridges/studio-bridge src/features/editor/components/editor.tsx src/features/timeline/components/timeline-item/use-timeline-item-pointer-handlers.ts src/features/timeline/components/timeline-item/use-timeline-item-pointer-handlers.test.tsx`
- `PATH="/Users/changzechuan/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH" node node_modules/.bin/vp test run src/types/hyperframes.test.ts src/types/timeline-hyperframes.test.ts src/shared/projects/migrations/index.test.ts src/features/hyperframes-runtime src/features/preview/components/hyperframes-preview-overlay.test.tsx src/features/preview/components/preview-stage.test.tsx src/features/preview/components/video-preview.sync.test.tsx src/features/timeline/components/timeline-item/use-timeline-item-pointer-handlers.test.tsx`
- `rg -n "use[A-Za-z]+Store|workspace-fs|fs-primitives|writeBlob|readBlob|createWorkspaceHyperFramesProjectRepository" src/features/hyperframes-runtime/bridges/studio-bridge --glob '!createFreeCutStudioAdapter.ts' --glob '!*.test.*'`
- `PATH="/Users/changzechuan/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH" node scripts/check-hyperframes-runtime-imports.mjs`
- `git diff --check`
- `PATH="/Users/changzechuan/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH" node node_modules/.bin/vp check --no-fmt src vite.config.ts`
- `PATH="/Users/changzechuan/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH" node node_modules/.bin/vp build`

## 备注

- T029 窄测试通过：3 个测试文件、17 个测试通过。
- T014-T029 联合测试通过：29 个测试文件、184 个测试通过；jsdom 对 HTMLMediaElement 的 `load/pause` 未实现提示不影响测试结果。
- Studio bridge 边界搜索无输出，证明除 adapter 和测试外，Shell/session/panels 没有直接访问 FreeCut store、workspace-fs、fs-primitives 或底层 repository 创建函数。
- `check-hyperframes-runtime-imports` 确认没有直接 `@hyperframes/*` import。
- `vp check --no-fmt src vite.config.ts` 通过，仍有既有 `react(only-export-components)` 警告，位置为 `src/features/keyframes/components/dopesheet-editor/dopesheet-timeline-cells.tsx:35`，本任务未修改该文件。
- `vp build` 通过；构建日志未再出现 T029 早期引入的 `node:path` / `node:fs` / `upstream/parsers` 浏览器包告警。`FreeCutStudioShell` 保持独立 lazy chunk，约 274 KB。

## 浏览器依赖补充（2026-07-19）

- Studio bridge 生产代码进一步改用 repository、签名、lint 与 parser 的精确文件入口，避免适配器 barrel 扩大浏览器依赖图。
- 真实浏览器冷启动并打开 Studio 后未出现 Node module externalized warning；完整生产构建通过。
