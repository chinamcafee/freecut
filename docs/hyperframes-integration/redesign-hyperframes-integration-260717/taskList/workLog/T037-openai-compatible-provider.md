# T037 实现云端 OpenAI-compatible provider

## 任务

实现云端 OpenAI-compatible provider，交付 baseUrl、modelId、apiKeyRef、结构化输出和错误映射。验收重点是：连接测试、超时、401、限流测试通过。

## 完成内容

- 新增 `src/features/hyperframes-runtime/model-center/providers/openAICompatibleProvider.ts`：
  - `createOpenAICompatibleProvider()` 创建 provider adapter。
  - `validateConnection()` 使用 profile 的 `baseUrl` / `endpoint` 调用 `/models` 做连接测试。
  - `invokeText()` 调用 `/chat/completions`，使用 `profile.defaultModel` 或请求级 `modelId`。
  - `apiKeyRef` / `authRef` 只通过 `resolveApiKey()` 在运行时解析，项目 JSON 仍只保存引用。
  - 支持 OpenAI-compatible `response_format: { type: 'json_schema' }`，用于结构化输出。
  - 返回 usage 摘要，按模型 cost 配置估算输入/输出 token 成本。
  - 支持 `timeoutPolicy.timeoutMs`、请求级 timeout 和外部 AbortSignal。
- 新增错误映射：
  - 401/403 -> `unauthorized`。
  - 408 或 AbortError -> `timeout`。
  - 429 -> `rate-limited`，解析 `retry-after` 为 `retryAfterMs`。
  - 4xx -> `bad-request`。
  - 5xx -> `server-error`。
  - 网络/解析异常 -> `network-error` / `invalid-response`。
- 新增导出入口：
  - `model-center/providers/index.ts`。
  - `model-center/index.ts`。
  - `features/hyperframes-runtime/index.ts`。
- 新增测试：
  - baseUrl 尾斜杠归一化和 `/models` 连接测试。
  - apiKeyRef 通过 resolver 转成内存中的 Authorization header。
  - chat completion 请求携带 JSON schema response format。
  - 结构化 JSON 输出解析和 token 成本估算。
  - 401、429、timeout 映射。
  - provider 错误结果不包含 `sk-` 或 `Bearer ` 明文。

## 关键决策

- T037 provider 只负责调用模型，不写项目；模型结果仍必须进入 T034/T后续的 proposal/plan 对象后由用户确认。
- 凭据解析通过依赖注入完成，provider 不读取本地密钥存储，也不把密钥写回 project state。
- `validateConnection()` 返回 `{ ok, modelIds, error }`，便于后续 UI 展示连接状态而不是抛出未捕获异常。
- `invokeText()` 对失败抛出 `OpenAICompatibleProviderError`，方便调用方按错误码决定降级、重试或要求用户处理。
- T037 暂不实现私有网关自定义 header/proxy/team policy；这些属于 T038。

## 验证

- `PATH="/Users/changzechuan/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH" node node_modules/.bin/vp check --fix src/features/hyperframes-runtime/model-center/providers/openAICompatibleProvider.ts src/features/hyperframes-runtime/model-center/providers/openAICompatibleProvider.test.ts src/features/hyperframes-runtime/model-center/providers/index.ts src/features/hyperframes-runtime/model-center/index.ts src/features/hyperframes-runtime/index.ts`
- `PATH="/Users/changzechuan/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH" node node_modules/.bin/vp test run src/features/hyperframes-runtime/model-center/providers/openAICompatibleProvider.test.ts`
- `PATH="/Users/changzechuan/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH" node node_modules/.bin/vp test run src/features/hyperframes-runtime/model-center/modelRegistry.test.ts src/features/hyperframes-runtime/model-center/providers/openAICompatibleProvider.test.ts`
- `PATH="/Users/changzechuan/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH" node node_modules/.bin/vp test run $(rg --files src/features/hyperframes-runtime src/features/preview src/types src/shared/projects/migrations | rg '(hyperframes|HyperFrames|timeline-hyperframes|studio|project|parser|preview-overlay|migrations|modelRegistry|Provider).*[.]test[.](ts|tsx)$') src/features/timeline/components/timeline-item/use-timeline-item-pointer-handlers.test.tsx`
- `PATH="/Users/changzechuan/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH" node scripts/check-hyperframes-runtime-imports.mjs`
- `git diff --check`
- `PATH="/Users/changzechuan/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH" node node_modules/.bin/vp check --no-fmt`
- `PATH="/Users/changzechuan/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH" node node_modules/.bin/vp build`

## 备注

- T037 provider 定向测试通过：1 个测试文件、5 个测试通过。
- 模型中心组合测试通过：2 个测试文件、7 个测试通过。
- HyperFrames/model-center 相关回归通过：35 个测试文件、159 个测试通过。
- `check-hyperframes-runtime-imports` 确认没有直接 `@hyperframes/*` import。
- `git diff --check` 通过。
- `vp check --no-fmt` 通过，仍有 44 个既有 warning，主要来自 `.codex/skills/translate-app-locales/scripts/check-locale-coverage.mjs`、`headless/*.mjs` 的 `console.log` 和 `src/features/keyframes/components/dopesheet-editor/dopesheet-timeline-cells.tsx:35` 的 `react(only-export-components)`。
- `vp build` 通过；构建日志只有既有 dynamic import、chunk size 和 plugin timing 警告。
