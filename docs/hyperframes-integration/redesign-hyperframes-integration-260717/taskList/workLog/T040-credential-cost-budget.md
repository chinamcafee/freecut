# T040 实现凭据、成本和配额

## 任务

实现模型中心的 credential-store、cost-estimator 和 budget gate。验收重点是：密钥不进入项目文件；费用超限必须请求确认。

## 完成内容

- 新增 `src/features/hyperframes-runtime/model-center/credentialStore.ts`：
  - 定义 `CredentialScope`，覆盖 `user-local`、`team-secret` 和 `session-token` 三层凭据引用。
  - 定义 `CredentialStore` 接口，支持 `put()`、`get()`、`describe()`、`list()` 和 `delete()`。
  - 提供 `InMemoryCredentialStore` 测试/浏览器适配实现，明文 secret 保存在私有 Map 中，项目状态只保存 ref。
  - 提供 `createCredentialResolver()`，供 provider 通过引用解析运行时密钥。
- 新增 `src/features/hyperframes-runtime/model-center/costEstimator.ts`：
  - `estimateModelCost()` 按模型 cost 配置估算 token、cached token、图片、音频分钟、视频秒和请求费用。
  - 未配置价格但存在用量时记录 `unknownPricing`，避免把未知价格误判为免费。
  - `evaluateBudgetGate()` 在未知价格、单任务预算、项目预算、用户预算、团队预算、每日预算和确认阈值超限时返回 `requires-confirmation`。
  - budget gate 支持 `currentTaskSpent`、`retryCost` 和 `retryCostCounts`，用于运行中累计费用和失败重试费用提示。
- 新增 `src/features/hyperframes-runtime/model-center/credentialCostBudget.test.ts`：
  - 验证凭据引用可解析，但项目 JSON 和 store 序列化不包含明文密钥。
  - 验证 token、图片、音频和请求成本估算。
  - 验证超预算、运行中累计费用、重试费用、用户/团队配额和未知价格都会进入确认门。
- 补充导出入口：
  - `src/features/hyperframes-runtime/model-center/index.ts`。
  - `src/features/hyperframes-runtime/index.ts`。

## 关键决策

- T040 不实现系统钥匙串或远程密钥服务的具体后端；先落 `CredentialStore` 接口和内存实现，后续 T041/T069 可接入真实 UI、安全存储和团队网关。
- 明文密钥不进入 `HyperFramesIntegrationState`，模型配置只保存 `apiKeyRef`、`authRef` 或凭据引用。
- 未知价格按需要确认处理，避免模型配置不完整时绕过费用门禁。
- 预算检查使用 projected cost：本次预估费用 + 当前任务已花费 + 可计费重试费用，更符合运行中暂停确认的要求。

## 验证

- `PATH="/Users/changzechuan/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH" node node_modules/.bin/vp check --fix src/features/hyperframes-runtime/model-center/credentialStore.ts src/features/hyperframes-runtime/model-center/costEstimator.ts src/features/hyperframes-runtime/model-center/credentialCostBudget.test.ts src/features/hyperframes-runtime/model-center/index.ts src/features/hyperframes-runtime/index.ts`
- `PATH="/Users/changzechuan/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH" node node_modules/.bin/vp test run src/features/hyperframes-runtime/model-center/credentialCostBudget.test.ts`
- `PATH="/Users/changzechuan/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH" node node_modules/.bin/vp test run src/features/hyperframes-runtime/model-center/credentialCostBudget.test.ts src/features/hyperframes-runtime/model-center/modelRegistry.test.ts src/features/hyperframes-runtime/model-center/providers/openAICompatibleProvider.test.ts src/features/hyperframes-runtime/model-center/providers/privateGatewayProvider.test.ts src/features/hyperframes-runtime/model-center/providers/localModelProvider.test.ts`
- `PATH="/Users/changzechuan/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH" node node_modules/.bin/vp test run $(rg --files src/features/hyperframes-runtime src/features/preview src/types src/shared/projects/migrations | rg '(hyperframes|HyperFrames|timeline-hyperframes|studio|project|parser|preview-overlay|migrations|modelRegistry|Provider|Budget|credentialCostBudget).*[.]test[.](ts|tsx)$') src/features/timeline/components/timeline-item/use-timeline-item-pointer-handlers.test.tsx`
- `PATH="/Users/changzechuan/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH" node scripts/check-hyperframes-runtime-imports.mjs`
- `git diff --check`
- `PATH="/Users/changzechuan/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH" node node_modules/.bin/vp check --no-fmt`
- `PATH="/Users/changzechuan/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH" node node_modules/.bin/vp build`

## 备注

- T040 目标测试通过：1 个测试文件、5 个测试通过。
- 模型中心组合测试通过：5 个测试文件、19 个测试通过。
- HyperFrames 相关回归通过：38 个测试文件、171 个测试通过。
- `check-hyperframes-runtime-imports` 确认没有直接 `@hyperframes/*` import。
- `git diff --check` 通过。
- `vp check --no-fmt` 通过，仍有 44 个既有 warning，主要来自 `.codex/skills/translate-app-locales/scripts/check-locale-coverage.mjs`、`headless/*.mjs` 的 `console.log` 和 `src/features/keyframes/components/dopesheet-editor/dopesheet-timeline-cells.tsx:35` 的 `react(only-export-components)`。
- `vp build` 通过；构建日志只有既有 dynamic import、chunk size 和 plugin timing 警告。
