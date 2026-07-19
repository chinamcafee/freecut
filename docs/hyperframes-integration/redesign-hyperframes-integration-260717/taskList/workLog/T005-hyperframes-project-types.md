# T005 定义 HyperFrames 项目类型与 FreeCut 项目扩展

## 任务

定义 HyperFrames manifest-backed 项目目录、资产、组合链接、渲染缓存、来源记录、模型引用和 FreeCut 项目扩展类型。

## 完成内容

- 新增 `src/types/hyperframes.ts`。
- 扩展 `src/types/project.ts`，在 `Project` 上新增 `hyperframes?: HyperFramesIntegrationState`。
- 新增 `src/types/hyperframes.test.ts`，用真实对象形态验证 manifest-backed 项目目录和 FreeCut 项目扩展类型。

## 关键决策

- 本任务只定义项目级类型和 `Project.hyperframes`，不扩展时间线项字段；时间线源链接字段留给 T006。
- 不新增独立 `hyperframes-composition` 时间线类型。
- HyperFrames 项目权威源是项目目录和 manifest，不是时间线项里的 HTML 字符串。

## 验证

- `PATH="/Users/changzechuan/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH" node node_modules/.bin/vp test run src/types/hyperframes.test.ts src/features/hyperframes-runtime/provenance/manifest.test.ts`
