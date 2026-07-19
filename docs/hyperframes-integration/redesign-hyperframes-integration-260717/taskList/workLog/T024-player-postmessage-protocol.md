# T024 实现播放器 iframe 解析和 postMessage 协议

## 任务

实现播放器 iframe 解析和 postMessage 协议校验，覆盖 session nonce、origin 校验和 message schema，确保错误 origin、错误 nonce、错误项目或错误 payload 不进入 FreeCut 预览桥接。

## 完成内容

- 新增 `runtimeMessageProtocol.ts`，定义 FreeCut bridge 层接收 HyperFrames runtime 消息的白名单和 schema 校验：
  - `ready`
  - `state`
  - `timeline`
  - `stage-size`
  - `shader-transition-state`
  - `media-autoplay-blocked`
  - `diagnostic`
  - picker、analytics、perf 消息
- `HyperFramesPlayerHost` 接入 runtime message 校验：
  - 从 `previewDocument` 或 props 派生 `projectId`、`compositionPath`、`sessionNonce` 和 `sandboxToken`。
  - 将 session 字段写入 mirrored `hyperframes-player` Web Component 的 dataset。
  - 通过 `resolveHyperFramesIframe` 绑定 iframe source window。
  - 新增 `onRuntimeMessage` 和 `onRuntimeMessageRejected` 回调。
- `createPreviewDocument` 的返回对象补充 `projectId` 和 `compositionPath`，避免 Host 需要外部重复传入相同上下文。
- mirrored player runtime 源码补充 session 协议：
  - iframe runtime 通过 `postRuntimeMessage` 发出的消息自动附带 `projectId`、`compositionPath`、`nonce` 和 `sandboxToken`。
  - iframe 内部 `installRuntimeControlBridge` 在存在 preview session 时拒绝错误 nonce/project/path/token 的 parent control 消息。
  - `hyperframes-player` 发送 parent control 时附带 dataset 中的 session 字段。
  - `handleRuntimeMessage` 在存在 session 校验参数时拒绝错误 origin、nonce、project、compositionPath 或 sandboxToken。
- bridge 入口导出 runtime message protocol 类型和校验函数。

## 关键决策

- 保留无 session 的 legacy 路径，避免破坏非 FreeCut previewDocument 场景；只要当前 iframe 中存在 `__HF_PREVIEW_SESSION__` 或 Host 提供 session nonce，就启用严格校验。
- Host 层负责 schema 和 FreeCut 回调边界校验；mirrored player/runtime 层负责实际状态更新和 control 接收前的会话校验。
- jsdom 环境下 iframe `contentWindow` 可能为空，测试中允许 Host 校验走无 sourceWindow fallback；纯协议测试仍覆盖 sourceWindow 校验。

## 验证

- `PATH="/Users/changzechuan/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH" node node_modules/.bin/vp test run src/features/hyperframes-runtime/bridges/player-bridge/runtimeMessageProtocol.test.ts src/features/hyperframes-runtime/bridges/player-bridge/HyperFramesPlayerHost.test.tsx src/features/hyperframes-runtime/adapters/freecut-project/runtime-adapter.test.ts src/features/hyperframes-runtime/upstream/player/freecut-runtime-mirror.test.ts`
- `PATH="/Users/changzechuan/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH" node node_modules/.bin/vp test run src/features/hyperframes-runtime/upstream/parsers/freecut-runtime-mirror.test.ts src/features/hyperframes-runtime/upstream/lint/freecut-runtime-mirror.test.ts src/features/hyperframes-runtime/upstream/core/freecut-runtime-mirror.test.ts src/features/hyperframes-runtime/upstream/core/compiler/freecut-runtime-mirror.test.ts src/features/hyperframes-runtime/upstream/player/freecut-runtime-mirror.test.ts src/features/hyperframes-runtime/adapters/freecut-project/parser-adapter.test.ts src/features/hyperframes-runtime/adapters/freecut-project/lint-adapter.test.ts src/features/hyperframes-runtime/adapters/freecut-project/runtime-adapter.test.ts src/features/hyperframes-runtime/adapters/freecut-project/compiler-adapter.test.ts src/features/hyperframes-runtime/adapters/freecut-preview/preview-document.test.ts src/features/hyperframes-runtime/bridges/player-bridge/HyperFramesPlayerHost.test.tsx src/features/hyperframes-runtime/bridges/player-bridge/useFreeCutTimelineClock.test.tsx src/features/hyperframes-runtime/bridges/player-bridge/runtimeMessageProtocol.test.ts`
- `PATH="/Users/changzechuan/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH" node scripts/check-hyperframes-runtime-imports.mjs`
- `git diff --check`
- `PATH="/Users/changzechuan/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH" node node_modules/.bin/vp check --no-fmt src vite.config.ts`
- `PATH="/Users/changzechuan/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH" node node_modules/.bin/vp build`

## 备注

- T024 窄测试结果：4 个测试文件、19 个测试通过。
- T014-T024 联合测试结果：13 个测试文件、55 个测试通过。
- `check-hyperframes-runtime-imports` 确认没有直接 `@hyperframes/*` import。
- `vp check` 仍有既有 `react(only-export-components)` 警告，位置为 `src/features/keyframes/components/dopesheet-editor/dopesheet-timeline-cells.tsx:35`，本任务未修改该文件。
- `vp build` 通过；仍有既有动态导入、chunk 大小和插件耗时 warning。
