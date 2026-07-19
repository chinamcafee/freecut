# HyperFrames 源码镜像 Patch Notes

## 2026-07-18：运行时目录基线

- 建立 `src/features/hyperframes-runtime` 作为 HyperFrames 源码级迁移总目录。
- 增加 `upstream-manifest.json` 记录计划迁移的上游源码包、来源路径、目标路径、运行环境和迁移策略。
- 增加 `import-rewrite-map.json` 记录 `@hyperframes/*` 到 FreeCut 本地源码镜像的改写规则。
- 当前还未复制上游源码；后续每个源码包迁移任务必须在本文件追加来源、改写、删除、隔离和测试说明。

## 记录模板

```text
## YYYY-MM-DD：迁移 <package-id>

- 来源：/Users/changzechuan/VideoAIEditProjects/hyperframes/<source-path>
- 目标：src/features/hyperframes-runtime/upstream/<target>
- 改写：
  - <import or runtime rewrite>
- 本地 patch：
  - <FreeCut-specific adaptation>
- 未迁移：
  - <excluded files and reasons>
- 验证：
  - <commands and results>
```

## 升级审计步骤

1. 读取 `upstream-manifest.json`，确认需要同步的包和来源路径。
2. 先执行 `node scripts/sync-hyperframes-upstream.mjs --package <id> --dry-run`，检查新增和变更文件数量。
3. 确认不会写入 `adapters`、`bridges` 或 FreeCut 业务目录。
4. 执行 `node scripts/sync-hyperframes-upstream.mjs --package <id> --write`。
5. 按 `import-rewrite-map.json` 改写迁移源码中的 `@hyperframes/*` import。
6. 隔离 Node-only 代码，禁止进入浏览器 bundle。
7. 执行该包对应单元测试、边界检查和项目 check。
8. 使用 `node scripts/record-hyperframes-patch-note.mjs` 追加本次迁移记录。
9. 更新 `taskList/taskList.md` 和对应 `taskList/workLog/Txxx-*.md`。

## 2026-07-18：迁移 parsers runtime 源码镜像

- 包：parsers
- 来源：packages/parsers/src
- 目标：src/features/hyperframes-runtime/upstream/parsers
- 改写：
  - 未引入 @hyperframes/\* package import；runtime mirror 保持上游相对 import
  - 新增 FreeCut 直接依赖 @babel/parser、acorn、acorn-walk、linkedom、magic-string、recast 以支撑源码镜像
- 本地 patch：
  - sync-hyperframes-upstream 增加 --runtime-only，跳过上游测试、fixtures、goldens 和 test helpers
  - 新增 freecut-runtime-mirror.test.ts 覆盖 HTML roundtrip、GSAP parse/write、资产路径提取、hfIds 持久化
- 未迁移：
  - packages/parsers/src/_.test.ts、_.test-helpers.ts、test-utils.ts、**goldens**：上游测试依赖 @hyperframes/core/generators，改由 FreeCut 侧验收测试覆盖
- 验证：
  - node node_modules/.bin/vp test run src/features/hyperframes-runtime/upstream/parsers/freecut-runtime-mirror.test.ts：1 file / 4 tests passed
  - node scripts/check-hyperframes-runtime-imports.mjs：No direct @hyperframes/\* imports found
  - node node_modules/.bin/vp check --no-fmt src vite.config.ts：0 errors，1 个既有 react(only-export-components) warning
  - node node_modules/.bin/vp build：通过，保留既有动态导入与 chunk 大小 warning

## 2026-07-18：迁移 lint runtime 源码镜像

- 包：lint
- 来源：packages/lint/src
- 目标：src/features/hyperframes-runtime/upstream/lint
- 改写：
  - @hyperframes/parsers/\* import 改写为本地 ../parsers 源码镜像
  - 新增 FreeCut 直接依赖 htmlparser2、postcss 以支撑 lint 源码镜像
