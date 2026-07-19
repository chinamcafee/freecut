# T020 建立 runtime 注入策略

## 任务

建立 HyperFrames 预览 runtime 的统一注入入口，覆盖 `createPreviewDocument`、iframe sandbox、CSP、runtime URL 切换和 postMessage 会话校验基础。

## 完成内容

- 新增 `src/features/hyperframes-runtime/adapters/freecut-preview/preview-document.ts`。
- 新增 `createPreviewDocument`，从编译后的组合 HTML 生成 iframe `srcdoc`，并统一注入：
  - Content Security Policy meta。
  - 预览会话 JSON 配置。
  - session nonce。
  - sandbox token。
  - runtime config script。
  - runtime bootstrap module script。
- 新增 `createHyperFramesPreviewSandbox`，默认只输出 `allow-scripts`。
- 新增 `createHyperFramesPreviewCsp`，默认策略为：
  - `default-src 'none'`
  - 禁止 `connect-src`、`frame-src`、`worker-src`
  - 禁止 `object-src`、`base-uri`、`form-action`、`frame-ancestors`
  - 不启用 `unsafe-eval`
  - runtime bootstrap URL 自动加入受控 script source
- 新增 `validateHyperFramesPreviewMessage`，按 source、type、nonce、projectId、compositionPath、sandboxToken 和 origin 校验消息。
- 新增 `freecut-preview/index.ts` 并从 `src/features/hyperframes-runtime/index.ts` 导出 T020 API。
- 调整 `compiler-adapter`：默认不再注入 runtime，避免绕过 `createPreviewDocument`；保留 `injectRuntime: true` 显式兼容路径。
- 新增 `preview-document.test.ts`，覆盖 srcdoc 注入顺序、默认 sandbox 限制、CSP 限制、runtime URL 切换和 message 校验。
- 补充 `compiler-adapter.test.ts`，验证 compiler 默认把 runtime 注入交给 preview document。

## 关键决策

- T020 只建立 FreeCut adapter 层的安全装配入口，不直接改上游 mirror runtime，也不把策略分散到 UI 组件中。
- 默认 sandbox 不包含 `allow-same-origin`、顶层导航、弹窗、下载、表单等能力，后续 Studio 调试模式需要显式传入 token。
- CSP 默认允许 inline script/style 是为了兼容现阶段组合 HTML 和子组合展开后的脚本与样式；同时禁止 `unsafe-eval` 和任意网络连接。
- runtime URL 由 `createPreviewDocument` 的 `runtime.bootstrapSrc` 控制，后续可切到本地镜像、dev server 或版本化产物。
- postMessage nonce 校验在 T020 提供基础函数，完整 player/runtime 协议接入留给 T024。

## 验证

- `PATH="/Users/changzechuan/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH" node node_modules/.bin/vp test run src/features/hyperframes-runtime/adapters/freecut-preview/preview-document.test.ts`
- `PATH="/Users/changzechuan/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH" node node_modules/.bin/vp test run src/features/hyperframes-runtime/adapters/freecut-project/compiler-adapter.test.ts src/features/hyperframes-runtime/adapters/freecut-preview/preview-document.test.ts`
- `PATH="/Users/changzechuan/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH" node node_modules/.bin/vp test run src/features/hyperframes-runtime/upstream/parsers/freecut-runtime-mirror.test.ts src/features/hyperframes-runtime/upstream/lint/freecut-runtime-mirror.test.ts src/features/hyperframes-runtime/upstream/core/freecut-runtime-mirror.test.ts src/features/hyperframes-runtime/upstream/core/compiler/freecut-runtime-mirror.test.ts src/features/hyperframes-runtime/adapters/freecut-project/parser-adapter.test.ts src/features/hyperframes-runtime/adapters/freecut-project/lint-adapter.test.ts src/features/hyperframes-runtime/adapters/freecut-project/runtime-adapter.test.ts src/features/hyperframes-runtime/adapters/freecut-project/compiler-adapter.test.ts src/features/hyperframes-runtime/adapters/freecut-preview/preview-document.test.ts`
- `PATH="/Users/changzechuan/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH" node scripts/check-hyperframes-runtime-imports.mjs`
- `git diff --check`
- `PATH="/Users/changzechuan/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH" node node_modules/.bin/vp check --no-fmt src vite.config.ts`
- `PATH="/Users/changzechuan/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH" node node_modules/.bin/vp build`

## 备注

- T020 窄测试结果：1 个测试文件、4 个测试通过。
- compiler + preview 联合测试结果：2 个测试文件、7 个测试通过。
- T014-T020 联合测试结果：9 个测试文件、36 个测试通过。
- `check-hyperframes-runtime-imports` 确认没有直接 `@hyperframes/*` import。
- `vp check` 仍有既有 `react(only-export-components)` 警告，位置为 `src/features/keyframes/components/dopesheet-editor/dopesheet-timeline-cells.tsx:35`，本任务未修改该文件。
- `vp build` 通过；仍有既有动态导入、chunk 大小和插件耗时 warning。
