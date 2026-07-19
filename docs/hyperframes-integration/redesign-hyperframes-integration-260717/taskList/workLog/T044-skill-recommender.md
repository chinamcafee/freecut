# T044 实现技能推荐器

## 任务

实现技能推荐器，交付根据用户意图、素材、时间线位置、模型能力推荐技能的能力。验收重点是：动态图形、字幕、网站视频、解释视频等场景命中正确技能。

## 完成内容

- 新增 `src/features/hyperframes-runtime/bridges/skills-bridge/skillRecommender.ts`：
  - 定义 `HyperFramesSkillRecommendationContext`，接收用户文本、生成意图、素材、时间线上下文和可用模型能力。
  - 定义 `HyperFramesGenerationIntentKind`，覆盖 `new-video`、`timeline-insert`、`overlay`、`caption-package`、`recut`、`studio-edit`、`timeline-edit`。
  - 定义素材类型 `HyperFramesSkillRecommendationMaterialType`，覆盖 video、audio、image、text、url、figma、github-pr、remotion-source。
  - 定义 `HyperFramesSkillRecommendationTimelineContext`，支持 playhead、选中 item、选中 item 类型、target range。
  - 定义 `HyperFramesSkillRecommendation`，返回 skill、score、reasons、matchedInputKinds、missingModelRequirements。
- 实现 `recommendHyperFramesSkills()`：
  - 复用 T043 的 `HyperFramesSkillDefinition`。
  - 综合用户文本、素材类型、timeline selected item 类型、intent kind、model capabilities 计算推荐分。
  - 对缺失模型能力保留 `missingModelRequirements`，但不隐藏最佳 skill 匹配。
  - 保留 reasons，供后续主面板 UI 展示“为什么推荐这个技能”。
- 实现显式技能信号：
  - `embedded-captions`：字幕、caption/subtitle、当前选中 video、`caption-package`。
  - `talking-head-recut`：说话人视频包装、overlay card、lower-third、recut。
  - `motion-graphics`：动态图形、kinetic typography、stat count-up、chart、logo reveal、callout、title card、overlay/timeline insert。
  - `product-launch-video`：URL、website/site、product launch、promo、marketing、产品发布/宣传。
  - `faceless-explainer`：文章、topic、explainer、how-to、讲解/解释/科普。
  - `music-to-video`：music/audio/beat/lyric、音乐/节奏/歌词。
  - `pr-to-video`：GitHub PR、pull request、diff、changelog、代码变更。
  - `slideshow`：slideshow、presentation、deck、slides、幻灯片/演示/PPT。
  - `figma`：Figma import。
  - `remotion-to-hyperframes`：Remotion source port。
  - `general-video`：未命中特定技能时的通用视频兜底。
- 新增导出：
  - `src/features/hyperframes-runtime/bridges/skills-bridge/index.ts`
  - `src/features/hyperframes-runtime/index.ts`
- 新增 `src/features/hyperframes-runtime/bridges/skills-bridge/skillRecommender.test.ts`：
  - 验证动态图形/overlay 场景第一推荐 `motion-graphics`。
  - 验证选中 talking-head 视频加字幕场景第一推荐 `embedded-captions`。
  - 验证网站/产品宣传视频场景第一推荐 `product-launch-video`。
  - 验证文章/主题讲解视频场景第一推荐 `faceless-explainer`。
  - 验证缺失 transcription 模型能力时仍推荐字幕技能，并把缺口暴露在 `missingModelRequirements`。

## 关键决策

- 推荐器保持纯函数，不依赖 UI、Zustand 或文件系统；主面板、任务队列、本地服务都可以传入同一份 context。
- 推荐结果不把缺失模型能力当成硬过滤。用户可能仍然希望选择该技能，再由后续计划确认、模型中心和预算/权限门禁决定是否可执行。
- 推荐 reasons 和 matched input kinds 会保留，方便后续生成入口在 UI 中解释推荐依据，而不是只显示一个黑盒分数。
- T044 不执行技能脚本，也不直接接入任务队列；执行、权限和 sandbox 留给后续 T048 等任务。

## 验证

