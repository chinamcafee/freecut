# T031 接入 studio-server routes 到本地服务适配

## 任务

把 HyperFrames `studio-server` routes 的核心能力接入 FreeCut 的本地服务适配边界，交付 `projects/files/preview/lint/thumbnail/selection/render/waveform/registry` 路由或等价 adapter API。验收重点是：route 层不能绕过 FreeCut 项目权限、仓储边界或路径校验。

## 完成内容

- 扩展 `FreeCutStudioAdapter`：
  - `listProjects()`：通过 `HyperFramesProjectRepository.listProjectRefs()` 列出当前 FreeCut 项目可见的 HyperFrames 项目。
  - `startRender()`：创建受控 render job 占位结果，先走 `renderPreview` 诊断，不直接绕过 FreeCut 导出管线。
  - `generateWaveform()`：基于项目目录 asset bytes 生成可替换的 waveform placeholder，后续本地服务可替换为 T030 的 ffmpeg helper。
  - `listRegistryBlocks()`：提供 registry route 的只读空目录占位，后续技能/registry 任务接入真实目录。
- 新增 `createFreeCutStudioRouteAdapter`：
  - `projects.list/resolve`
  - `files.list/read/write`
  - `preview.get`
  - `lint.run`
  - `thumbnail.generate`
  - `selection.get/update`
  - `render.preview/start`
  - `waveform.get`
  - `registry.list/install`
- route facade 行为：
  - 每个 project-scoped 方法先通过 `adapter.resolveProject(projectId)` 解析项目。
  - 每个 path-scoped 方法先通过 `normalizeHyperFramesProjectPath()` 校验相对路径。
  - unsafe path 在调用 `readFile/writeFile/generateWaveform` 前返回 `403`。
  - 文件写入只调用 adapter，写入 meta 标记为 `studio-route-write` / `studio-edit`。
  - registry install 当前返回 `501`，避免伪装成已经能安装外部块。
- 从 `studio-bridge/index.ts` 和 `src/features/hyperframes-runtime/index.ts` 导出 route adapter 类型和创建函数。
- 新增 `createFreeCutStudioRouteAdapter.test.ts`，覆盖所有 route 等价 API 和 unsafe path 不触达底层 file/waveform adapter 方法。

## 关键决策

- T031 不直接迁入 Hono server，也不在浏览器主包挂真实 HTTP routes；当前交付“等价 adapter API”，后续可挂到本地服务或继续由 Studio Shell 直接调用。
- `render.start()` 只创建受控 job 状态并复用 preview/lint 诊断，不直接写输出文件，也不绕过 FreeCut 后续导出管线。
- `waveform.get()` 在浏览器/in-memory 模式返回 asset-bytes placeholder；真实 decode 和 cache 路径由 T030 迁移的 `waveform.ts` 在本地服务模式接管。
- `registry.list()` 当前返回空目录，`registry.install()` 明确 `501`，避免在技能/registry 资源迁移前制造不可追踪写入。

## 验证

- `PATH="/Users/changzechuan/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH" node node_modules/.bin/vp check --no-fmt src/features/hyperframes-runtime/bridges/studio-bridge`
- `PATH="/Users/changzechuan/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH" node node_modules/.bin/vp test run src/features/hyperframes-runtime/bridges/studio-bridge/createFreeCutStudioRouteAdapter.test.ts src/features/hyperframes-runtime/bridges/studio-bridge/createFreeCutStudioAdapter.test.ts src/features/hyperframes-runtime/bridges/studio-bridge/FreeCutStudioShell.test.tsx`
- `PATH="/Users/changzechuan/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH" node scripts/check-hyperframes-runtime-imports.mjs`
- `git diff --check`
- `PATH="/Users/changzechuan/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH" node node_modules/.bin/vp test run src/types/hyperframes.test.ts src/types/timeline-hyperframes.test.ts src/shared/projects/migrations/index.test.ts src/features/hyperframes-runtime src/features/preview/components/hyperframes-preview-overlay.test.tsx src/features/preview/components/preview-stage.test.tsx src/features/preview/components/video-preview.sync.test.tsx src/features/timeline/components/timeline-item/use-timeline-item-pointer-handlers.test.tsx`
- `PATH="/Users/changzechuan/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH" node node_modules/.bin/vp check --no-fmt src vite.config.ts`
- `PATH="/Users/changzechuan/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH" node node_modules/.bin/vp build`

## 备注

- T031 局部测试通过：3 个测试文件、7 个测试通过。
- T014-T031 联合测试通过：31 个测试文件、193 个测试通过；jsdom 对 HTMLMediaElement 的 `load/pause` 未实现提示不影响测试结果。
- `check-hyperframes-runtime-imports` 确认没有直接 `@hyperframes/*` import。
- `vp check --no-fmt src vite.config.ts` 通过，仍有既有 `react(only-export-components)` 警告，位置为 `src/features/keyframes/components/dopesheet-editor/dopesheet-timeline-cells.tsx:35`，本任务未修改该文件。
- `vp build` 通过；构建日志未新增 `studio-server` 或 `node:*` 进入浏览器包的告警，`FreeCutStudioShell` 仍是独立 lazy chunk。
