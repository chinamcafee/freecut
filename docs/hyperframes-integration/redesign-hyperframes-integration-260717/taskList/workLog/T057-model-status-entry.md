# T057 实现模型状态入口

## 任务

在 AI 面板顶部展示模型配置、密钥、额度、本地/离线和当前费用状态，并允许用户直接进入模型与能力中心。

## 完成内容

- 新增模型状态推导模型，区分 `configured`、`missing-key`、`quota-reached`、`local` 和 `offline`。
- 新增 `HyperFramesModelStatusButton`，显示当前状态、活动 profile 和可选当前任务费用。
- 将状态按钮挂载到 FreeCut AI 面板顶部。
- 新增打开模型中心的全局设置事件。
- Toolbar 订阅事件并打开 Settings；SettingsDialog 增加 `initialSection`，模型入口直接定位 AI/模型能力中心。
- 普通设置按钮仍打开 General，保持既有行为。
- 新增缺密钥、费用、本地模式和配额耗尽测试。

## 关键决策

- 状态来自统一 model center store，不复制模型配置。
- 本地 profile 在浏览器离线时仍显示可用本地模式；云 profile 离线时显示不可用。
- 费用仅作为当前任务上下文展示，不在状态按钮中修改预算。

## 验证

- `PATH="/Users/changzechuan/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH" node node_modules/.bin/vp test run src/features/hyperframes-runtime/model-center/HyperFramesModelStatusButton.test.tsx`
- `PATH="/Users/changzechuan/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH" node node_modules/.bin/vp check --no-fmt src/features/hyperframes-runtime/model-center/HyperFramesModelStatusButton.tsx src/features/hyperframes-runtime/model-center/HyperFramesModelStatusButton.test.tsx src/features/hyperframes-runtime/model-center/modelStatus.ts src/features/hyperframes-runtime/model-center/index.ts src/features/hyperframes-runtime/index.ts src/features/editor/components/ai-panel.tsx src/features/editor/components/settings-dialog.tsx src/features/editor/components/toolbar.tsx`

## 结果

- T057 核心测试通过：1 个测试文件、2 个测试通过。
- 相关 8 个文件 lint 和类型检查通过，无警告。

## 生成入口回归补充（2026-07-19）

- AI 生成计划确认前检查统一模型状态；没有可用 profile/凭据时显示 `Model unavailable`，并直接打开模型与能力中心。
- 模型不可用不会把计划错误标记为已确认，关闭设置后仍可再次点击 `Confirm plan`。
- 该失败路径已完成浏览器验收和组件测试；本轮未配置真实模型凭据，因此未执行实际 LLM 请求。
