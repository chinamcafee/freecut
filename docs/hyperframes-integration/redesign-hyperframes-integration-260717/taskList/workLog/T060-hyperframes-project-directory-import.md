# T060 实现 HyperFrames 项目目录导入

## 任务

将完整 HyperFrames 项目目录写入 FreeCut 项目仓储，并创建可由时间线、Studio 和 Player 共用的源链接组合及 composition link。

## 完成内容

- 新增 `importHyperFramesProjectDirectory` 转换桥及公开类型。
- 导入前检查 entry file 和 active composition，缺失时在写入前拒绝。
- 将 manifest、文本文件和二进制资产写入统一 `HyperFramesProjectRepository`。
- 替换已有同名项目目录前创建仓储快照，写入失败时恢复旧目录或删除不完整的新目录。
- 创建 FreeCut `composition` 时间线项，写入 `sourceKind`、项目编号、活动组合路径和 manifest 路径。
- 初始化或更新项目级 `hyperframes.projects` 与以时间线项编号为键的 `compositionLinks`。
- 自动选择可用视频轨道；空项目自动创建 HyperFrames 视频轨道。
- 新增导入后 Studio item 可解析、仓储可读取且 compiler 可预览的核心测试。

## 关键决策

- 导入结果返回新的 Project 值，不直接修改调用方传入对象。
- HyperFrames 项目目录继续是权威源；时间线仅保存引用和编辑入口所需字段。
- 仓储写入先完成，成功后才组装返回的 FreeCut 项目状态，避免项目引用指向半写入目录。

## 验证

- `PATH="/Users/changzechuan/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH" node node_modules/.bin/vp test run src/features/hyperframes-runtime/bridges/conversion-bridge/hyperFramesProjectImport.test.ts`
- `PATH="/Users/changzechuan/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH" node node_modules/.bin/vp check --no-fmt src/features/hyperframes-runtime/bridges/conversion-bridge/hyperFramesProjectImport.ts src/features/hyperframes-runtime/bridges/conversion-bridge/hyperFramesProjectImport.test.ts src/features/hyperframes-runtime/bridges/conversion-bridge/index.ts src/features/hyperframes-runtime/index.ts`

## 结果

- T060 核心测试通过：1 个测试文件、2 个测试通过。
- 相关 4 个文件 lint 和类型检查通过，无警告。
