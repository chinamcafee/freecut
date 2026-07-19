# T059 实现 FreeCut 到 HyperFrames 项目目录导出

## 任务

将 FreeCut 项目转换为以 manifest 为权威索引的 HyperFrames 项目目录，并保证生成目录可进入现有 Player/Compiler 预览链路。

## 完成内容

- 新增 `exportFreeCutProjectToHyperFramesDirectory` 转换桥及公开类型。
- 生成 `index.html` 和 `compositions/main.html`，并转换 FreeCut 子组合到独立 composition 文件。
- 转换文本、视频、音频、图片、形状和 FreeCut 子组合节点，保留帧时序、轨道顺序与基础变换样式。
- 建立去重资产路径和 manifest 资产索引；支持调用方异步提供二进制资产内容。
- 为文本文件和二进制资产计算稳定哈希，并生成 preview signature。
- 将关键帧保存在 `metadata/freecut-keyframes.json`，把不能无损运行的特性记录为 warning/unsupported，而不伪装成无损转换。
- 新增导出后直接调用 HyperFrames compiler 生成预览 HTML 的核心测试。

## 关键决策

- 权威输出是 `HyperFramesProjectDirectory`，不输出单一 HTML 字符串。
- composition 内的资产引用使用相对上级路径，保证从 `compositions/*.html` 正确解析到 `assets/`。
- 源链接 HyperFrames 组合不会被错误内嵌为 FreeCut 原生组合，而是保留外部项目标识并记录损失说明。

## 验证

- `PATH="/Users/changzechuan/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH" node node_modules/.bin/vp test run src/features/hyperframes-runtime/bridges/conversion-bridge/freeCutProjectExport.test.ts`
- `PATH="/Users/changzechuan/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH" node node_modules/.bin/vp check --no-fmt src/features/hyperframes-runtime/bridges/conversion-bridge/freeCutProjectExport.ts src/features/hyperframes-runtime/bridges/conversion-bridge/freeCutProjectExport.test.ts src/features/hyperframes-runtime/bridges/conversion-bridge/index.ts src/features/hyperframes-runtime/index.ts`

## 结果

- T059 核心测试通过：1 个测试文件、1 个测试通过。
- 相关 4 个文件 lint 和类型检查通过，无警告。
