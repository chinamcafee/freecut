# T042 迁移 `skills/*` 资源

## 任务

迁移 HyperFrames `skills/*` 资源，交付 SKILL、CATALOG、references、themes、examples、scripts 资源镜像。验收重点是：迁移过程不运行外部仓库脚本，并在 provenance 中记录来源路径。

## 完成内容

- 使用 `scripts/sync-hyperframes-upstream.mjs --package skills` 从 `/Users/changzechuan/VideoAIEditProjects/hyperframes/skills` 同步完整资源镜像到 `src/features/hyperframes-runtime/upstream/skills`。
- 镜像 19 个顶层技能目录：
  - `embedded-captions`
  - `faceless-explainer`
  - `figma`
  - `general-video`
  - `hyperframes`
  - `hyperframes-animation`
  - `hyperframes-cli`
  - `hyperframes-core`
  - `hyperframes-creative`
  - `hyperframes-keyframes`
  - `hyperframes-registry`
  - `media-use`
  - `motion-graphics`
  - `music-to-video`
  - `pr-to-video`
  - `product-launch-video`
  - `remotion-to-hyperframes`
  - `slideshow`
  - `talking-head-recut`
- 镜像资源类型覆盖：
  - `SKILL.md`
  - `CATALOG.md`
  - `references/*`
  - `themes/*`
  - `examples/*`
  - `scripts/*`
  - templates、assets、vendor、test corpus 等技能上下文资源。
- 更新 `src/features/hyperframes-runtime/provenance/upstream-sync-state.json`：
  - `source: "skills"`
  - `target: "src/features/hyperframes-runtime/upstream/skills"`
  - `strategy: "source-resource-copy"`
  - `runtimeOnly: false`
  - `fileCount: 841`
  - `changedFileCount: 841`
  - `bytes: 16101289`
- 更新 `src/features/hyperframes-runtime/provenance/patch-notes.md`，记录来源、目标、未执行外部脚本、未接入执行环境和验证结果。
- 新增 `src/features/hyperframes-runtime/provenance/skills-resource-mirror.test.ts`：
  - 验证 19 个顶层技能目录完整存在。
  - 验证每个技能目录都有 `SKILL.md`。
  - 验证 SKILL、CATALOG、references、themes、examples、scripts、assets/vendor 等代表性资源存在。
  - 验证 `upstream-manifest.json` 和 `upstream-sync-state.json` 中 skills provenance 与文件数一致。
- 更新 `vite.config.ts`，将 `src/features/hyperframes-runtime/upstream/skills/**` 作为资源镜像排除出 lint/format 范围，避免为了通过 FreeCut lint 改写未执行的上游脚本资源。

## 关键决策

- T042 只做资源镜像，不把上游技能脚本接入执行环境；脚本权限、运行时间限制、取消机制和 sandbox 执行留给 T048。
- 不改写 `skills/*` 中的上游脚本内容。它们当前是 FreeCut 内的可检索资源，不是 FreeCut 业务源码。
- FreeCut 自己的资源镜像测试放在 provenance 目录，避免测试文件混入 upstream skills 资源树影响文件数对齐。
- 未迁移 `.agents/skills` 和 `.claude/skills`，因为本任务范围由文档和 `upstream-manifest.json` 限定为 `/Users/changzechuan/VideoAIEditProjects/hyperframes/skills/*`。

## 验证

