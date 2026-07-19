# T004 建立源码迁移 patch 记录流程

## 任务

建立每次迁移 HyperFrames 源码后的 patch 记录流程，确保来源、目标、import 改写、本地 patch、未迁移内容和验证结果可追踪。

## 完成内容

- 新增 `scripts/record-hyperframes-patch-note.mjs`。
- 新增 `package.json` 脚本 `hyperframes:record-patch-note`。
- 扩展 `src/features/hyperframes-runtime/provenance/patch-notes.md`，补充升级审计步骤。
- 记录脚本支持 `--package`、`--summary`、`--source`、`--target`、`--rewrite`、`--local-patch`、`--not-migrated`、`--verification`。

## 关键决策

- patch note 追加到 provenance 目录，不写入用户项目目录。
- 记录流程和任务清单绑定：每次迁移完成后同步更新 patch notes、taskList 和 workLog。

## 验证

- `PATH="/Users/changzechuan/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH" node scripts/record-hyperframes-patch-note.mjs --help`

## 运行时回归补充（2026-07-19）

- 已在 `provenance/patch-notes.md` 记录 Studio 精确导入、浏览器安全 CSS 扫描器和 `sourceMutation` 去除浏览器 `postcss` 加载链的本地补丁。
- 补丁通过 15 个核心测试文件、51 个测试，以及 Studio 冷启动浏览器验收。
