# T017 建立 FreeCut lint 诊断映射

## 任务

建立 HyperFrames lint findings 到 FreeCut `HyperFramesDiagnostic` 的统一映射，提供导入、工作室保存、预览和导出前可复用的同一诊断模型。

## 完成内容

- 扩展 `HyperFramesDiagnostic`，增加 `code`、`source`、`stage`、`selector`、`elementId`、`snippet` 等定位字段。
- 新增 `lint-adapter.ts`。
- 提供 `createHyperFramesLintAdapter` 和默认实例 `hyperFramesLintAdapter`。
- 实现 `mapHyperFrameLintFindingToDiagnostic`，将上游 `error/warning/info` 映射为 FreeCut `blocking/warning/suggestion`。
- 实现 `lintHtml`，把 browser-safe lint 结果转换为 `HyperFramesLintSummary`。
- 实现 `lintProjectDirectory`，对内存 `HyperFramesProjectDirectory` 做 HTML lint 和本地资产引用检查。
- 暴露 `shouldBlockRender` 结果，供导出门禁使用。
- 从 `adapters/freecut-project/index.ts` 和 `src/features/hyperframes-runtime/index.ts` 导出 lint adapter API。
- 新增 `lint-adapter.test.ts`，覆盖 severity 映射、四类 stage、导出门禁、缺失资产诊断。

## 关键决策

- `HyperFramesDiagnostic.stage` 统一使用 `import`、`studio-save`、`preview`、`export`，使四个调用点共享同一结果结构。
- 上游 lint 的 `error` 在 FreeCut 中映射为 `blocking`；`warning` 映射为 `warning`；`info` 映射为 `suggestion`。
- `strictErrors` 默认开启，`strictAll` 可让导出门禁把 warning 也视为阻塞。
- 项目目录资产检查先在 adapter 内覆盖内存项目目录场景；Node 文件系统级 `lintProject` 已在 T016 镜像，后续本地服务可复用。

## 验证

- `PATH="/Users/changzechuan/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH" node node_modules/.bin/vp test run src/features/hyperframes-runtime/adapters/freecut-project/lint-adapter.test.ts`
- `PATH="/Users/changzechuan/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH" node node_modules/.bin/vp test run src/features/hyperframes-runtime/upstream/parsers/freecut-runtime-mirror.test.ts src/features/hyperframes-runtime/upstream/lint/freecut-runtime-mirror.test.ts src/features/hyperframes-runtime/adapters/freecut-project/parser-adapter.test.ts src/features/hyperframes-runtime/adapters/freecut-project/lint-adapter.test.ts`
- `PATH="/Users/changzechuan/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH" node scripts/check-hyperframes-runtime-imports.mjs`
- `PATH="/Users/changzechuan/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH" node node_modules/.bin/vp check --no-fmt src vite.config.ts`
- `PATH="/Users/changzechuan/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH" node node_modules/.bin/vp build`

## 备注

- Lint adapter 单测结果：1 个测试文件、4 个测试通过。
- T014-T017 联合测试结果：4 个测试文件、17 个测试通过。
- `check-hyperframes-runtime-imports` 确认没有直接 `@hyperframes/*` import。
- `vp check` 仍有既有 `react(only-export-components)` 警告，位置为 `src/features/keyframes/components/dopesheet-editor/dopesheet-timeline-cells.tsx:35`，本任务未修改该文件。
- `vp build` 通过；仍有既有动态导入、chunk 大小和插件耗时 warning。
