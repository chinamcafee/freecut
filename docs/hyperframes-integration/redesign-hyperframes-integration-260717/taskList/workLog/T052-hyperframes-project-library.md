# T052 实现 HyperFrames 项目库

## 任务

在 FreeCut 左侧栏实现 HyperFrames 项目库，显示项目缩略图、状态和时间线引用，并提供打开、插入、导出、校验和安全删除动作。

## 完成内容

- 新增 `HyperFramesProjectLibrary`：
  - 以项目卡片展示缩略图区域、画布尺寸、诊断状态、引用次数和渲染缓存状态。
  - 提供插入时间线、打开 Studio、导出项目目录、重新校验和删除动作。
  - 删除动作在项目仍被时间线引用时强制禁用。
- 新增 `projectLibraryModel.ts`：
  - 从 manifest、当前时间线项和渲染缓存生成稳定的项目库视图模型。
  - 引用次数直接基于当前源链接组合项计算，避免显示状态与实际时间线不一致。
  - 根据阻塞/警告诊断和 render signature 判断项目及缓存状态。
- 新增 `HyperFramesProjectLibraryTab` 主界面适配器：
  - 通过 `HyperFramesProjectRepository` 加载当前 FreeCut 项目关联的项目目录。
  - 插入时创建源链接 `composition` 时间线项。
  - 打开时复用已有时间线项或构造项目上下文，并通过 Studio 事件桥打开内嵌工作室。
  - 导出时使用项目目录打包器生成 `.hyperframes.zip`。
  - 校验时调用统一 lint adapter，并把诊断摘要写回 manifest。
  - 删除时再次检查引用数，只删除未引用目录。
- 在编辑器侧栏增加独立 `hyperframes` 页签和 `HyperFrames Projects` 入口，并采用懒加载。
- 新增 2 个核心测试，覆盖引用/诊断/缓存推导和动作门禁。

## 关键决策

- 项目库引用状态以当前时间线源链接项为准，而不是依赖可能滞后的计数字段。
- 项目目录操作全部通过 repository 适配器执行，UI 不直接访问外部 HyperFrames 仓库或任意磁盘路径。
- 导出复用既有项目目录 ZIP 协议；重新校验复用统一 lint adapter，避免形成第二套规则。
- 项目有引用时不向删除回调发出请求，UI 与执行层都保留门禁。

## 验证

- `PATH="/Users/changzechuan/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH" node node_modules/.bin/vp test run src/features/hyperframes-runtime/components/HyperFramesProjectLibrary.test.tsx`
- `PATH="/Users/changzechuan/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH" node node_modules/.bin/vp check --no-fmt src/features/hyperframes-runtime/components/HyperFramesProjectLibrary.tsx src/features/hyperframes-runtime/components/HyperFramesProjectLibrary.test.tsx src/features/hyperframes-runtime/components/projectLibraryModel.ts src/features/editor/components/hyperframes-project-library-tab.tsx src/features/editor/components/media-sidebar.tsx src/config/editor-workspaces.ts src/features/hyperframes-runtime/components/index.ts src/features/hyperframes-runtime/index.ts`
- `PATH="/Users/changzechuan/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH" node scripts/check-hyperframes-runtime-imports.mjs`
- `git diff --check`

## 结果

- T052 核心测试通过：1 个测试文件、2 个测试通过。
- 相关 8 个文件 lint 和类型检查通过，无警告。
- HyperFrames 直接依赖边界检查通过。
- `git diff --check` 通过。

## 主面板运行时验收补充（2026-07-19）

- 在真实项目库完成项目显示、插入时间线、选中源链接片段、重新校验和打开 Studio 验收。
- 时间线引用计数与删除门禁一致；被引用项目的删除操作保持禁用。
- 校验完成后发出项目更新事件，中央预览和属性面板可重新读取最新 manifest。
