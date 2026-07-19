# T032 迁移 Studio 第二批高级编辑能力

## 任务

迁移并适配 Studio 第二批高级编辑能力，交付 `DomEditOverlay`、`LayersPanel`、manual edits、studio motion、motion path 和 snap。验收重点是：能点击元素、修改属性、生成源码 patch，并能撤销。

## 完成内容

- 新增 `studioAdvancedEditing` 能力层：
  - 从当前 active HTML 中抽取可编辑 DOM layer。
  - 生成稳定的 mutation target，包括 `data-hf-id`、`id`、`data-composition-id` 和同标签 fallback index。
  - 读取 inline style、`data-*` 属性、几何信息、层级深度和 z-index。
  - 支持 inline style patch、text content patch、manual move patch、motion path patch。
  - 支持 snap guide 命中计算和 motion path 序列化。
- 新增 `DomEditOverlay`：
  - 在 Studio preview 上显示可点击的 DOM layer 框。
  - 支持选中态和 center snap guide 显示。
- 新增 `LayersPanel`：
  - 展示按视觉层级排序的 DOM layer。
  - 支持选择 layer、应用 style、文本修改、手动位移、motion path 和 undo。
- 接入 `FreeCutStudioPanels`：
  - 从 `session.activeContent` 抽取 layer。
  - 将 `DomEditOverlay` 覆盖到 `NLEPreview`。
  - 在右侧属性面板接入 `LayersPanel`。
  - 每次 patch 前保存当前 active file content 到本地 undo stack。
  - patch 通过 `applyDomEditOperationsToHtml()` 修改 active source，再走既有 `onActiveContentChange()`，不绕过 Studio session。
- 扩展 `FreeCutStudioShell` 测试：
  - 验证在 Studio surface 中选择 DOM layer。
  - 验证应用 style patch 后源码内容发生变化。
  - 验证 undo 可恢复原始源码。
- 修复 layer 标识读取：
  - `el.id` 在无 id 时是空字符串，不能用 `??` 直接 fallback。
  - 改为读取第一个非空标识，避免无 id 元素的 key/label 变成空字符串。

## 关键决策

- 本任务迁移的是 Studio 高级编辑的 FreeCut 适配子集，不把 Studio 原项目的完整编辑器状态机直接塞入 FreeCut 主 store。
- patch 入口复用 T030 迁入的 `sourceMutation` / `sourceStyleMutation`，保持源码级修改可审计。
- undo 先实现为 Studio active file 内的本地撤销栈；跨会话持久化和自然语言 patch 的确认/回滚 journal 留给 T034。
- 几何信息优先来自 inline style；没有显式尺寸时使用保守默认尺寸，保证 preview overlay 和 jsdom 测试环境都能选择元素。

## 验证

- `PATH="/Users/changzechuan/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH" node node_modules/.bin/vp check --fix src/features/hyperframes-runtime/upstream/studio/components/editor/studioAdvancedEditing.ts src/features/hyperframes-runtime/upstream/studio/components/editor/studioAdvancedEditing.test.tsx src/features/hyperframes-runtime/upstream/studio/components/editor/DomEditOverlay.tsx src/features/hyperframes-runtime/upstream/studio/components/editor/LayersPanel.tsx src/features/hyperframes-runtime/bridges/studio-bridge/FreeCutStudioPanels.tsx src/features/hyperframes-runtime/bridges/studio-bridge/FreeCutStudioShell.test.tsx src/features/hyperframes-runtime/upstream/studio/index.ts`
- `PATH="/Users/changzechuan/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH" node node_modules/.bin/vp test run src/features/hyperframes-runtime/upstream/studio/components/editor/studioAdvancedEditing.test.tsx src/features/hyperframes-runtime/bridges/studio-bridge/FreeCutStudioShell.test.tsx`
- `PATH="/Users/changzechuan/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH" node node_modules/.bin/vp test run $(rg --files src/features/hyperframes-runtime src/features/preview src/types src/shared/projects/migrations | rg '(hyperframes|HyperFrames|timeline-hyperframes|studio|project|parser|preview-overlay|migrations).*[.]test[.](ts|tsx)$') src/features/timeline/components/timeline-item/use-timeline-item-pointer-handlers.test.tsx`
- `PATH="/Users/changzechuan/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH" node node_modules/.bin/vp check --no-fmt`
- `node scripts/check-hyperframes-runtime-imports.mjs`
- `git diff --check`
- `PATH="/Users/changzechuan/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH" node node_modules/.bin/vp build`

## 备注

- T032 核心测试通过：2 个测试文件、8 个测试通过。
- HyperFrames 相关回归通过：31 个测试文件、148 个测试通过。
- `check-hyperframes-runtime-imports` 确认没有直接 `@hyperframes/*` import。
- `vp check --no-fmt` 通过，仍有既有 warning，主要来自 `.codex/skills/translate-app-locales/scripts/check-locale-coverage.mjs`、`headless/*.mjs` 的 `console.log` 和 `src/features/keyframes/components/dopesheet-editor/dopesheet-timeline-cells.tsx:35` 的 `react(only-export-components)`。
- 完整 `vp check` 的格式门禁仍会因为全仓库既有格式问题失败；本任务只对 T032 涉及文件执行了 `vp check --fix`，没有全仓库格式化 257 个无关文件。
- `vp build` 通过；构建日志只有既有 dynamic import、chunk size 和 plugin timing 警告。