- 本地 patch：
  - sync-hyperframes-upstream --runtime-only 跳过上游 lint 测试文件
  - 新增 freecut-runtime-mirror.test.ts 覆盖不安全脚本、缺失资产、字体、媒体和 shouldBlockRender
- 未迁移：
  - packages/lint/src/\*.test.ts：改由 FreeCut 侧 runtime mirror 验收测试覆盖
- 验证：
  - node node_modules/.bin/vp test run src/features/hyperframes-runtime/upstream/lint/freecut-runtime-mirror.test.ts：1 file / 4 tests passed
  - node node_modules/.bin/vp test run parser+lint+adapter mirror tests：3 files / 13 tests passed
  - node scripts/check-hyperframes-runtime-imports.mjs：No direct @hyperframes/\* imports found
  - node node_modules/.bin/vp check --no-fmt src vite.config.ts：0 errors，1 个既有 react(only-export-components) warning
  - node node_modules/.bin/vp build：通过，保留既有动态导入、chunk 和插件耗时 warning

## 2026-07-18：迁移 core runtime 浏览器子集

- 包：core
- 来源：packages/core/src
- 目标：src/features/hyperframes-runtime/upstream/core
- 改写：
  - sync-hyperframes-upstream 增加 repeatable --include，按源码相对路径同步 core runtime 浏览器子集
  - @hyperframes/parsers 和 @hyperframes/parsers/composition re-export/import 改写为本地 ../parsers 源码镜像
- 本地 patch：
  - 同步 core.types.ts、safePath.ts、tokenSlug.ts、variables.ts、colorGrading.ts、inline-scripts/runtimeContract.ts、inline-scripts/pickerApi.ts，以及 runtime 变量、时钟、媒体、协议和 bridge 子集
  - 新增 freecut-runtime-mirror.test.ts 覆盖变量读取/绑定、变量校验、TransportClock、媒体发现与同步
  - 新增 runtime-adapter.ts，提供 FreeCut 侧 runtime globals 安装、变量诊断映射、clock/media wrappers、control bridge 和受控注入计划
- 未迁移：
  - packages/core/src/runtime/init.ts、entry.ts 和高级 runtime adapters：依赖 compiler、Studio helper、text、Player 等后续任务，留给 T019/T021/T020 分阶段接入
  - packages/core/src/compiler、registry、templates：分别进入 T019 和后续 Studio/技能任务
- 验证：
  - node node_modules/.bin/vp test run src/features/hyperframes-runtime/upstream/core/freecut-runtime-mirror.test.ts src/features/hyperframes-runtime/adapters/freecut-project/runtime-adapter.test.ts：2 files / 8 tests passed
  - node node_modules/.bin/vp test run T014-T018 runtime mirror and adapter tests：6 files / 25 tests passed
  - node scripts/check-hyperframes-runtime-imports.mjs：No direct @hyperframes/\* imports found
  - node node_modules/.bin/vp check --no-fmt src vite.config.ts：0 errors，1 个既有 react(only-export-components) warning
  - node node_modules/.bin/vp build：通过，保留既有动态导入、chunk 和插件耗时 warning

## 2026-07-18：迁移 core compiler 子集

- 包：core
- 来源：packages/core/src
- 目标：src/features/hyperframes-runtime/upstream/core
- 改写：
  - 使用 sync-hyperframes-upstream --include compiler --include runtime/flattenedRoot.ts --include generated/runtime-inline.ts --include utils/cssSelector.ts 同步 compiler 子集
  - @hyperframes/parsers/asset-paths 改写为本地 ../../parsers/assetPaths.js 或 ../../parsers/rewriteSubCompPaths.js
  - @hyperframes/parsers/sub-composition-validity 改写为本地 ../../parsers/subCompositionValidity.js
  - @hyperframes/lint 改写为本地 ../../lint/browser.js
