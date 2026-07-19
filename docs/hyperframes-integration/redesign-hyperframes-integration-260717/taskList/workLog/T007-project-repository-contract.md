# T007 实现 HyperFramesProjectRepository 仓储接口

## 任务

实现 HyperFrames 项目目录的统一仓储接口，供后续 Studio、Player、Lint、Producer 和技能导入流程访问。

## 完成内容

- 新增 `src/features/hyperframes-runtime/adapters/freecut-project/project-repository.ts`。
- 定义 `HyperFramesProjectRepository` 接口。
- 定义项目引用、写入元信息和快照类型。
- 在 `src/features/hyperframes-runtime/adapters/freecut-project/index.ts` 和运行时根入口导出仓储接口。

## 关键决策

- 仓储接口以 projectId 为入口，不让迁移后的上游源码直接读写 FreeCut store。
- 统一提供 manifest、文件、资产、快照和 signature 能力。
- 持久化实现留给 T009，当前接口先由内存适配器实现。

## 验证

- `PATH="/Users/changzechuan/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH" node node_modules/.bin/vp test run src/features/hyperframes-runtime/adapters/freecut-project/project-repository.test.ts`
