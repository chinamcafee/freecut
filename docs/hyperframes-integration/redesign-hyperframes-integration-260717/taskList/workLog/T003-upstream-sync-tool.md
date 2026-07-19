# T003 建立 HyperFrames 源码同步工具

## 任务

建立从 `/Users/changzechuan/VideoAIEditProjects/hyperframes` 同步指定包源码到 FreeCut `src/features/hyperframes-runtime/upstream` 的工具。

## 完成内容

- 新增 `scripts/sync-hyperframes-upstream.mjs`。
- 新增 `package.json` 脚本 `hyperframes:sync-upstream`。
- 新增 `provenance/upstream-sync-state.json`。
- 工具默认 dry-run，只有显式 `--write` 才复制文件并更新 sync state。
- 支持 `--package`、`--source-root`、`--target-root`、`--state-path` 和 `--json`。
- 复制目标默认限制在 `src/features/hyperframes-runtime/upstream` 下，避免覆盖 adapters、bridges 或业务目录。

## 关键决策

- 同步工具不删除目标目录中已有文件；删除和 prune 需要后续单独审计。
- `node_modules` 和 `.git` 不参与同步。
- dry-run 可用于查看新增、变更、相同文件数量。

## 验证

- `PATH="/Users/changzechuan/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH" node scripts/sync-hyperframes-upstream.mjs --package player --dry-run`
