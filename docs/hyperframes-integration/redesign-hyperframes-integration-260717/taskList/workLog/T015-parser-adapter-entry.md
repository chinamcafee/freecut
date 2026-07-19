# T015 建立 parsers 适配入口

## 任务

建立 FreeCut 到 HyperFrames parser 镜像源码的 typed wrapper，保证 UI 和后续 Studio adapter 不直接调用 `upstream/parsers`，并且解析失败返回诊断对象，不把异常直接抛给 UI。

## 完成内容

- 新增 `parser-adapter.ts`。
- 提供 `createHyperFramesParserAdapter` 和默认实例 `hyperFramesParserAdapter`。
- 统一返回 `HyperFramesParserResult<T>`：`ok`、`value`、`diagnostics`。
- 封装 HTML 能力：`ensureStableHfIds`、`parseHtml`、`validateHtml`、`updateHtmlElement`。
- 封装 GSAP 能力：`parseGsap`、`updateGsapAnimation`。
- 封装资产扫描能力：`collectAssetReferences`，覆盖 `src`、`href`、inline style 和 style block 中的相对资产引用。
- 将 parser adapter 从 `adapters/freecut-project/index.ts` 和 `src/features/hyperframes-runtime/index.ts` 导出。
- 新增 `parser-adapter.test.ts`，覆盖成功解析、HTML 校验诊断、GSAP 语法诊断、缺失动画诊断和资产收集。

## 关键决策

- Adapter 使用现有 `HyperFramesDiagnostic` 类型，诊断 severity 复用 `blocking`、`warning`、`suggestion`。
- Adapter 负责 catch 上游 parser 异常，调用方永远通过 `diagnostics` 判断是否可继续。
- 在没有浏览器 `DOMParser` 的环境里，adapter 临时注入 `linkedom` 的 DOMParser 作为 parser 环境兜底。
- T015 只做 parser adapter；lint 诊断映射和 render-blocking 规则留给 T016/T017。

## 验证

- `PATH="/Users/changzechuan/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH" node node_modules/.bin/vp test run src/features/hyperframes-runtime/adapters/freecut-project/parser-adapter.test.ts`
- `PATH="/Users/changzechuan/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH" node node_modules/.bin/vp test run src/features/hyperframes-runtime/upstream/parsers/freecut-runtime-mirror.test.ts src/features/hyperframes-runtime/adapters/freecut-project/parser-adapter.test.ts`
- `PATH="/Users/changzechuan/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH" node scripts/check-hyperframes-runtime-imports.mjs`
- `PATH="/Users/changzechuan/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH" node node_modules/.bin/vp check --no-fmt src vite.config.ts`
- `PATH="/Users/changzechuan/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH" node node_modules/.bin/vp build`

## 备注

- Adapter 单测结果：1 个测试文件、5 个测试通过。
- Parser mirror + adapter 联合测试结果：2 个测试文件、9 个测试通过。
- `check-hyperframes-runtime-imports` 确认没有直接 `@hyperframes/*` import。
- `vp check` 仍有既有 `react(only-export-components)` 警告，位置为 `src/features/keyframes/components/dopesheet-editor/dopesheet-timeline-cells.tsx:35`，本任务未修改该文件。
- `vp build` 通过；仍有既有动态导入、chunk 大小和插件耗时 warning。
