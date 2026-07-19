# T030 迁移 packages/studio-server/src/helpers

## 任务

迁移 HyperFrames `packages/studio-server/src/helpers` 中 Studio Server 所需的 helper 子集：`safePath`、`sourceMutation`、`finiteMutation`、`backupJournal`、`previewAdapter`、`screenshotClip`、`waveform`。验收重点是路径安全、有限源码修改和备份 journal 测试通过，同时保持 FreeCut 不直接依赖 `@hyperframes/*` npm 包。

## 完成内容

- 使用 `scripts/sync-hyperframes-upstream.mjs` 同步 `studio-server` helper 子集到 `src/features/hyperframes-runtime/upstream/studio-server/helpers`。
- 同步文件：
  - `safePath.ts`
  - `sourceMutation.ts`
  - `sourceStyleMutation.ts`
  - `finiteMutation.ts`
  - `backupJournal.ts`
  - `previewAdapter.ts`
  - `draftMarkers.ts`
  - `screenshotClip.ts`
  - `waveform.ts`
- 新增 `htmlAttrSafety.ts` 本地镜像，供 `sourceMutation` 使用。
- 更新 `upstream-sync-state.json`，记录 `studio-server` helper 子集的来源、目标、includePaths 和同步时间。
- 新增 `freecut-runtime-mirror.test.ts`，覆盖：
  - `safePath` 拒绝 `..` 和 symlink 路径逃逸。
  - `walkDir` 隐藏 `.hyperframes/backup`，保留其它项目文件。
  - `finiteMutation` 拒绝 `NaN`、`Infinity` 和不允许的 `null`。
  - `backupJournal` 写入前生成项目相对备份路径。
  - `sourceMutation` 支持有限源码 patch，并拒绝危险 HTML 属性值。
  - `splitElementInHtml` 保持简单 id CSS 复制能力。
  - `previewAdapter` 支持命中、draft、commit 和 timing。
  - `screenshotClip` 计算安全截图裁剪区域。
  - `waveform` cache key 和缺失素材 no-op 路径不触发 ffmpeg。

## 关键决策

- `studio-server` helper 是本地服务/测试侧源码镜像，不从 `src/features/hyperframes-runtime/index.ts` 根入口导出，避免 Node-only `fs`、`child_process`、`ffmpeg` 路径进入主浏览器 bundle。
- 上游 `@hyperframes/core`、`@hyperframes/parsers` import 全部改写为 FreeCut 已镜像源码。
- 上游 `sourceMutation` 依赖 `postcss-selector-parser`，FreeCut 当前未安装该包；本任务用本地 `duplicateIdSelector` 覆盖简单 id selector 复制场景，保留拆分元素时复制 `#id` CSS 规则的关键行为。
- T030 只迁移 helpers；`createStudioApi`、routes、本地服务权限、route adapter 和资源预算控制留给 T031。
- 自然语言 patch 的完整确认、diff 和 undo journal 产品流程留给 T034；本任务先验证 source mutation 和 backup journal 基础能力。

## 验证

- `PATH="/Users/changzechuan/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH" node node_modules/.bin/vp check --no-fmt src/features/hyperframes-runtime/upstream/studio-server/helpers`
- `PATH="/Users/changzechuan/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH" node node_modules/.bin/vp test run src/features/hyperframes-runtime/upstream/studio-server/helpers/freecut-runtime-mirror.test.ts`
- `PATH="/Users/changzechuan/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH" node node_modules/.bin/vp test run src/types/hyperframes.test.ts src/types/timeline-hyperframes.test.ts src/shared/projects/migrations/index.test.ts src/features/hyperframes-runtime src/features/preview/components/hyperframes-preview-overlay.test.tsx src/features/preview/components/preview-stage.test.tsx src/features/preview/components/video-preview.sync.test.tsx src/features/timeline/components/timeline-item/use-timeline-item-pointer-handlers.test.tsx`
- `PATH="/Users/changzechuan/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH" node scripts/check-hyperframes-runtime-imports.mjs`
- `git diff --check`
- `PATH="/Users/changzechuan/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH" node node_modules/.bin/vp check --no-fmt src vite.config.ts`
- `PATH="/Users/changzechuan/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH" node node_modules/.bin/vp build`

## 备注

- T030 helper 单测通过：1 个测试文件、7 个测试通过。
- T014-T030 联合测试通过：30 个测试文件、191 个测试通过；jsdom 对 HTMLMediaElement 的 `load/pause` 未实现提示不影响测试结果。
- `check-hyperframes-runtime-imports` 确认没有直接 `@hyperframes/*` import。
- `vp check --no-fmt src vite.config.ts` 通过，仍有既有 `react(only-export-components)` 警告，位置为 `src/features/keyframes/components/dopesheet-editor/dopesheet-timeline-cells.tsx:35`，本任务未修改该文件。
- `vp build` 通过；构建日志未新增 `studio-server` 或 `node:*` 进入浏览器包的告警，仍保留项目既有动态导入、chunk 大小和插件耗时 warning。

## 浏览器复用补充（2026-07-19）

- `sourceMutation` 去除 `postcss` 运行时导入，简单 ID CSS 规则复制改用本地结构化规则扫描结果，并保留原有 selector 替换和声明体。
- helper mirror 与 CSS scanner 联合核心测试通过：2 个文件、8 个测试；相关文件静态检查无 warning/error。
- Studio 冷启动实测确认该复用链不再触发 `path`、`fs`、`url` 或 `source-map-js` 外部化警告。
