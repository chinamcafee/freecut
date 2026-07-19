# T035 定义模型配置、能力和权限类型

## 任务

定义模型配置、能力和权限类型，交付 `ModelProfile`、`ModelCapabilityBinding`、`ToolPolicy` 和 `MaterialScope`。验收重点是：覆盖文本、视觉、音频、代码、工具调用、成本和隐私，并且项目 JSON 不保存 API key 明文。

## 完成内容

- 扩展 `src/types/hyperframes.ts`：
  - 新增 `MODEL_CAPABILITIES` / `ModelCapability`，覆盖文本规划、推理、HyperFrames 代码生成/修复、视觉理解、音频转写/合成、图像/音乐/音效生成、嵌入检索、网页理解、工具调用和渲染辅助。
  - 新增 `ModelProfile`，支持 cloud、local、gateway、FreeCut built-in 四类 provider。
  - 新增 `ModelDescriptor`、`ModelContextLimits`、`ModelUnitCost`、`ModelRateLimit`、`ModelTimeoutPolicy` 和安全请求头引用。
  - 新增 `ModelCapabilityBinding`，支持能力到 profile/model 的绑定、fallback、质量档、单任务预算和超额确认阈值。
  - 新增 `MaterialScope`，显式建模项目上下文、时间线、素材名、源码、截图、音频、视频帧、本地路径、上传模式和日志脱敏。
  - 新增 `TOOL_PERMISSIONS` / `ToolPermission` / `ToolPolicy`，覆盖读取项目上下文、读取源码、提出源码写入、提出时间线写入、运行技能、网络、本地文件、渲染和缓存访问。
  - 新增 `DEFAULT_MATERIAL_SCOPE` 和 `DEFAULT_TOOL_POLICY`，默认只允许项目摘要和缓存访问，写入走 proposal + confirmation，网络访问默认需要确认。
- 扩展模型使用摘要：
  - `HyperFramesModelUsageSummary` 增加 capability、taskId、inputHash 和 outputHash，便于后续审计记录关联模型、能力和输入输出规模。
- 扩展 `HyperFramesIntegrationState`：
  - `modelProfiles` 改为保存完整 `ModelProfile`。
  - 新增 `modelCapabilityBindings` 和 `toolPolicies` 映射。
- 更新项目迁移默认值：
  - 新项目/旧项目迁移时初始化空 `modelCapabilityBindings` 和 `toolPolicies`。
  - 保留已有 `modelProfiles`、能力绑定和工具策略映射。
- 更新测试 fixture：
  - 补齐 HyperFrames integration state 新字段。
  - 新增模型配置测试，构造 gateway provider、能力绑定、工具策略和素材范围。
  - 验证 capability 覆盖文本、视觉、音频、代码和工具调用。
  - 验证项目 JSON 中只有 `apiKeyRef` 等引用，不包含 `sk-`、`Authorization` 或 `Bearer ` 这类明文密钥/鉴权头痕迹。

## 关键决策

- T035 只定义类型和项目状态结构，不实现 provider 注册表、连接测试或 UI；这些留给 T036/T037/T041。
- `ModelProfile` 允许保存 `authRef` / `apiKeyRef`，但不提供 `apiKey`、`secret` 或 bearer token 字段。
- 敏感 header 必须用 `valueRef` 表示；非敏感 header 才允许直接保存 `value`。
- `ToolPolicy.writeMode` 只有 `disabled` 和 `proposal-requires-confirmation`，避免模型绕过 T034 的确认写入流程。
- 默认素材范围采用最小披露：项目摘要、时间线 metadata、素材名和日志脱敏；源码、截图、音频、视频帧默认不发送。

## 验证

- `PATH="/Users/changzechuan/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH" node node_modules/.bin/vp check --fix src/types/hyperframes.ts src/types/hyperframes.test.ts src/shared/projects/migrations/migrations.ts src/shared/projects/migrations/index.test.ts src/features/preview/components/hyperframes-preview-overlay.test.tsx`
- `PATH="/Users/changzechuan/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH" node node_modules/.bin/vp test run src/types/hyperframes.test.ts src/shared/projects/migrations/index.test.ts src/features/preview/components/hyperframes-preview-overlay.test.tsx`
- `PATH="/Users/changzechuan/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH" node node_modules/.bin/vp test run $(rg --files src/features/hyperframes-runtime src/features/preview src/types src/shared/projects/migrations | rg '(hyperframes|HyperFrames|timeline-hyperframes|studio|project|parser|preview-overlay|migrations).*[.]test[.](ts|tsx)$') src/features/timeline/components/timeline-item/use-timeline-item-pointer-handlers.test.tsx`
- `PATH="/Users/changzechuan/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH" node scripts/check-hyperframes-runtime-imports.mjs`
- `git diff --check`
- `PATH="/Users/changzechuan/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH" node node_modules/.bin/vp check --no-fmt`
- `PATH="/Users/changzechuan/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH" node node_modules/.bin/vp build`

## 备注

- T035 定向测试通过：3 个测试文件、16 个测试通过。
- HyperFrames 相关回归通过：33 个测试文件、152 个测试通过。
- `check-hyperframes-runtime-imports` 确认没有直接 `@hyperframes/*` import。
- `git diff --check` 通过。
- `vp check --no-fmt` 通过，仍有 44 个既有 warning，主要来自 `.codex/skills/translate-app-locales/scripts/check-locale-coverage.mjs`、`headless/*.mjs` 的 `console.log` 和 `src/features/keyframes/components/dopesheet-editor/dopesheet-timeline-cells.tsx:35` 的 `react(only-export-components)`。
- `vp build` 通过；构建日志只有既有 dynamic import、chunk size 和 plugin timing 警告。
