# T011 实现 manifest 签名、preview signature 和 render signature

## 任务

实现 HyperFrames manifest、预览和渲染缓存使用的稳定签名，保证文件、资产和渲染参数变化能正确触发缓存失效，无关 UI 状态不影响渲染签名。

## 完成内容

- 新增 `project-signatures.ts`。
- 提供 `computeHyperFramesManifestSignature`、`computeHyperFramesProjectDirectorySignature`、`computeHyperFramesPreviewSignature` 和 `computeHyperFramesRenderSignature`。
- 提供 `reconcileHyperFramesPreviewSignature`，用于刷新 `manifest.previewSignature`，并在预览签名变化时清除旧 `renderSignature`。
- `InMemoryHyperFramesProjectRepository` 和 `FileSystemHyperFramesProjectRepository` 写入 manifest、文件、资产和恢复快照后都会刷新 preview signature。
- 新增 `project-signatures.test.ts`，覆盖稳定排序、文件变化、资产变化、渲染参数变化、volatile 字段排除和 render cache 失效。

## 关键决策

- 使用稳定 canonical JSON 加 FNV-1a hash，避免依赖 Node `crypto`，保证浏览器端可用。
- manifest signature 排除 `previewSignature`、`renderSignature`、时间戳类 provenance、`lastStudioSave` 和 `lastModelMutation` 等非渲染内容。
- preview signature 包含运行时版本、活动组合、canvas、变量、资产引用、项目文件哈希和资产哈希。
- render signature 在 preview signature 基础上加入输出分辨率、帧率、质量、格式、透明通道、音频策略、引擎和 producer 版本。

## 验证

- `PATH="/Users/changzechuan/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH" node node_modules/.bin/vp test run src/features/hyperframes-runtime/adapters/freecut-project/project-signatures.test.ts src/features/hyperframes-runtime/adapters/freecut-project/project-path-guards.test.ts src/features/hyperframes-runtime/adapters/freecut-project/project-repository.test.ts src/features/hyperframes-runtime/adapters/freecut-project/file-system-project-repository.test.ts`
- `PATH="/Users/changzechuan/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH" node node_modules/.bin/vp check --no-fmt src vite.config.ts`

## 备注

- `vp check` 仍有既有 `react(only-export-components)` 警告，位置为 `src/features/keyframes/components/dopesheet-editor/dopesheet-timeline-cells.tsx:35`，本任务未修改该文件。
