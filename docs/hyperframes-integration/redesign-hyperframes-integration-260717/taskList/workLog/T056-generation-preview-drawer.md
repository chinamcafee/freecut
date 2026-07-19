# T056 实现生成结果预览抽屉

## 任务

实现技能生成结果的确认前预览，展示缩略/实时画面、文件列表、manifest、诊断、模型费用和导入策略，并确保未确认不写时间线。

## 完成内容

- 新增 `HyperFramesGenerationPreviewDrawer` 对话抽屉组件。
- 左侧使用受限 sandbox iframe 展示 `previewDocument.srcdoc`；存在阻塞诊断时显示不可预览状态。
- 右侧展示：
  - 项目文件和字节大小。
  - 资产列表。
  - 统一诊断列表。
  - manifest JSON。
  - 模型数量、token 和预计费用。
  - 可用导入策略及推荐策略。
- 底部提供 Discard 和 Confirm import；确认按钮严格受 `preview.canConfirmImport` 与 confirming 状态控制。
- 组件只发出策略选择、确认和丢弃回调，不直接修改 FreeCut 时间线。
- 新增正常确认和阻塞诊断门禁测试。

## 关键决策

- 预览抽屉直接消费 T049 的归一化 `HyperFramesSkillImportPreview`，不重复实现 lint、费用汇总或策略判断。
- iframe 使用预览文档给出的 sandbox 字符串，组件不扩大脚本权限。
- 时间线写入仍由 T050 的显式确认函数负责，预览 UI 不持有项目写权限。

## 验证

- `PATH="/Users/changzechuan/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH" node node_modules/.bin/vp test run src/features/hyperframes-runtime/components/HyperFramesGenerationPreviewDrawer.test.tsx`
- `PATH="/Users/changzechuan/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH" node node_modules/.bin/vp check --no-fmt src/features/hyperframes-runtime/components/HyperFramesGenerationPreviewDrawer.tsx src/features/hyperframes-runtime/components/HyperFramesGenerationPreviewDrawer.test.tsx src/features/hyperframes-runtime/components/index.ts src/features/hyperframes-runtime/index.ts`

## 结果

- T056 核心测试通过：1 个测试文件、2 个测试通过。
- 相关 4 个文件 lint 和类型检查通过，无警告。

## 主面板运行时补充（2026-07-19）

- 新增全局 `HyperFramesGenerationPreviewController` 和类型化 preview-ready 事件，由 Editor 顶层统一挂载抽屉。
- Controller 负责策略选择、显式确认、丢弃、错误 toast 和关闭状态；生成路径不再缺少 UI 消费者。
- Controller、事件和 Drawer 均有核心测试，未确认时不写项目目录或时间线。
