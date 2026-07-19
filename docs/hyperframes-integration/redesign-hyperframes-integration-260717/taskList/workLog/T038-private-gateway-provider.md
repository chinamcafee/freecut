# T038 实现私有网关 provider

## 任务

实现私有网关 provider，交付自定义 headers、代理和团队策略。验收重点是：私有网关不支持工具调用时计划能降级。

## 完成内容

- 扩展 `OpenAI-compatible` provider 底座：
  - 支持 `profile.customHeaders`。
  - 非敏感 header 直接发送 `value`。
  - 敏感 header 通过 `valueRef` 和 `resolveHeaderValueRef()` 在运行时解析。
  - 支持 `profile.proxyRef` 和 `resolveProxyUrl()`，请求 URL 可被代理层重写。
  - 保留 T037 的 `apiKeyRef` / `authRef` 运行时解析机制。
- 新增 `src/features/hyperframes-runtime/model-center/providers/privateGatewayProvider.ts`：
  - `createPrivateGatewayProvider()` 包装 OpenAI-compatible provider。
  - `PrivateGatewayTeamPolicy` 支持 policy id、audit tag、工具调用开关、允许能力、允许 host 和强制 proxy。
  - 默认向请求注入 `x-freecut-team-policy-id` 和可选 `x-freecut-audit-tag`。
  - `applyPrivateGatewayTeamPolicy()` 可把团队策略应用到 `ModelProfile`，过滤能力并关闭 `supportsToolCalls`。
  - `validateConnection()` 对 host/proxy/team policy 不满足的配置返回结构化错误。
- 加强 T036 router：
  - registry 现在会校验 model 自身声明了 binding 的 capability。
  - 这保证团队策略移除 `tool.calling` 后，即使存在旧 binding，也不会误选不支持工具调用的模型。
- 新增测试：
  - 验证 custom headers、敏感 header 引用、Authorization、team policy headers 经过 proxy 发送。
  - 验证 `allowToolCalls: false` 会移除 `tool.calling`，路由计划能把工具调用作为 optional missing 降级，仍允许 code capability 继续。
  - 验证团队策略能阻止不在 allowlist 的 gateway host。
  - 验证强制 proxy 时缺少 `proxyRef` 会返回 `missing-configuration`。

## 关键决策

- T038 私有网关仍沿用 OpenAI-compatible 请求协议；私有差异集中在 header、proxy 和 team policy。
- `valueRef` 与 `apiKeyRef` 一样只在运行时解析，不进入 FreeCut 项目 JSON。
- 团队策略先转换 profile 能力，再交给 registry 做统一能力路由；这样技能编排可以看到“工具调用不可用”并降级计划。
- private gateway provider 不直接修改 `HyperFramesIntegrationState`，只返回 policy-applied profile，调用方可选择存入临时路由上下文。

## 验证

- `PATH="/Users/changzechuan/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH" node node_modules/.bin/vp check --fix src/features/hyperframes-runtime/model-center/modelRegistry.ts src/features/hyperframes-runtime/model-center/providers/openAICompatibleProvider.ts src/features/hyperframes-runtime/model-center/providers/privateGatewayProvider.ts src/features/hyperframes-runtime/model-center/providers/privateGatewayProvider.test.ts src/features/hyperframes-runtime/model-center/providers/index.ts src/features/hyperframes-runtime/model-center/index.ts src/features/hyperframes-runtime/index.ts`
- `PATH="/Users/changzechuan/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH" node node_modules/.bin/vp test run src/features/hyperframes-runtime/model-center/modelRegistry.test.ts src/features/hyperframes-runtime/model-center/providers/openAICompatibleProvider.test.ts src/features/hyperframes-runtime/model-center/providers/privateGatewayProvider.test.ts`
- `PATH="/Users/changzechuan/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH" node node_modules/.bin/vp test run $(rg --files src/features/hyperframes-runtime src/features/preview src/types src/shared/projects/migrations | rg '(hyperframes|HyperFrames|timeline-hyperframes|studio|project|parser|preview-overlay|migrations|modelRegistry|Provider).*[.]test[.](ts|tsx)$') src/features/timeline/components/timeline-item/use-timeline-item-pointer-handlers.test.tsx`
- `PATH="/Users/changzechuan/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH" node scripts/check-hyperframes-runtime-imports.mjs`
- `git diff --check`
- `PATH="/Users/changzechuan/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH" node node_modules/.bin/vp check --no-fmt`
- `PATH="/Users/changzechuan/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH" node node_modules/.bin/vp build`

## 备注

- T038 模型中心测试通过：3 个测试文件、10 个测试通过。
- HyperFrames/model-center 相关回归通过：36 个测试文件、162 个测试通过。
- `check-hyperframes-runtime-imports` 确认没有直接 `@hyperframes/*` import。
- `git diff --check` 通过。
- `vp check --no-fmt` 通过，仍有 44 个既有 warning，主要来自 `.codex/skills/translate-app-locales/scripts/check-locale-coverage.mjs`、`headless/*.mjs` 的 `console.log` 和 `src/features/keyframes/components/dopesheet-editor/dopesheet-timeline-cells.tsx:35` 的 `react(only-export-components)`。
- `vp build` 通过；构建日志只有既有 dynamic import、chunk size 和 plugin timing 警告。
