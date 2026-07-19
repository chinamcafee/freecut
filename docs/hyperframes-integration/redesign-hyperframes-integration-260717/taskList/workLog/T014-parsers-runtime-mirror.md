# T014 迁移 parsers runtime 源码镜像

## 任务

将 `/Users/changzechuan/VideoAIEditProjects/hyperframes/packages/parsers/src` 中的 parser runtime 源码迁移到 FreeCut 的 `src/features/hyperframes-runtime/upstream/parsers`，覆盖 HTML、GSAP、资产路径和 hfIds 解析能力。

## 完成内容

- 使用 `sync-hyperframes-upstream` 将 parsers runtime 源码镜像到 `upstream/parsers`。
- 新增 `--runtime-only` 同步模式，跳过上游测试、fixtures、goldens 和 test helpers。
- 迁移 31 个 parser runtime 源文件，包括 `htmlParser.ts`、`gsapParserAcorn.ts`、`gsapWriterAcorn.ts`、`assets.ts`、`assetPaths.ts`、`assetResolution.ts`、`hfIds.ts` 和相关内部依赖。
- 在 FreeCut `package.json` / `package-lock.json` 中声明 parser 源码需要的通用依赖：`@babel/parser`、`acorn`、`acorn-walk`、`linkedom`、`magic-string`、`recast`。
- 新增 `freecut-runtime-mirror.test.ts`，覆盖 HTML roundtrip、GSAP parse/write、资产路径提取、hfIds 持久化。
- 追加 `src/features/hyperframes-runtime/provenance/patch-notes.md` 迁移记录。

## 关键决策

- 不复制上游 parser 测试文件，因为其中部分测试依赖 `@hyperframes/core/generators`，会违反 FreeCut 禁止直接依赖 `@hyperframes/*` package 的边界。
- `upstream/parsers` 保持上游相对 import，不引入 `@hyperframes/*` import。
- T014 只落地源码镜像和基础行为验收；解析异常转换为 FreeCut 诊断对象由 T015 parser 适配入口处理。
- Node-only asset、ffmpeg 辅助源码随 parser runtime 一起镜像，但后续必须通过 adapter/bridge 控制进入浏览器 bundle 的边界。

## 验证

- `PATH="/Users/changzechuan/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH" node node_modules/.bin/vp test run src/features/hyperframes-runtime/upstream/parsers/freecut-runtime-mirror.test.ts`
- `PATH="/Users/changzechuan/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH" node scripts/check-hyperframes-runtime-imports.mjs`
- `PATH="/Users/changzechuan/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH" node node_modules/.bin/vp check --no-fmt src vite.config.ts`
- `PATH="/Users/changzechuan/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH" node node_modules/.bin/vp build`

## 备注

- 单测结果：1 个测试文件、4 个测试通过。
- `check-hyperframes-runtime-imports` 确认没有直接 `@hyperframes/*` import。
- `vp check` 仍有既有 `react(only-export-components)` 警告，位置为 `src/features/keyframes/components/dopesheet-editor/dopesheet-timeline-cells.tsx:35`，本任务未修改该文件。
- `vp build` 通过；仍有既有动态导入与 chunk 大小警告。
