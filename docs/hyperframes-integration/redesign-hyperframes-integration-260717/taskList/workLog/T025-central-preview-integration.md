# T025 将 HyperFrames 预览接入 FreeCut 中央预览器

## 任务

将 HyperFrames 源链接组合接入 FreeCut 中央预览器：选中 HyperFrames composition 片段时加载对应项目 manifest 和活动 composition HTML，用 FreeCut 内部播放器桥接显示预览；普通 FreeCut 预览路径保持不回退；HyperFrames 加载或运行错误需要显示可追踪诊断。

## 完成内容

- 新增 `HyperFramesPreviewOverlay`：
  - 只在单选 timeline item 且 item 为 `type: 'composition'`、`sourceKind: 'hyperframes'` 时挂载。
  - 从当前 FreeCut 项目作用域读取 HyperFrames 项目仓储，加载 manifest 与 `activeCompositionPath` 对应 HTML。
  - 使用 `createPreviewDocument` 生成带 CSP、sandbox、session nonce、projectId 和 compositionPath 的 iframe srcdoc。
  - 通过 `HyperFramesPlayerHost` 渲染 HyperFrames player，并接入 `useFreeCutTimelineClock` 同步 seek、play、pause、倍速、静音与音量。
- `PreviewStage` 新增 `hyperFramesOverlay` 插槽，并在 `HeadlessPlayer` 之后渲染，保证普通 FreeCut 预览仍保持原有 player 结构。
- `VideoPreview` 接入 `HyperFramesPreviewOverlay`，把当前 timeline items 和 fps 传给 overlay。
- 增加中央预览测试：
  - 普通 FreeCut video item 被选中时不挂载 HyperFrames overlay。
  - HyperFrames 源链接 composition 被选中时会加载仓储文件并生成 preview srcdoc。
  - 缺失 composition 文件时显示诊断。
- 收窄播放器诊断模块对 `stableHyperFramesHash` 的导入，避免通过 `adapters/freecut-project` 桶文件把 parser mirror 和 Node API 误拉入浏览器构建图。

## 关键决策

- 中央预览中保留原 `HeadlessPlayer`，HyperFrames 只作为覆盖层接入，降低对普通 FreeCut 预览、快速 scrub 和 GPU overlay 的回归风险。
- HyperFrames 预览触发条件严格绑定 `sourceKind: 'hyperframes'` 与有效 `hyperframesProjectId/activeCompositionPath`，普通 composition 和普通素材不进入该路径。
- 仓储读取失败、manifest 缺失、composition 文件缺失、player error、runtime message rejected 都统一转换为 preview 诊断层显示。
- UI 层使用精确文件导入仓储和签名工具，避免把 FreeCut 不需要的 HyperFrames parser/lint/compiler 桶导出混入主预览包。

## 验证

- `PATH="/Users/changzechuan/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH" node node_modules/.bin/vp test run src/features/preview/components/hyperframes-preview-overlay.test.tsx src/features/preview/components/preview-stage.test.tsx src/features/preview/components/video-preview.sync.test.tsx src/features/hyperframes-runtime/bridges/player-bridge/HyperFramesPlayerHost.test.tsx src/features/hyperframes-runtime/bridges/player-bridge/useFreeCutTimelineClock.test.tsx`
- `PATH="/Users/changzechuan/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH" node node_modules/.bin/vp test run src/types/hyperframes.test.ts src/types/timeline-hyperframes.test.ts src/shared/projects/migrations/index.test.ts src/features/hyperframes-runtime src/features/preview/components/hyperframes-preview-overlay.test.tsx src/features/preview/components/preview-stage.test.tsx src/features/preview/components/video-preview.sync.test.tsx`
- `PATH="/Users/changzechuan/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH" node scripts/check-hyperframes-runtime-imports.mjs`
- `git diff --check`
- `PATH="/Users/changzechuan/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH" node node_modules/.bin/vp check --no-fmt src vite.config.ts`
- `PATH="/Users/changzechuan/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH" node node_modules/.bin/vp build`

## 备注

- T025 窄测试结果：5 个测试文件、73 个测试通过。
- T014-T025 联合测试结果：25 个测试文件、160 个测试通过。
- `check-hyperframes-runtime-imports` 确认没有直接 `@hyperframes/*` import。
- `vp check` 仍有既有 `react(only-export-components)` 警告，位置为 `src/features/keyframes/components/dopesheet-editor/dopesheet-timeline-cells.tsx:35`，本任务未修改该文件。
- `vp build` 通过；修复后不再出现 HyperFrames parser mirror 引发的 `node:path/node:fs` browser externalized 警告，仍有项目既有动态导入、chunk 大小和插件耗时 warning。

## 主面板运行时验收补充（2026-07-19）

- FreeCut 基础 preview composition model 会排除 `sourceKind: 'hyperframes'` 的源链接组合，避免基础 renderer 报 `Sub-composition not found`；总时长仍按完整时间线计算。
- 中央 Player 覆盖层在真实编辑器中完成选中、播放、暂停和画面显示验收，普通 FreeCut 预览路径保持不变。
- 新增预览模型回归测试，浏览器冷启动日志未再出现 HyperFrames 子组合告警。
