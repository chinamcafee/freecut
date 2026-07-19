# T055 实现右侧 HyperFrames 属性面板

## 任务

选中 HyperFrames 源链接片段时，在 FreeCut 右侧属性栏显示来源、变量、诊断、渲染缓存、模型来源和动作，并清楚区分片段级属性与 Studio DOM 属性。

## 完成内容

- 新增 `HyperFramesPropertiesPanel`，按 Source clip、Variables、Generation source、Diagnostics、Render、Actions 六组展示信息。
- 基础信息包含片段名称、源项目、活动组合、画布、帧率、源时长以及 FreeCut 外层起点/持续时间。
- 变量从 manifest 读取并生成字符串、数字、布尔和颜色控件：
  - 修改仅写入组件草稿态。
  - 用户点击 `Save variables` 后才通过 repository 写回 manifest。
- 生成来源展示 source、skill、prompt、model 和费用记录。
- 诊断展示统一 lint diagnostics；渲染组展示缓存、状态和当前预览/缓存引擎。
- 打开 Studio、重新渲染、导出源项目和转原生项复用统一命令桥。
- `PropertiesSidebar` 在单选 HyperFrames 源链接组合时懒加载专属面板；普通片段和多选仍使用原 ClipPanel。
- 新增变量保存门禁和动作路由测试，并保留原 PropertiesSidebar 回归测试。

## 关键决策

- 此面板只编辑 manifest 级变量和 FreeCut 外层片段信息；DOM 元素选择、样式和内部时间线属性仍由 Studio 管理。
- 变量草稿在用户显式保存前不调用 repository，满足预览态与持久态分离要求。
- 面板动作不直接实现文件写入或渲染，统一复用 T054 类型化命令边界。

## 验证

- `PATH="/Users/changzechuan/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH" node node_modules/.bin/vp test run src/features/hyperframes-runtime/components/HyperFramesPropertiesPanel.test.tsx src/features/editor/components/properties-sidebar/index.test.tsx`
- `PATH="/Users/changzechuan/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH" node node_modules/.bin/vp check --no-fmt src/features/hyperframes-runtime/components/HyperFramesPropertiesPanel.tsx src/features/hyperframes-runtime/components/HyperFramesPropertiesPanel.test.tsx src/features/hyperframes-runtime/components/index.ts src/features/hyperframes-runtime/index.ts src/features/editor/components/properties-sidebar/index.tsx`

## 结果

- T055 核心测试通过：2 个测试文件、7 个测试通过。
- 相关 5 个文件 lint 和类型检查通过，无警告。

## 主面板运行时验收补充（2026-07-19）

- 变量保存成功后新增项目更新事件，项目库、Player 和属性面板可以同步刷新 manifest。
- 在真实编辑器中修改并保存变量后验证预览更新，并将测试变量恢复为原值；保存门禁和更新事件测试通过。