- 本地 patch：
  - inlineSubCompositions 保留上游 document 参数 API 形状，并用 void document 满足 FreeCut noUnused 检查
  - 新增 compiler-adapter.ts，从 HyperFramesProjectDirectory 生成预览 HTML，执行 timing 编译、媒体 duration 注入、子组合内联、样式和脚本收集、runtime 注入
  - 新增 compiler/freecut-runtime-mirror.test.ts 覆盖 timing compiler、runtime script stripping、子组合内联、资产路径重写和 timing resolver
  - 新增 compiler-adapter.test.ts 覆盖内存项目目录预览 HTML 生成和缺失活动组合诊断
- 未迁移：
  - compiler 上游测试文件：由 FreeCut 侧 mirror/adaptor 测试覆盖
  - htmlBundler.ts 中 Node/FS/esbuild 路径仅源码镜像并可编译，不由浏览器 adapter 直接导入；完整本地服务 bundling 留给后续 render/producer 集成
- 验证：
  - node node_modules/.bin/vp test run src/features/hyperframes-runtime/upstream/core/compiler/freecut-runtime-mirror.test.ts src/features/hyperframes-runtime/adapters/freecut-project/compiler-adapter.test.ts：2 files / 6 tests passed
  - node scripts/check-hyperframes-runtime-imports.mjs：No direct @hyperframes/\* imports found
  - git diff --check：通过
  - node node_modules/.bin/vp check --no-fmt src vite.config.ts：0 errors，1 个既有 react(only-export-components) warning
  - node node_modules/.bin/vp test run T014-T019 runtime mirror and adapter tests：8 files / 31 tests passed
  - node node_modules/.bin/vp build：通过，保留既有动态导入、chunk 和插件耗时 warning

## 2026-07-18：迁移 player runtime 源码镜像

- 包：player
- 来源：packages/player/src
- 目标：src/features/hyperframes-runtime/upstream/player
- 改写：
  - @hyperframes/core/runtime/protocol 改写为本地 ../core/runtime/protocol.js
  - @hyperframes/core/composition-contract 改写为本地 ../core/compositionContract.js
  - @hyperframes/core/slideshow 改写为本地 ../../core/slideshow/index.js
  - core 兼容转发文件 compositionContract.ts 和 slideshow/index.ts 改写到本地 parsers mirror
- 本地 patch：
  - sync-hyperframes-upstream --runtime-only 增加 test-setup.ts 排除规则，避免同步上游 Vitest setup 到 runtime mirror
  - CompositionProbe 默认 runtime fallback 从外部 CDN 改为 FreeCut 同源 /hyperframes-runtime/core/runtime.js
  - iframe-dom 在缺失 HTMLIFrameElement.sandbox DOMTokenList 的环境使用 setAttribute fallback
  - composition-probe、direct-timeline-clock、parent-media、SlideshowController 补最小空值/unused patch 以满足 FreeCut 严格 TS
  - 新增 player/freecut-runtime-mirror.test.ts 覆盖 Web Component、iframe、CompositionProbe、DirectTimelineClock、ParentMediaManager、runtime message handler 和 slideshow controller
- 未迁移：
  - packages/player/src/\*.test.ts：由 FreeCut 侧 runtime mirror 测试覆盖
  - packages/player/src/slideshow/test-setup.ts：上游测试辅助，非生产 runtime
- 验证：
  - node node_modules/.bin/vp test run src/features/hyperframes-runtime/upstream/player/freecut-runtime-mirror.test.ts：1 file / 6 tests passed
  - node node_modules/.bin/vp test run T014-T021 runtime mirror and adapter tests：10 files / 42 tests passed
  - node scripts/check-hyperframes-runtime-imports.mjs：No direct @hyperframes/\* imports found
  - git diff --check：通过
  - node node_modules/.bin/vp check --no-fmt src vite.config.ts：0 errors，1 个既有 react(only-export-components) warning
  - node node_modules/.bin/vp build：通过，保留既有动态导入、chunk 和插件耗时 warning

