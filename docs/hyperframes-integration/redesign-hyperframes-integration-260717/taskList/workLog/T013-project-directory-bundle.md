# T013 实现项目目录打包与解包

## 任务

实现 HyperFrames 项目目录的打包和解包能力，保证 manifest、组合文件、资产和来源记录能被恢复。

## 完成内容

- 新增 `project-directory-bundle.ts`。
- 提供 `packHyperFramesProjectDirectory` 和 `unpackHyperFramesProjectDirectory`。
- ZIP 中包含 `manifest.json`、项目文件、资产以及 `hyperframes-bundle.json` 元数据。
- 打包前复用 T010 路径和文件类型守卫。
- 解包时校验 bundle schema、manifest path、声明文件、声明资产和 manifest 路径。
- 新增 `project-directory-bundle.test.ts`，覆盖完整 round-trip、不安全路径、缺失文件和不支持 schema。

## 关键决策

- 第一版实现为独立 HyperFrames project directory ZIP，不直接耦合 FreeCut `.freecut.zip`；后续主项目 bundle 可把它作为 sidecar 或嵌套目录纳入。
- 保留 manifest provenance、skillId、confirmedByUser 等来源字段，满足后续审计和回滚要求。
- 在 jsdom/Vitest 环境中，`TextEncoder` 结果需要重新包成当前 realm 的 `Uint8Array`，否则 fflate 会把字节按对象目录展开。

## 验证

- `PATH="/Users/changzechuan/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH" node node_modules/.bin/vp test run src/features/hyperframes-runtime/adapters/freecut-project/project-directory-bundle.test.ts`
- `PATH="/Users/changzechuan/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH" node node_modules/.bin/vp test run src/features/hyperframes-runtime/adapters/freecut-project/project-directory-bundle.test.ts src/features/hyperframes-runtime/adapters/freecut-project/project-path-guards.test.ts src/features/hyperframes-runtime/adapters/freecut-project/project-signatures.test.ts src/features/hyperframes-runtime/adapters/freecut-project/project-repository.test.ts src/features/hyperframes-runtime/adapters/freecut-project/file-system-project-repository.test.ts`
- `PATH="/Users/changzechuan/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH" node node_modules/.bin/vp check --no-fmt src vite.config.ts`

## 备注

- `vp check` 仍有既有 `react(only-export-components)` 警告，位置为 `src/features/keyframes/components/dopesheet-editor/dopesheet-timeline-cells.tsx:35`，本任务未修改该文件。
