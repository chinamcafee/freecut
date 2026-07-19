# T008 实现浏览器内存项目目录适配器

## 任务

实现测试和浏览器轻量模式可用的 in-memory HyperFrames 项目目录适配器。

## 完成内容

- 新增 `InMemoryHyperFramesProjectRepository`。
- 支持 manifest 读写、文件读写、资产复制、项目目录读取、快照创建、快照恢复和签名计算。
- 新增 `project-repository.test.ts` 覆盖基本读写、FreeCut 项目过滤、快照恢复和签名变化。

## 关键决策

- 签名使用浏览器安全的稳定 hash，不依赖 Node `crypto`。
- 内存适配器复制 manifest、文件和资产对象，避免调用方直接修改内部状态。
- 路径安全完整守卫留给 T010；当前适配器先提供仓储行为基线。

## 验证

- `PATH="/Users/changzechuan/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH" node node_modules/.bin/vp test run src/features/hyperframes-runtime/adapters/freecut-project/project-repository.test.ts`
