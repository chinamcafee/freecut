# T043 实现技能目录解析器

## 任务

实现技能目录解析器，交付 `HyperFramesSkillDefinition`。验收重点是：能解析 title、categories、inputRequirements、modelRequirements、toolRequirements、sourcePaths。

## 完成内容

- 新增 `src/features/hyperframes-runtime/bridges/skills-bridge/skillDirectoryParser.ts`：
  - 定义 `HyperFramesSkillDefinition`。
  - 定义技能分类 `HyperFramesSkillCategory`：
    - `marketing-generation`
    - `content-explanation`
    - `video-packaging`
    - `music-driven`
    - `slideshow`
    - `general-video`
    - `domain-tool`
  - 定义输入需求 `HyperFramesSkillInputRequirement`，覆盖 URL、文本、视频、音频、Figma、GitHub PR、Remotion source、media assets、existing project 等输入类型。
  - 定义模型需求 `HyperFramesSkillModelRequirement`，覆盖 text planning、vision、TTS、transcription、audio generation、image generation。
  - 定义工具需求 `HyperFramesSkillToolRequirement`，覆盖 HyperFrames CLI、Node、FFmpeg、browser、render runtime、local filesystem、media-use、Figma、GitHub CLI、Remotion、Python、subagent、skills update 等。
  - 定义 `HyperFramesSkillSourcePaths`，记录 skill root、`SKILL.md`、`CATALOG.md`、references、themes、examples、scripts、agents/sub-agents、categories、templates、assets 和全部资源路径。
- 实现两个解析入口：
  - `parseHyperFramesSkillDirectory()`：解析单个技能目录快照。
  - `parseHyperFramesSkillsCatalog()`：按顶层目录聚合并解析完整 skills catalog。
- 实现 Markdown frontmatter 子集解析：
  - 提取 `name`、`description`。
  - 支持单行 scalar 和 `>` / `|` folded block。
  - 从第一个 H1 提取 title，缺失时用 skill id 生成标题。
- 实现保守启发式解析：
  - 基于 skill id 和正文关键词推导分类。
  - 基于 `SKILL.md` 和 `CATALOG.md` 文本推导输入、模型、工具需求。
  - 所有 requirement 记录 evidence 和 source path，便于 UI 后续解释推荐原因。
- 新增导出：
  - `src/features/hyperframes-runtime/bridges/skills-bridge/index.ts`
  - `src/features/hyperframes-runtime/index.ts`
- 新增 `src/features/hyperframes-runtime/bridges/skills-bridge/skillDirectoryParser.test.ts`：
  - 验证 `product-launch-video` 能解析 title、营销分类、URL/text/Figma 输入、text planning/vision/TTS/audio generation 模型需求、CLI/Node/media-use/Figma/subagent 工具需求和 references/scripts/sub-agents source paths。
  - 验证 `embedded-captions` 能解析 CATALOG、themes、scripts、assets、video 输入、transcription/TTS 模型需求和 FFmpeg/Node/CLI 工具需求。
  - 验证完整 catalog 可解析 19 个技能，并且 sourcePaths 全部指向 FreeCut 内部 `src/features/hyperframes-runtime/upstream/skills/*` 资源镜像。

## 关键决策

- 解析器放在 `bridges/skills-bridge`，因为它是 FreeCut 对 upstream skills 资源的结构化适配层；`upstream/skills` 继续保持资源镜像，不承载 FreeCut 定制逻辑。
- 解析器是纯函数，不直接依赖 Node `fs`。调用方可以来自测试、本地服务、打包资源索引或后续技能执行环境。
- T043 不执行任何上游脚本，只读取已经镜像的资源文本和路径。
- requirements 采用“保守启发式 + evidence”形式，避免把上游非结构化 Markdown 误当成强 schema；后续 T044 推荐器可以结合 evidence、分类和用户上下文继续打分。

## 验证

- `PATH="/Users/changzechuan/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH" node node_modules/.bin/vp check --fix src/features/hyperframes-runtime/bridges/skills-bridge/skillDirectoryParser.ts src/features/hyperframes-runtime/bridges/skills-bridge/index.ts src/features/hyperframes-runtime/bridges/skills-bridge/skillDirectoryParser.test.ts src/features/hyperframes-runtime/index.ts`
- `PATH="/Users/changzechuan/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH" node node_modules/.bin/vp test run src/features/hyperframes-runtime/bridges/skills-bridge/skillDirectoryParser.test.ts`
- `PATH="/Users/changzechuan/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH" node node_modules/.bin/vp test run src/features/hyperframes-runtime/provenance/skills-resource-mirror.test.ts src/features/hyperframes-runtime/provenance/manifest.test.ts src/features/hyperframes-runtime/bridges/skills-bridge/skillDirectoryParser.test.ts`
- `PATH="/Users/changzechuan/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH" node scripts/check-hyperframes-runtime-imports.mjs`
- `git diff --check`
- `PATH="/Users/changzechuan/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH" node node_modules/.bin/vp check --no-fmt`
- `PATH="/Users/changzechuan/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH" node node_modules/.bin/vp build`

## 备注

- T043 目标测试通过：1 个测试文件、3 个测试通过。
- T042/T043 组合测试通过：3 个测试文件、10 个测试通过。
- `check-hyperframes-runtime-imports` 确认没有直接 `@hyperframes/*` import。
- `git diff --check` 通过。
- `vp check --no-fmt` 通过，仍有 44 个既有 warning，主要来自 `.codex/skills/translate-app-locales/scripts/check-locale-coverage.mjs`、`headless/*.mjs` 的 `console.log` 和 `src/features/keyframes/components/dopesheet-editor/dopesheet-timeline-cells.tsx:35` 的 `react(only-export-components)`。
- `vp build` 通过；构建日志只有既有 dynamic import、chunk size 和 plugin timing 警告。
