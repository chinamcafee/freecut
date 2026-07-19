# T016 迁移 lint runtime 源码镜像

## 任务

将 `/Users/changzechuan/VideoAIEditProjects/hyperframes/packages/lint/src` 中的 lint runtime 源码迁移到 FreeCut 的 `src/features/hyperframes-runtime/upstream/lint`，覆盖项目 lint、规则和 `shouldBlockRender`。

## 完成内容

- 使用 `sync-hyperframes-upstream --runtime-only` 将 18 个 lint runtime 源文件镜像到 `upstream/lint`。
- 迁移 `hyperframeLinter.ts`、`project.ts`、`rules/*`、`shouldBlockRender.ts`、`browser.ts`、`types.ts` 等核心源码。
- 将 `@hyperframes/parsers/*` import 改写为本地 `../parsers` 源码镜像。
- 在 FreeCut `package.json` / `package-lock.json` 中声明 lint 源码需要的通用直接依赖：`htmlparser2`、`postcss`。
- 新增 `freecut-runtime-mirror.test.ts`，覆盖不安全脚本阻塞、缺失本地资产、字体规则、媒体规则和 render gate。
- 追加 `src/features/hyperframes-runtime/provenance/patch-notes.md` 迁移记录。

## 关键决策

- 不复制上游 lint 测试文件；它们留在上游仓库，FreeCut 侧用 runtime mirror 测试验证迁移后的源码行为。
- T016 保持 lint 上游发现模型 `HyperframeLintFinding` 原样；映射到 FreeCut `HyperFramesDiagnostic` 的统一 severity 和定位模型留给 T017。
- `project.ts` 和 HEVC 预览检查包含 Node-only 能力，当前作为本地服务/测试侧源码镜像保留，后续 adapter 必须控制浏览器入口只使用 `browser.ts` 安全集。

## 验证

- `PATH="/Users/changzechuan/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH" node node_modules/.bin/vp test run src/features/hyperframes-runtime/upstream/lint/freecut-runtime-mirror.test.ts`
- `PATH="/Users/changzechuan/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH" node node_modules/.bin/vp test run src/features/hyperframes-runtime/upstream/parsers/freecut-runtime-mirror.test.ts src/features/hyperframes-runtime/upstream/lint/freecut-runtime-mirror.test.ts src/features/hyperframes-runtime/adapters/freecut-project/parser-adapter.test.ts`
- `PATH="/Users/changzechuan/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH" node scripts/check-hyperframes-runtime-imports.mjs`
- `PATH="/Users/changzechuan/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH" node node_modules/.bin/vp check --no-fmt src vite.config.ts`
- `PATH="/Users/changzechuan/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH" node node_modules/.bin/vp build`

## 备注

- Lint mirror 单测结果：1 个测试文件、4 个测试通过。
- Parser + lint + adapter 联合测试结果：3 个测试文件、13 个测试通过。
- `check-hyperframes-runtime-imports` 确认没有直接 `@hyperframes/*` import。
- `vp check` 仍有既有 `react(only-export-components)` 警告，位置为 `src/features/keyframes/components/dopesheet-editor/dopesheet-timeline-cells.tsx:35`，本任务未修改该文件。
- `vp build` 通过；仍有既有动态导入、chunk 大小和插件耗时 warning。

## 运行时回归补充（2026-07-19）

- 新增 `cssRuleScanner.ts`，为浏览器 lint 提供选择器和声明扫描，覆盖嵌套 at-rule、注释、引号、函数参数及 data URL。
- `composition_self_attribute_selector`、`pointer_events_none` 和 texture 规则改用浏览器安全扫描器，浏览器入口不再因这些规则加载 `postcss`。
- 扫描器、lint mirror 和 FreeCut lint adapter 核心测试通过。