- `PATH="/Users/changzechuan/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH" node node_modules/.bin/vp check --fix src/features/hyperframes-runtime/bridges/skills-bridge/skillRecommender.ts src/features/hyperframes-runtime/bridges/skills-bridge/skillRecommender.test.ts src/features/hyperframes-runtime/bridges/skills-bridge/index.ts src/features/hyperframes-runtime/index.ts`
- `PATH="/Users/changzechuan/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH" node node_modules/.bin/vp test run src/features/hyperframes-runtime/bridges/skills-bridge/skillRecommender.test.ts`
- `PATH="/Users/changzechuan/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH" node node_modules/.bin/vp test run src/features/hyperframes-runtime/provenance/skills-resource-mirror.test.ts src/features/hyperframes-runtime/provenance/manifest.test.ts src/features/hyperframes-runtime/bridges/skills-bridge/skillDirectoryParser.test.ts src/features/hyperframes-runtime/bridges/skills-bridge/skillRecommender.test.ts`
- `PATH="/Users/changzechuan/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH" node node_modules/.bin/vp test run src/shared/projects/migrations/sanitize-text-motion.test.ts src/shared/projects/migrations/index.test.ts src/types/hyperframes.test.ts src/types/timeline-hyperframes.test.ts src/features/hyperframes-runtime/provenance/skills-resource-mirror.test.ts src/features/hyperframes-runtime/provenance/manifest.test.ts src/features/hyperframes-runtime/bridges/player-bridge/useFreeCutTimelineClock.test.tsx src/features/hyperframes-runtime/bridges/player-bridge/HyperFramesPlayerHost.test.tsx src/features/hyperframes-runtime/bridges/player-bridge/runtimeMessageProtocol.test.ts src/features/hyperframes-runtime/bridges/skills-bridge/skillDirectoryParser.test.ts src/features/hyperframes-runtime/bridges/skills-bridge/skillRecommender.test.ts src/features/preview/components/hyperframes-preview-overlay.test.tsx src/features/hyperframes-runtime/model-center/credentialCostBudget.test.ts src/features/hyperframes-runtime/model-center/modelCenterStore.test.ts src/features/hyperframes-runtime/model-center/modelRegistry.test.ts src/features/hyperframes-runtime/adapters/freecut-project/lint-adapter.test.ts src/features/hyperframes-runtime/adapters/freecut-project/parser-adapter.test.ts src/features/hyperframes-runtime/adapters/freecut-project/compiler-adapter.test.ts src/features/hyperframes-runtime/adapters/freecut-project/project-signatures.test.ts src/features/hyperframes-runtime/adapters/freecut-project/project-directory-bundle.test.ts src/features/hyperframes-runtime/adapters/freecut-project/runtime-adapter.test.ts src/features/hyperframes-runtime/adapters/freecut-project/file-system-project-repository.test.ts src/features/hyperframes-runtime/adapters/freecut-project/project-path-guards.test.ts src/features/hyperframes-runtime/adapters/freecut-project/project-repository.test.ts src/features/hyperframes-runtime/model-center/ModelCapabilityCenter.test.tsx src/features/hyperframes-runtime/model-center/providers/openAICompatibleProvider.test.ts src/features/hyperframes-runtime/model-center/providers/privateGatewayProvider.test.ts src/features/hyperframes-runtime/model-center/providers/localModelProvider.test.ts src/features/hyperframes-runtime/adapters/freecut-preview/preview-document.test.ts src/features/hyperframes-runtime/upstream/core/freecut-runtime-mirror.test.ts src/features/hyperframes-runtime/upstream/lint/freecut-runtime-mirror.test.ts src/features/hyperframes-runtime/bridges/studio-bridge/createFreeCutStudioRouteAdapter.test.ts src/features/hyperframes-runtime/bridges/studio-bridge/FreeCutStudioShell.test.tsx src/features/hyperframes-runtime/bridges/studio-bridge/createFreeCutStudioAdapter.test.ts src/features/hyperframes-runtime/bridges/studio-bridge/studioThemeAdapter.test.ts src/features/hyperframes-runtime/bridges/studio-bridge/studioFilePatchWorkflow.test.ts src/features/hyperframes-runtime/upstream/player/freecut-runtime-mirror.test.ts src/features/hyperframes-runtime/upstream/studio/freecut-runtime-mirror.test.tsx src/features/hyperframes-runtime/upstream/core/compiler/freecut-runtime-mirror.test.ts src/features/hyperframes-runtime/upstream/studio/components/editor/studioAdvancedEditing.test.tsx src/features/hyperframes-runtime/upstream/studio-server/helpers/freecut-runtime-mirror.test.ts src/features/hyperframes-runtime/upstream/parsers/freecut-runtime-mirror.test.ts src/features/timeline/components/timeline-item/use-timeline-item-pointer-handlers.test.tsx`
- `PATH="/Users/changzechuan/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH" node scripts/check-hyperframes-runtime-imports.mjs`
- `git diff --check`
- `PATH="/Users/changzechuan/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH" node node_modules/.bin/vp check --no-fmt`
- `PATH="/Users/changzechuan/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH" node node_modules/.bin/vp build`

## 备注

- T044 目标测试通过：1 个测试文件、5 个测试通过。
- skills bridge 组合测试通过：4 个测试文件、15 个测试通过。
- HyperFrames 相关回归通过：43 个测试文件、188 个测试通过。
- `check-hyperframes-runtime-imports` 确认没有直接 `@hyperframes/*` import。
- `git diff --check` 通过。
- `vp check --no-fmt` 通过，仍有 44 个既有 warning，主要来自 `.codex/skills/translate-app-locales/scripts/check-locale-coverage.mjs`、`headless/*.mjs` 的 `console.log` 和 `src/features/keyframes/components/dopesheet-editor/dopesheet-timeline-cells.tsx:35` 的 `react(only-export-components)`。
- `vp build` 通过；构建日志只有既有 dynamic import、chunk size 和 plugin timing 警告。