## 2026-07-18：迁移 Studio 第一批源码镜像

- 包：studio
- 来源：packages/studio/src
- 目标：src/features/hyperframes-runtime/upstream/studio
- 改写：
  - Phosphor 图标入口改写为 FreeCut 本地 lucide shim，避免新增不可安装依赖
  - Studio telemetry 改写为 FreeCut 本地 no-op，后续通过 studio-bridge 注入正式 telemetry adapter
  - NLEPreview 的 sizing helper 拆到 .ts 文件，避免 TSX Fast Refresh 误报
- 本地 patch：
  - 新增 NLELayout、PropertyPanel、Player/useTimelinePlayer 门面，提供 FreeCut 可控的第一批 Studio 嵌入边界
  - SourceEditor 保留同 props 的 textarea 实现；CodeMirror 版本等待依赖安装能力后恢复
  - sourcePatcher/htmlEditor 增加严格 TS 空值守卫，算法保持上游逻辑
- 未迁移：
  - 上游 NLELayout.tsx 当前不存在；本任务用 FreeCut 侧 NLELayout skeleton 对齐文档意图
  - 完整 PropertyPanel DOM/GSAP/Layer/Motion 编辑依赖第二批模块，留给后续 Studio 高级编辑任务
  - 完整 player timeline 状态机未在 T027 重复迁移；中央预览播放器已由 T021-T026 player-bridge 覆盖
- 验证：
  - node node_modules/.bin/vp test run src/features/hyperframes-runtime/upstream/studio/freecut-runtime-mirror.test.tsx：1 file / 5 tests passed
  - node node_modules/.bin/vp test run T014-T027 runtime mirror and preview tests：26 files / 167 tests passed
  - node scripts/check-hyperframes-runtime-imports.mjs：No direct @hyperframes/\* imports found
  - git diff --check：通过
  - node node_modules/.bin/vp check --no-fmt src vite.config.ts：0 errors，1 个既有 react(only-export-components) warning
  - node node_modules/.bin/vp build：通过，保留既有动态导入、chunk 和插件耗时 warning

## 2026-07-18：迁移 Studio Server helper 子集

- 包：studio-server
- 来源：packages/studio-server/src
- 目标：src/features/hyperframes-runtime/upstream/studio-server
- 改写：
  - 使用 sync-hyperframes-upstream --runtime-only 同步 helpers/safePath、sourceMutation、sourceStyleMutation、finiteMutation、backupJournal、previewAdapter、draftMarkers、screenshotClip、waveform
  - @hyperframes/core 改写为本地 ../../core/safePath.js 或 ../../core/compositionContract.js
  - @hyperframes/parsers/ff-binaries 改写为本地 ../../parsers/ffBinaries.js
  - @hyperframes/parsers/hf-ids 改写为本地 ../../parsers/hfIds.js
- 本地 patch：
  - 新增 htmlAttrSafety.ts 本地镜像，避免 sourceMutation 运行时 import @hyperframes/core/html-attr-safety
  - sourceMutation 去除 FreeCut 当前未安装的 postcss-selector-parser 依赖，用本地 duplicateIdSelector 覆盖简单 id selector 复制场景
  - 新增 studio-server/helpers/freecut-runtime-mirror.test.ts 覆盖 safePath、walkDir、finiteMutation、backupJournal、sourceMutation、previewAdapter、screenshotClip、waveform
- 未迁移：
  - createStudioApi、routes 和类型入口留给 T031
  - thumbnail/waveform 的真实资源预算和 route 层取消机制留给 T031/后续本地服务任务
  - 自然语言 patch 的确认前 diff 和 undo journal 完整流程留给 T034
