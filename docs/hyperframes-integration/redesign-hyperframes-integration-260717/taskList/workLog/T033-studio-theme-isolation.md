# T033 接入 Studio 主题和样式隔离

## 任务

接入 Studio 主题和样式隔离，交付 `.freecut-hyperframes-studio` 根类、CSS variables 映射和图标策略。验收重点是：打开工作室不改变 FreeCut 主界面样式。

## 完成内容

- 扩展 `studioThemeAdapter`：
  - 保留 `.freecut-hyperframes-studio` 作为 Studio 根类。
  - 新增 `FREECUT_STUDIO_THEME_VARIABLES`，把 Studio 局部 token 映射到 FreeCut 的 CSS variables。
  - 新增 `FREECUT_STUDIO_ICON_LIBRARY = 'lucide-react'`，明确迁移后的图标策略。
  - `createFreeCutStudioThemeTokens()` 返回 root class、surface class、root inline style 和 icon library。
- 更新 `FreeCutStudioShell`：
  - 在 Studio 根节点挂载局部 CSS variables。
  - 标记 `data-hf-studio-icon-library="lucide-react"`。
  - 不写 `documentElement`、`:root` 或其它全局节点。
- 更新迁移后的 `NLELayout`：
  - 主 Studio surface 使用 `--hf-studio-*` 变量控制背景、文本、panel 和 border。
  - 避免引入上游 Studio 全局 Tailwind preset 或 reset。
- 补充测试：
  - `studioThemeAdapter.test.ts` 覆盖 token 映射和图标策略。
  - `FreeCutStudioShell.test.tsx` 覆盖根类、图标策略、root-scoped CSS variables，以及 `document.documentElement` 未被污染。

## 关键决策

- T033 使用“FreeCut CSS variables -> Studio 局部 CSS variables”的映射层，而不是直接复制上游 `packages/studio` 的全局样式。
- CSS variables 通过 Shell 根节点 inline style 注入，作用域限定在 `.freecut-hyperframes-studio` 内。
- 上游 Phosphor 风格图标通过 `PhosphorIconShim` 映射到 FreeCut 已使用的 `lucide-react`，不引入第二套全局 icon 样式。
- 本任务只替换 Studio 框架层的主色板 token；更细颗粒度的组件视觉统一可在后续迁移 Studio 面板时继续推进。

## 验证

- `PATH="/Users/changzechuan/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH" node node_modules/.bin/vp check --fix src/features/hyperframes-runtime/bridges/studio-bridge/studioThemeAdapter.ts src/features/hyperframes-runtime/bridges/studio-bridge/studioThemeAdapter.test.ts src/features/hyperframes-runtime/bridges/studio-bridge/FreeCutStudioShell.tsx src/features/hyperframes-runtime/bridges/studio-bridge/FreeCutStudioShell.test.tsx src/features/hyperframes-runtime/upstream/studio/components/nle/NLELayout.tsx src/features/hyperframes-runtime/bridges/studio-bridge/index.ts src/features/hyperframes-runtime/index.ts`
- `PATH="/Users/changzechuan/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH" node node_modules/.bin/vp test run src/features/hyperframes-runtime/bridges/studio-bridge/studioThemeAdapter.test.ts src/features/hyperframes-runtime/bridges/studio-bridge/FreeCutStudioShell.test.tsx src/features/hyperframes-runtime/upstream/studio/freecut-runtime-mirror.test.tsx`
- `PATH="/Users/changzechuan/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH" node node_modules/.bin/vp test run $(rg --files src/features/hyperframes-runtime src/features/preview src/types src/shared/projects/migrations | rg '(hyperframes|HyperFrames|timeline-hyperframes|studio|project|parser|preview-overlay|migrations).*[.]test[.](ts|tsx)$') src/features/timeline/components/timeline-item/use-timeline-item-pointer-handlers.test.tsx`
- `PATH="/Users/changzechuan/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH" node node_modules/.bin/vp check --no-fmt`
- `node scripts/check-hyperframes-runtime-imports.mjs`
- `git diff --check`
- `PATH="/Users/changzechuan/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH" node node_modules/.bin/vp build`

## 备注

- T033 定向测试通过：3 个测试文件、10 个测试通过。
- HyperFrames 相关回归通过：32 个测试文件、149 个测试通过。
- `check-hyperframes-runtime-imports` 确认没有直接 `@hyperframes/*` import。
- `vp check --no-fmt` 通过，仍有 44 个既有 warning，主要来自 `headless/*.mjs`、`.codex/skills/translate-app-locales/scripts/check-locale-coverage.mjs` 的 `console.log` 和 `src/features/keyframes/components/dopesheet-editor/dopesheet-timeline-cells.tsx:35` 的 `react(only-export-components)`。
- `vp build` 通过；构建日志只有既有 dynamic import、chunk size 和 plugin timing 警告。