- `PATH="/Users/changzechuan/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH" node scripts/sync-hyperframes-upstream.mjs --package skills --dry-run --json`
- `PATH="/Users/changzechuan/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH" node scripts/sync-hyperframes-upstream.mjs --package skills --write --json`
- `PATH="/Users/changzechuan/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH" node node_modules/.bin/vp check --fix src/features/hyperframes-runtime/provenance/skills-resource-mirror.test.ts src/features/hyperframes-runtime/provenance/patch-notes.md src/features/hyperframes-runtime/provenance/upstream-sync-state.json docs/hyperframes-integration/redesign-hyperframes-integration-260717/taskList/taskList.md vite.config.ts`
- `PATH="/Users/changzechuan/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH" node node_modules/.bin/vp test run src/features/hyperframes-runtime/provenance/skills-resource-mirror.test.ts src/features/hyperframes-runtime/provenance/manifest.test.ts`
- `PATH="/Users/changzechuan/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH" node node_modules/.bin/vp test run src/shared/projects/migrations/sanitize-text-motion.test.ts src/shared/projects/migrations/index.test.ts src/types/hyperframes.test.ts src/types/timeline-hyperframes.test.ts src/features/hyperframes-runtime/provenance/skills-resource-mirror.test.ts src/features/hyperframes-runtime/provenance/manifest.test.ts src/features/preview/components/hyperframes-preview-overlay.test.tsx src/features/hyperframes-runtime/model-center/credentialCostBudget.test.ts src/features/hyperframes-runtime/model-center/modelCenterStore.test.ts src/features/hyperframes-runtime/model-center/modelRegistry.test.ts src/features/hyperframes-runtime/bridges/player-bridge/useFreeCutTimelineClock.test.tsx src/features/hyperframes-runtime/bridges/player-bridge/HyperFramesPlayerHost.test.tsx src/features/hyperframes-runtime/bridges/player-bridge/runtimeMessageProtocol.test.ts src/features/hyperframes-runtime/adapters/freecut-project/lint-adapter.test.ts src/features/hyperframes-runtime/adapters/freecut-project/parser-adapter.test.ts src/features/hyperframes-runtime/adapters/freecut-project/compiler-adapter.test.ts src/features/hyperframes-runtime/adapters/freecut-project/project-signatures.test.ts src/features/hyperframes-runtime/adapters/freecut-project/project-directory-bundle.test.ts src/features/hyperframes-runtime/adapters/freecut-project/runtime-adapter.test.ts src/features/hyperframes-runtime/adapters/freecut-project/file-system-project-repository.test.ts src/features/hyperframes-runtime/adapters/freecut-project/project-path-guards.test.ts src/features/hyperframes-runtime/adapters/freecut-project/project-repository.test.ts src/features/hyperframes-runtime/model-center/ModelCapabilityCenter.test.tsx src/features/hyperframes-runtime/model-center/providers/openAICompatibleProvider.test.ts src/features/hyperframes-runtime/model-center/providers/privateGatewayProvider.test.ts src/features/hyperframes-runtime/model-center/providers/localModelProvider.test.ts src/features/hyperframes-runtime/adapters/freecut-preview/preview-document.test.ts src/features/hyperframes-runtime/bridges/studio-bridge/createFreeCutStudioRouteAdapter.test.ts src/features/hyperframes-runtime/bridges/studio-bridge/FreeCutStudioShell.test.tsx src/features/hyperframes-runtime/bridges/studio-bridge/createFreeCutStudioAdapter.test.ts src/features/hyperframes-runtime/bridges/studio-bridge/studioThemeAdapter.test.ts src/features/hyperframes-runtime/bridges/studio-bridge/studioFilePatchWorkflow.test.ts src/features/hyperframes-runtime/upstream/studio-server/helpers/freecut-runtime-mirror.test.ts src/features/hyperframes-runtime/upstream/player/freecut-runtime-mirror.test.ts src/features/hyperframes-runtime/upstream/core/freecut-runtime-mirror.test.ts src/features/hyperframes-runtime/upstream/lint/freecut-runtime-mirror.test.ts src/features/hyperframes-runtime/upstream/core/compiler/freecut-runtime-mirror.test.ts src/features/hyperframes-runtime/upstream/parsers/freecut-runtime-mirror.test.ts src/features/hyperframes-runtime/upstream/studio/freecut-runtime-mirror.test.tsx src/features/hyperframes-runtime/upstream/studio/components/editor/studioAdvancedEditing.test.tsx src/features/timeline/components/timeline-item/use-timeline-item-pointer-handlers.test.tsx`
- `PATH="/Users/changzechuan/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH" node scripts/check-hyperframes-runtime-imports.mjs`
- `git diff --check`
- `PATH="/Users/changzechuan/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH" node node_modules/.bin/vp check --no-fmt`
- `PATH="/Users/changzechuan/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH" node node_modules/.bin/vp build`

## 备注

- skills dry-run 结果：841 个 new files，目标限定在 `src/features/hyperframes-runtime/upstream/skills`。
- skills write 结果：841 个文件同步，`16101289` bytes。
- T042 目标测试通过：2 个测试文件、7 个测试通过。
- HyperFrames 相关回归通过：41 个测试文件、180 个测试通过。
- `check-hyperframes-runtime-imports` 确认没有直接 `@hyperframes/*` import。
- `git diff --check` 通过。
- `vp check --no-fmt` 通过，仍有 44 个既有 warning，主要来自 `.codex/skills/translate-app-locales/scripts/check-locale-coverage.mjs`、`headless/*.mjs` 的 `console.log` 和 `src/features/keyframes/components/dopesheet-editor/dopesheet-timeline-cells.tsx:35` 的 `react(only-export-components)`。
- `vp build` 通过；构建日志只有既有 dynamic import、chunk size 和 plugin timing 警告。
