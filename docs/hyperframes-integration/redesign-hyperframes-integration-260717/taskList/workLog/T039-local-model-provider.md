# T039 实现本地模型 provider

## 任务

实现本地模型 provider，交付本地 HTTP、本地命令或 FreeCut 内置能力注册。验收重点是：本地服务未启动时 UI 有明确状态。

## 完成内容

- 扩展 `ModelProfile`：
  - 新增 `localRuntime`，支持 `serviceUrl`、`healthPath`、`modelFilePath`、`command`、`commandArgs`、`minMemoryGb`、`minVramGb` 和 `allowOffline`。
- 新增 `src/features/hyperframes-runtime/model-center/providers/localModelProvider.ts`：
  - `createLocalModelProvider()` 创建本地模型 provider。
  - `checkStatus()` 对 `local` profile 支持本地 HTTP health check。
  - `checkStatus()` 对本地命令 profile 支持注入式 `runCommand()` 状态检查。
  - `checkStatus()` 对 `freecut-built-in` profile 返回可展示的内置能力状态。
  - 统一返回 `LocalModelHealth`，包含 `ready`、`not-running`、`misconfigured`、`unsupported` 和 `error` 状态。
  - 本地服务未启动时返回明确文案：`Local model service is not running or cannot be reached.`。
- 新增 FreeCut 内置能力注册：
  - `createFreeCutBuiltInModelProfiles()` 注册本地转写、嵌入、语音合成和音乐生成能力。
  - `createFreeCutBuiltInCapabilityBindings()` 生成对应能力绑定。
  - 内置能力均为 `providerType: 'freecut-built-in'`、`privacyMode: 'local'`、`allowOffline: true`。
- 新增导出入口：
  - `model-center/providers/index.ts`。
  - `model-center/index.ts`。
  - `features/hyperframes-runtime/index.ts`。
- 新增测试：
  - 本地 HTTP 服务 ready 状态。
  - 本地 HTTP 服务未启动时返回 UI 可读 `not-running` 状态。
  - 本地命令通过注入 runner 检查状态。
  - FreeCut 内置能力注册后可以通过 registry 路由本地转写、嵌入、语音合成和音乐生成。

## 关键决策

- T039 不在浏览器里直接执行 shell；本地命令状态检查通过 `runCommand` 注入，后续本地服务/桌面桥接实现 runner。
- 本地 HTTP provider 只做 health/status，不复用云端 provider 的 Authorization 流程。
- “UI 明确状态”先落为 `LocalModelHealth` 数据结构，T041 UI 直接展示 status/message。
- FreeCut 已有本地能力被建模为普通 `ModelProfile` + `ModelCapabilityBinding`，避免后续技能编排写特殊分支。

## 验证

- `PATH="/Users/changzechuan/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH" node node_modules/.bin/vp check --fix src/types/hyperframes.ts src/features/hyperframes-runtime/model-center/providers/localModelProvider.ts src/features/hyperframes-runtime/model-center/providers/localModelProvider.test.ts`
- `PATH="/Users/changzechuan/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH" node node_modules/.bin/vp check --fix src/features/hyperframes-runtime/model-center/providers/index.ts src/features/hyperframes-runtime/model-center/index.ts src/features/hyperframes-runtime/index.ts`
- `PATH="/Users/changzechuan/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH" node node_modules/.bin/vp test run src/features/hyperframes-runtime/model-center/providers/localModelProvider.test.ts`
- `PATH="/Users/changzechuan/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH" node node_modules/.bin/vp test run src/features/hyperframes-runtime/model-center/modelRegistry.test.ts src/features/hyperframes-runtime/model-center/providers/openAICompatibleProvider.test.ts src/features/hyperframes-runtime/model-center/providers/privateGatewayProvider.test.ts src/features/hyperframes-runtime/model-center/providers/localModelProvider.test.ts`
- `PATH="/Users/changzechuan/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH" node node_modules/.bin/vp test run $(rg --files src/features/hyperframes-runtime src/features/preview src/types src/shared/projects/migrations | rg '(hyperframes|HyperFrames|timeline-hyperframes|studio|project|parser|preview-overlay|migrations|modelRegistry|Provider).*[.]test[.](ts|tsx)$') src/features/timeline/components/timeline-item/use-timeline-item-pointer-handlers.test.tsx`
- `PATH="/Users/changzechuan/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH" node scripts/check-hyperframes-runtime-imports.mjs`
- `git diff --check`
- `PATH="/Users/changzechuan/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH" node node_modules/.bin/vp check --no-fmt`
- `PATH="/Users/changzechuan/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH" node node_modules/.bin/vp build`

## 备注

- 首次合并检查触发 Vite+/tsgolint SIGSEGV；拆分检查后 T039 所有涉及文件均通过。该崩溃是工具进程崩溃，没有产生代码诊断。
- T039 定向测试通过：1 个测试文件、4 个测试通过。
- 模型中心 provider 组合测试通过：4 个测试文件、14 个测试通过。
- HyperFrames/model-center 相关回归通过：37 个测试文件、166 个测试通过。
- `check-hyperframes-runtime-imports` 确认没有直接 `@hyperframes/*` import。
- `git diff --check` 通过。
- `vp check --no-fmt` 通过，仍有 44 个既有 warning，主要来自 `.codex/skills/translate-app-locales/scripts/check-locale-coverage.mjs`、`headless/*.mjs` 的 `console.log` 和 `src/features/keyframes/components/dopesheet-editor/dopesheet-timeline-cells.tsx:35` 的 `react(only-export-components)`。
- `vp build` 通过；构建日志只有既有 dynamic import、chunk size 和 plugin timing 警告。
