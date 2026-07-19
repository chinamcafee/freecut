# T012 实现 FreeCut 项目迁移

## 任务

实现 FreeCut 项目 schema 迁移，把旧项目升级为 manifest-backed HyperFrames 集成状态，并处理旧内嵌组合和缺失 manifest 的诊断。

## 完成内容

- 将 `CURRENT_SCHEMA_VERSION` 从 12 升级到 13。
- 新增 v13 migration：`Initialize manifest-backed HyperFrames integration state`。
- 普通旧项目会初始化 `Project.hyperframes`，包含空 `projects`、`compositionLinks`、`renderCache`、`skills`、`modelProfiles` 和默认 `renderConfig`。
- 旧 `hyperframes.compositions` 会迁移为 `HyperFramesProjectManifest`。
- 带 `compositionHtml` 的旧 composition 时间线项会转为 `sourceKind: "hyperframes"` 源链接项，并移除旧 HTML 字段。
- 已经是 `sourceKind: "hyperframes"` 但缺失 manifest 的时间线项会生成占位 manifest，并带 blocking diagnostic。
- `HyperFramesProjectSource` 补充 `hyperframes-project` 和 `legacy-composition` 来源。

## 关键决策

- 不修改历史迁移，只新增 v13，保持迁移链可审计。
- v13 对旧未知字段使用宽松读取和收窄，避免旧快照因多余字段直接失败。
- 对缺失 manifest 不静默丢弃时间线项，而是保留源链接关系并写入阻塞诊断，后续 UI 可提示重连或重新导入。

## 验证

- `PATH="/Users/changzechuan/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH" node node_modules/.bin/vp test run src/shared/projects/migrations/index.test.ts`
- `PATH="/Users/changzechuan/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH" node node_modules/.bin/vp test run src/shared/projects/migrations/index.test.ts src/shared/projects/migrations/sanitize-text-motion.test.ts src/types/hyperframes.test.ts src/types/timeline-hyperframes.test.ts`
- `PATH="/Users/changzechuan/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH" node node_modules/.bin/vp check --no-fmt src vite.config.ts`

## 备注

- `vp check` 仍有既有 `react(only-export-components)` 警告，位置为 `src/features/keyframes/components/dopesheet-editor/dopesheet-timeline-cells.tsx:35`，本任务未修改该文件。
