# T021 迁移 `packages/player/src` 到 `upstream/player`

## 任务

把 HyperFrames player 浏览器源码以源码镜像形式迁入 FreeCut，覆盖 Web Component、iframe、时钟、parent media、composition probe、runtime message handler 和 slideshow 基础代码，并改写内部 `@hyperframes/*` import。

## 完成内容

- 使用 `sync-hyperframes-upstream --package player --runtime-only --write` 同步 player runtime 源码。
- 新增源码镜像目录：`src/features/hyperframes-runtime/upstream/player`。
- 同步 core 兼容依赖：
  - `src/features/hyperframes-runtime/upstream/core/compositionContract.ts`
  - `src/features/hyperframes-runtime/upstream/core/slideshow/index.ts`
- 改写 player 内部依赖：
  - `@hyperframes/core/runtime/protocol` -> `../core/runtime/protocol.js`
  - `@hyperframes/core/composition-contract` -> `../core/compositionContract.js`
  - `@hyperframes/core/slideshow` -> `../../core/slideshow/index.js`
- 改写 core 兼容转发：
  - `@hyperframes/parsers/composition-contract` -> `../parsers/compositionContract.js`
  - `@hyperframes/parsers/slideshow` -> `../../parsers/slideshow/index.js`
- 移除上游 `slideshow/test-setup.ts` 测试辅助，并把同步脚本 runtime-only 排除规则扩展到 `test-setup.ts`。
- 将 `CompositionProbe` 默认 runtime fallback 从外部 CDN 改为 FreeCut 同源 `/hyperframes-runtime/core/runtime.js`。
- 为 FreeCut 严格 TS 和 jsdom 环境补最小本地 patch：
  - iframe sandbox DOMTokenList fallback。
  - direct timeline clock unused 参数处理。
  - composition probe timeline key 空值保护。
  - parent media entry 空值保护。
  - slideshow stack 空值保护。
- 新增 `freecut-runtime-mirror.test.ts`，覆盖：
  - Web Component 注册。
  - iframe 创建和缩放。
  - CompositionProbe helpers。
  - DirectTimelineClock。
  - ParentMediaManager。
  - runtime message handler。
  - SlideshowController 类型链路。

## 关键决策

- T021 只完成源码镜像和可编译验证；FreeCut 主预览器封装在 T022，播放头同步在 T023，postMessage nonce/schema 在 T024。
- 不直接从 FreeCut 业务代码使用 `<hyperframes-player>`；后续必须通过 `HyperFramesPlayerHost` bridge。
- 保留上游 player 的内部能力结构，但所有包级依赖都改写到 FreeCut 本地 mirror。
- runtime fallback 改为同源路径，避免 player mirror 自行拉取外部 `@hyperframes/core` CDN 产物。

## 验证

- `PATH="/Users/changzechuan/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH" node node_modules/.bin/vp test run src/features/hyperframes-runtime/upstream/player/freecut-runtime-mirror.test.ts`
- `PATH="/Users/changzechuan/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH" node node_modules/.bin/vp test run src/features/hyperframes-runtime/upstream/parsers/freecut-runtime-mirror.test.ts src/features/hyperframes-runtime/upstream/lint/freecut-runtime-mirror.test.ts src/features/hyperframes-runtime/upstream/core/freecut-runtime-mirror.test.ts src/features/hyperframes-runtime/upstream/core/compiler/freecut-runtime-mirror.test.ts src/features/hyperframes-runtime/upstream/player/freecut-runtime-mirror.test.ts src/features/hyperframes-runtime/adapters/freecut-project/parser-adapter.test.ts src/features/hyperframes-runtime/adapters/freecut-project/lint-adapter.test.ts src/features/hyperframes-runtime/adapters/freecut-project/runtime-adapter.test.ts src/features/hyperframes-runtime/adapters/freecut-project/compiler-adapter.test.ts src/features/hyperframes-runtime/adapters/freecut-preview/preview-document.test.ts`
- `PATH="/Users/changzechuan/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH" node scripts/check-hyperframes-runtime-imports.mjs`
- `git diff --check`
- `PATH="/Users/changzechuan/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH" node node_modules/.bin/vp check --no-fmt src vite.config.ts`
- `PATH="/Users/changzechuan/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH" node node_modules/.bin/vp build`

## 备注

- T021 窄测试结果：1 个测试文件、6 个测试通过。
- T014-T021 联合测试结果：10 个测试文件、42 个测试通过。
- `check-hyperframes-runtime-imports` 确认没有直接 `@hyperframes/*` import。
- `vp check` 仍有既有 `react(only-export-components)` 警告，位置为 `src/features/keyframes/components/dopesheet-editor/dopesheet-timeline-cells.tsx:35`，本任务未修改该文件。
- `vp build` 通过；仍有既有动态导入、chunk 大小和插件耗时 warning。
