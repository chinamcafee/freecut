# T010 实现路径安全与文件类型守卫

## 任务

实现 HyperFrames 项目目录路径安全与文件类型守卫，拒绝绝对路径、越界路径、危险扩展、密钥类文件和非法 MIME。

## 完成内容

- 新增 `project-path-guards.ts`。
- 提供 `assertHyperFramesProjectId`、`normalizeHyperFramesProjectPath`、`assertHyperFramesProjectPath`、`assertWritableFileType` 和 `assertHyperFramesManifestPaths`。
- 守卫覆盖 POSIX 相对路径、Windows 盘符、URL 路径、反斜杠、空段、`.`、`..`、隐藏段、Windows 设备名、危险扩展、凭据文件和 MIME/扩展不匹配。
- `InMemoryHyperFramesProjectRepository` 和 `FileSystemHyperFramesProjectRepository` 都接入同一套守卫。
- 新增 `project-path-guards.test.ts`，并扩展文件系统仓储测试覆盖路径逃逸、危险脚本和 MIME 不匹配。

## 关键决策

- 守卫放在 `adapters/freecut-project`，作为 Studio、模型写入、本地服务桥接和仓储共同复用的边界 API。
- 浏览器侧不使用 Node `fs.realpath`；当前通过拒绝非相对路径语法、隐藏段和外部传入 handle 来防止项目路径逃逸。后续本地服务迁移 `studio-server` 时，需要继续使用上游 `safePath` 的 realpath 语义处理真实符号链接。
- 普通文本写入和资产写入使用不同 allowlist：HTML/CSS/JS/JSON/SVG 等走 text，媒体、字体、图片和文本资源走 asset。

## 验证

- `PATH="/Users/changzechuan/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH" node node_modules/.bin/vp test run src/features/hyperframes-runtime/adapters/freecut-project/project-path-guards.test.ts src/features/hyperframes-runtime/adapters/freecut-project/project-repository.test.ts src/features/hyperframes-runtime/adapters/freecut-project/file-system-project-repository.test.ts`
- `PATH="/Users/changzechuan/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH" node node_modules/.bin/vp check --no-fmt src vite.config.ts`

## 备注

- `vp check` 仍有既有 `react(only-export-components)` 警告，位置为 `src/features/keyframes/components/dopesheet-editor/dopesheet-timeline-cells.tsx:35`，本任务未修改该文件。
