# T061 实现可编辑近似项转换

## 任务

把 HyperFrames 活动组合中可识别的节点转换为 FreeCut 可编辑近似项，同时保留项目目录和源链接组合，并向用户提供结构化损失记录。

## 完成内容

- 新增 `createEditableFreeCutApproximations` 纯转换入口。
- 新增 `importHyperFramesProjectDirectoryWithApproximations`，在 T060 源链接导入之上追加近似项。
- 使用 DOM parser 识别文本、视频、音频、图片、SVG 形状和子组合。
- 映射起始时间、时长、位置、尺寸、透明度、圆角、文本颜色、字号和字体。
- 使用标准 URL 解析相对资产路径，并支持调用方提供项目资产到 FreeCut 媒体源的解析函数。
- 子组合继续引用同一个 HyperFrames 权威项目和对应 composition path。
- 近似项通过 `linkedGroupId` 和 `originId` 关联源链接组合。
- composition link 标记为 `source-linked-with-approximations`。
- 脚本、未映射 CSS、嵌套 runtime 和不支持节点生成结构化 loss records。

## 关键决策

- 近似项是辅助编辑层，不会替换或删除源链接组合。
- 脚本和复杂 CSS 不进入 FreeCut 原生项，避免把有损解析伪装成等价转换。
- 资产优先使用调用方解析结果，其次使用 manifest `originalUrl`，最后保留 FreeCut 工作区相对路径。

## 验证

- `PATH="/Users/changzechuan/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH" node node_modules/.bin/vp test run src/features/hyperframes-runtime/bridges/conversion-bridge/hyperFramesEditableApproximation.test.ts`
- `PATH="/Users/changzechuan/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH" node node_modules/.bin/vp check --no-fmt src/features/hyperframes-runtime/bridges/conversion-bridge/hyperFramesEditableApproximation.ts src/features/hyperframes-runtime/bridges/conversion-bridge/hyperFramesEditableApproximation.test.ts src/features/hyperframes-runtime/bridges/conversion-bridge/index.ts src/features/hyperframes-runtime/index.ts`

## 结果

- T061 核心测试通过：1 个测试文件、1 个测试通过。
- 相关 4 个文件 lint 和类型检查通过，无警告。
