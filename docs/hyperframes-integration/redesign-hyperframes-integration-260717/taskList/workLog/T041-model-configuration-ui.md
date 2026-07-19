# T041 实现模型配置 UI

## 任务

实现模型配置 UI，交付供应商、能力映射、凭据、成本、隐私权限页签。验收重点是：可配置云端、私有网关、本地模型。

## 完成内容

- 新增 `src/features/hyperframes-runtime/model-center/modelCenterStore.ts`：
  - 建立 `useHyperFramesModelCenterStore`，用 `zustand/persist` 保存模型中心 UI 配置。
  - 默认提供四类 profile：OpenAI-compatible 云端、私有网关、本地 HTTP、FreeCut 内置本地能力。
  - 默认提供文本规划、HyperFrames 代码生成、音频转写能力绑定。
  - 默认提供保守工具策略、私有网关策略、凭据 metadata 和预算策略。
  - 提供 profile、model descriptor、capability binding、tool policy、credential metadata、budget policy 的更新动作。
  - 只持久化 credential ref 和 metadata，不保存明文 secret。
- 新增 `src/features/hyperframes-runtime/model-center/ModelCapabilityCenter.tsx`：
  - 五个页签：Providers、Bindings、Credentials、Budget、Privacy。
  - Providers 页签可添加云端、私有网关、本地 HTTP provider，并编辑 baseUrl、endpoint、credential ref、默认模型、启用状态和模型能力。
  - Bindings 页签可配置能力、质量档、provider/model 绑定、启用状态和单任务费用上限。
  - Credentials 页签只保存凭据引用、作用域和标签，不提供明文 secret 输入。
  - Budget 页签显示按当前模型 cost 配置计算的费用估算，并在超预算或超过确认阈值时显示确认状态。
  - Privacy 页签可配置工具权限、网络策略关联、素材访问范围、上传模式和本地路径策略。
- 接入现有设置弹窗：
  - 在 `src/features/editor/components/settings-dialog.tsx` 的 AI 分区挂载模型与能力中心。
  - 设置弹窗宽度从 `max-w-2xl` 放宽到 `max-w-4xl`，避免五页签配置面板挤压。
- 补充导出入口：
  - `src/features/hyperframes-runtime/model-center/index.ts`。
  - `src/features/hyperframes-runtime/index.ts`。
- 新增测试：
  - `modelCenterStore.test.ts` 验证默认配置覆盖云端、私有网关、本地和 FreeCut 内置 provider，并验证 credential metadata 不保存 secret。
  - `ModelCapabilityCenter.test.tsx` 验证五页签渲染、凭据 ref 保存、预算超限确认状态。

## 关键决策

- T041 只实现模型配置 UI 和本地持久化配置，不在 UI 中保存或输入明文密钥；真实系统钥匙串、团队密钥服务和调用审计留给后续安全/隐私任务。
- 模型中心放在 `hyperframes-runtime/model-center` 下，设置弹窗只负责挂载，后续 AI 面板、顶部状态入口和生成流程可以复用同一组件和 store。
- 默认 profile 使用可编辑的示例配置，避免把具体供应商作为硬编码唯一选择。
- 成本页签复用 T040 的 `estimateModelCost()` 和 `evaluateBudgetGate()`，保证 UI 和执行前门禁使用同一预算规则。

## 验证

- `PATH="/Users/changzechuan/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH" node node_modules/.bin/vp check --fix src/features/hyperframes-runtime/model-center/modelCenterStore.ts src/features/hyperframes-runtime/model-center/ModelCapabilityCenter.tsx src/features/hyperframes-runtime/model-center/modelCenterStore.test.ts src/features/hyperframes-runtime/model-center/ModelCapabilityCenter.test.tsx src/features/hyperframes-runtime/model-center/index.ts src/features/hyperframes-runtime/index.ts src/features/editor/components/settings-dialog.tsx`
- `PATH="/Users/changzechuan/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH" node node_modules/.bin/vp test run src/features/hyperframes-runtime/model-center/modelCenterStore.test.ts src/features/hyperframes-runtime/model-center/ModelCapabilityCenter.test.tsx`
- `PATH="/Users/changzechuan/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH" node node_modules/.bin/vp test run src/features/hyperframes-runtime/model-center/modelCenterStore.test.ts src/features/hyperframes-runtime/model-center/ModelCapabilityCenter.test.tsx src/features/hyperframes-runtime/model-center/credentialCostBudget.test.ts src/features/hyperframes-runtime/model-center/modelRegistry.test.ts src/features/hyperframes-runtime/model-center/providers/openAICompatibleProvider.test.ts src/features/hyperframes-runtime/model-center/providers/privateGatewayProvider.test.ts src/features/hyperframes-runtime/model-center/providers/localModelProvider.test.ts`
- `PATH="/Users/changzechuan/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH" node node_modules/.bin/vp test run $(rg --files src/features/hyperframes-runtime src/features/preview src/types src/shared/projects/migrations | rg '(hyperframes|HyperFrames|timeline-hyperframes|studio|project|parser|preview-overlay|migrations|modelRegistry|Provider|Budget|credentialCostBudget|ModelCapabilityCenter|modelCenterStore).*[.]test[.](ts|tsx)$') src/features/timeline/components/timeline-item/use-timeline-item-pointer-handlers.test.tsx`
- `PATH="/Users/changzechuan/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH" node scripts/check-hyperframes-runtime-imports.mjs`
- `git diff --check`
- `PATH="/Users/changzechuan/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH" node node_modules/.bin/vp check --no-fmt`
- `PATH="/Users/changzechuan/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH" node node_modules/.bin/vp build`

## 备注

- T041 目标测试通过：2 个测试文件、6 个测试通过。
- 模型中心回归通过：7 个测试文件、25 个测试通过。
- HyperFrames 相关回归通过：40 个测试文件、177 个测试通过。
- `check-hyperframes-runtime-imports` 确认没有直接 `@hyperframes/*` import。
- `git diff --check` 通过。
- `vp check --no-fmt` 通过，仍有 44 个既有 warning，主要来自 `.codex/skills/translate-app-locales/scripts/check-locale-coverage.mjs`、`headless/*.mjs` 的 `console.log` 和 `src/features/keyframes/components/dopesheet-editor/dopesheet-timeline-cells.tsx:35` 的 `react(only-export-components)`。
- `vp build` 通过；构建日志只有既有 dynamic import、chunk size 和 plugin timing 警告。
