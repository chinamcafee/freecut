# T009 实现 OPFS 或现有 workspace-fs 存储适配器

## 任务

实现浏览器持久化的 HyperFrames 项目目录仓储，让 FreeCut 关闭重开后仍能读取 manifest、HTML 文件、资产和快照。

## 完成内容

- 新增 `FileSystemHyperFramesProjectRepository`。
- 新增 `createWorkspaceHyperFramesProjectRepository`，通过 FreeCut 已有 `requireWorkspaceRoot()` 使用当前 workspace。
- 项目目录写入 `projects/{freecutProjectId}/hyperframes/{hyperframesProjectId}`；没有 FreeCut 绑定时写入顶层 `hyperframes/{hyperframesProjectId}`。
- 持久化 `manifest.json`、文本文件、二进制资产、目录索引和快照 JSON。
- 新增 `file-system-project-repository.test.ts`，覆盖跨仓储实例读取、FreeCut 项目过滤、跨实例快照恢复和 workspace root 工厂。

## 关键决策

- 复用 `workspace-fs` 的 File System Access API 原语，不另起 IndexedDB 或直接依赖 HyperFrames npm 包。
- 使用目录索引记录文件与资产路径，避免通过全目录扫描推断项目内容。
- 快照保存在项目目录元数据下，并把二进制资产序列化为数字数组，保持浏览器端可读写。
- 严格路径逃逸、危险扩展和 MIME 守卫留给 T010。

## 验证

- `PATH="/Users/changzechuan/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH" node node_modules/.bin/vp test run src/features/hyperframes-runtime/adapters/freecut-project/file-system-project-repository.test.ts`
- `PATH="/Users/changzechuan/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH" node node_modules/.bin/vp test run src/features/hyperframes-runtime/adapters/freecut-project/project-repository.test.ts src/features/hyperframes-runtime/adapters/freecut-project/file-system-project-repository.test.ts`
- `PATH="/Users/changzechuan/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH" node node_modules/.bin/vp check --no-fmt src vite.config.ts`

## 备注

- `vp check` 仍有既有 `react(only-export-components)` 警告，位置为 `src/features/keyframes/components/dopesheet-editor/dopesheet-timeline-cells.tsx:35`，本任务未修改该文件。
