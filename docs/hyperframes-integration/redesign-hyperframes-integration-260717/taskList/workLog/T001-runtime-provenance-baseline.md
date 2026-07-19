# T001 建立源码镜像总目录和 provenance 基线

## 任务

建立 `src/features/hyperframes-runtime` 作为 FreeCut 内部的 HyperFrames 源码级集成总目录，并提供可测试的 provenance 与 import 改写基线。

## 完成内容

- 新增运行时根导出。
- 新增 `provenance/upstream-manifest.json`，记录 HyperFrames 本地源码根、目标镜像目录、包级来源和迁移策略。
- 新增 `provenance/import-rewrite-map.json`，记录 `@hyperframes/*` import 到 FreeCut 本地镜像路径的改写规则。
- 新增 provenance 类型和读取工具。
- 新增基础单元测试，验证包来源、目标路径和 import 改写表。
- 新增 upstream、adapters、bridges 目录说明。

## 关键决策

- 运行时目录命名为 `src/features/hyperframes-runtime`。
- 上游源码保存在 `upstream/*`，FreeCut 定制逻辑保存在 `adapters/*` 和 `bridges/*`。
- provenance 使用 JSON 保存，方便后续同步工具和边界检查读取。

## 验证

- `PATH="/Users/changzechuan/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH" node node_modules/.bin/vp test run src/features/hyperframes-runtime/provenance/manifest.test.ts`
- `PATH="/Users/changzechuan/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH" node node_modules/.bin/vp check --no-fmt src vite.config.ts`

## 环境记录

- 当前 shell 没有全局 `node` 和 `npm`。
- 首次尝试 fallback `pnpm` 时触发依赖安装并失败，原因是 registry 缺少 `@oxc-project/types@0.139.0`。
- 已把被 `pnpm` 移到 `node_modules/.ignored` 的依赖移回原位置，后续验证改用项目本地 `vp` 加 Codex runtime node。
