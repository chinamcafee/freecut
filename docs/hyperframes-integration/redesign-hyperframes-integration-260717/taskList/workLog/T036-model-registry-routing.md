# T036 实现模型注册表和能力路由

## 任务

实现模型注册表和能力路由，交付“按任务需求选择模型组合”。验收重点是：不同能力可以绑定不同 provider。

## 完成内容

- 新增 `src/features/hyperframes-runtime/model-center/modelRegistry.ts`：
  - `createModelRegistry()` 从 `HyperFramesIntegrationState` 构建模型注册表。
  - `listProfiles()` / `listBindings()` 提供 profile 和能力绑定查询。
  - `selectCapability()` 按单个 `ModelRequirement` 选择模型。
  - `routeModelCapabilities()` 按多个能力需求生成组合路由计划。
- 新增路由模型：
  - `ModelRequirement` 支持 capability、质量档、是否必需、单任务费用上限、隐私模式和所需工具权限。
  - `ModelRoute` 返回绑定、profile、model、tool policy 和 fallback 使用情况。
  - `ModelRoutingPlan` 汇总 routes、missing、估算最大费用、是否需要网络、是否需要确认和是否可继续。
- 路由规则：
  - 只选择 enabled binding 和 enabled profile。
  - modelId 必须存在于对应 profile 的 `models`。
  - 质量档按 draft、standard、high 排序，低质量不能满足高质量需求。
  - `privacyModes` 可以限制本地/私有网关/云端。
  - `maxCostPerTask` 会阻止超过预算的 binding。
  - required tool permission 如果在 policy 中为 denied，则阻断该 route。
  - 主模型不可用时可以使用 binding fallback。
- 新增 `model-center/index.ts` 并从 `src/features/hyperframes-runtime/index.ts` 导出 registry/router API。
- 新增测试：
  - 覆盖 text planning 路由到 cloud provider。
  - 覆盖 HyperFrames code 路由到 private gateway provider。
  - 覆盖 audio transcription 路由到 FreeCut built-in provider。
  - 覆盖主 provider disabled 时切换到 local fallback。
  - 覆盖缺少网络工具权限时返回 missing issue。

## 关键决策

- T036 是纯路由层，不发起模型网络请求，也不写 FreeCut/HyperFrames 项目文件。
- 未显式绑定 `toolPolicyId` 时使用 T035 的 `DEFAULT_TOOL_POLICY`，保持默认保守。
- `requires-confirmation` 的工具权限可以被选中，但 `denied` 会阻断；确认动作由 T034/T后续调用流程处理。
- 路由计划中的 `requiresNetwork` 来自 provider 类型，方便后续生成计划向用户展示网络和费用预估。
- optional requirement 缺失不会阻断 `canProceed`，required requirement 缺失才阻断。

## 验证

- `PATH="/Users/changzechuan/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH" node node_modules/.bin/vp check --fix src/features/hyperframes-runtime/model-center/modelRegistry.ts src/features/hyperframes-runtime/model-center/modelRegistry.test.ts src/features/hyperframes-runtime/model-center/index.ts src/features/hyperframes-runtime/index.ts`
- `PATH="/Users/changzechuan/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH" node node_modules/.bin/vp test run src/features/hyperframes-runtime/model-center/modelRegistry.test.ts`
- `PATH="/Users/changzechuan/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH" node node_modules/.bin/vp test run $(rg --files src/features/hyperframes-runtime src/features/preview src/types src/shared/projects/migrations | rg '(hyperframes|HyperFrames|timeline-hyperframes|studio|project|parser|preview-overlay|migrations|modelRegistry).*[.]test[.](ts|tsx)$') src/features/timeline/components/timeline-item/use-timeline-item-pointer-handlers.test.tsx`
- `PATH="/Users/changzechuan/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH" node scripts/check-hyperframes-runtime-imports.mjs`
- `git diff --check`
- `PATH="/Users/changzechuan/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH" node node_modules/.bin/vp check --no-fmt`
- `PATH="/Users/changzechuan/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH" node node_modules/.bin/vp build`

## 备注

- T036 定向测试通过：1 个测试文件、2 个测试通过。
- HyperFrames 相关回归通过：34 个测试文件、154 个测试通过。
- `check-hyperframes-runtime-imports` 确认没有直接 `@hyperframes/*` import。
- `git diff --check` 通过。
- `vp check --no-fmt` 通过，仍有 44 个既有 warning，主要来自 `.codex/skills/translate-app-locales/scripts/check-locale-coverage.mjs`、`headless/*.mjs` 的 `console.log` 和 `src/features/keyframes/components/dopesheet-editor/dopesheet-timeline-cells.tsx:35` 的 `react(only-export-components)`。
- `vp build` 通过；构建日志只有既有 dynamic import、chunk size 和 plugin timing 警告。