- 验证：
  - node node_modules/.bin/vp check --no-fmt src/features/hyperframes-runtime/upstream/studio-server/helpers：0 errors，0 warnings
  - node node_modules/.bin/vp test run src/features/hyperframes-runtime/upstream/studio-server/helpers/freecut-runtime-mirror.test.ts：1 file / 7 tests passed
  - node node_modules/.bin/vp test run T014-T030 runtime mirror and preview tests：30 files / 191 tests passed
  - node scripts/check-hyperframes-runtime-imports.mjs：No direct @hyperframes/\* imports found
  - git diff --check：通过
  - node node_modules/.bin/vp check --no-fmt src vite.config.ts：0 errors，1 个既有 react(only-export-components) warning
  - node node_modules/.bin/vp build：通过，未新增 studio-server/node:\* 浏览器包告警，保留既有动态导入、chunk 和插件耗时 warning

## 2026-07-18：迁移 skills 资源镜像

- 包：skills
- 来源：skills
- 目标：src/features/hyperframes-runtime/upstream/skills
- 改写：
  - 资源文件保持上游目录结构，不做 import 改写
  - 脚本、模板、示例、字体、图片和测试夹具仅作为资源镜像进入 FreeCut，不在迁移时执行
- 本地 patch：
  - 使用 sync-hyperframes-upstream --package skills --write 同步完整 skills/\* 资源
  - upstream-sync-state.json 记录 skills 同步状态：841 个文件，16101289 bytes，runtimeOnly=false
  - 新增 provenance/skills-resource-mirror.test.ts 验证 19 个顶层技能目录、SKILL.md、CATALOG.md、references、themes、examples、scripts 和 sync-state
  - vite.config.ts 将 upstream/skills/\*\* 作为资源镜像排除出 lint/format 范围，避免为通过 FreeCut lint 改写未执行的上游脚本
- 未迁移：
  - 未迁移 .agents/skills 和 .claude/skills；T042 范围限定为文档和 upstream-manifest 指定的 hyperframes/skills/\*
  - 未把脚本接入执行环境；脚本权限、运行时间限制和可取消执行留给 T048
- 验证：
  - node scripts/sync-hyperframes-upstream.mjs --package skills --dry-run --json：841 new files，target 限定在 src/features/hyperframes-runtime/upstream/skills
  - node scripts/sync-hyperframes-upstream.mjs --package skills --write --json：841 files synced，16101289 bytes
  - node node_modules/.bin/vp test run src/features/hyperframes-runtime/provenance/skills-resource-mirror.test.ts src/features/hyperframes-runtime/provenance/manifest.test.ts：2 files / 7 tests passed

## 2026-07-19：Studio 浏览器依赖收敛与 lint 扫描补丁

- 包：studio、studio-server、lint
- 来源：`packages/studio/src`、`packages/studio-server/src/helpers/sourceMutation.ts`、`packages/lint/src/rules`
- 目标：`upstream/studio`、`upstream/studio-server/helpers`、`upstream/lint`
- 改写：
  - FreeCut Studio Shell/Panels 使用组件、hook 和类型的精确文件入口，避免 barrel 扩大 lazy chunk 依赖图。
  - lint 中仅需要选择器和声明的规则改用本地 `cssRuleScanner.ts`。
  - `sourceMutation` 的简单 ID CSS 规则复制复用扫描结果，移除浏览器路径中的 `postcss` 运行时导入。
- 本地 patch：
  - 扫描器处理嵌套 at-rule、注释、字符串、括号、data URL 和声明分隔，并保留规则声明体用于 CSS 复制。
  - FreeCut 基础预览过滤 source-linked HyperFrames composition，由 Player overlay 独占渲染。
- 未迁移：
  - Node 侧完整项目 lint、compiler 和 Producer 仍保留其结构化 CSS/文件系统依赖；本补丁只收敛 Studio 浏览器链。
- 验证：
  - 核心回归：15 files / 51 tests passed。
  - `vp check --no-fmt src vite.config.ts`：2208 files，0 errors，1 个既有 warning。
  - `vp build`：4271 modules，构建通过。
  - 真实浏览器冷启动打开 HyperFrames Studio：0 warning、0 error。
